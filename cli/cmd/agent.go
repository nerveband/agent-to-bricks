package cmd

import (
	"fmt"
	"os"

	"github.com/nerveband/agent-to-bricks/internal/agent"
	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/nerveband/agent-to-bricks/internal/convert"
	"github.com/nerveband/agent-to-bricks/internal/templates"
	"github.com/spf13/cobra"
)

var (
	agentFormat  string
	agentSection string
	agentCompact bool
	agentOutput  string
)

var agentCmd = &cobra.Command{
	Use:   "agent",
	Short: "AI agent integration tools",
	Long: `Tools for AI agents to discover and interact with this Bricks Builder site.

The agent commands provide self-discovery capabilities that let LLMs understand
what design tokens, utility classes, component classes, and templates are
available, then generate compliant HTML that converts cleanly to Bricks elements.`,
}

var agentContextCmd = &cobra.Command{
	Use:   "context",
	Short: "Dump site context for LLM consumption",
	Long: `Queries the live site and outputs structured context that LLMs can use
to generate ACSS-compliant HTML for Bricks Builder pages.

Formats:
  md      Markdown (default) — paste into LLM context windows
  json    Structured JSON — for programmatic use
  prompt  Complete LLM system prompt with design rules + context

Examples:
  bricks agent context                    # Full markdown context
  bricks agent context --format prompt    # Ready-to-use LLM system prompt
  bricks agent context --format json      # Structured JSON for tools
  bricks agent context --section classes  # Just the classes section
  bricks agent context --compact          # Shorter output for small context windows
  bricks agent context --format prompt -o system-prompt.md  # Save to file`,
	RunE: func(cmd *cobra.Command, args []string) error {
		b := agent.NewContextBuilder()

		// Fetch site info if configured
		if cfg.Site.URL != "" && cfg.Site.APIKey != "" {
			c := client.New(cfg.Site.URL, cfg.Site.APIKey)

			// Site info
			info, err := c.GetSiteInfo()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Warning: could not fetch site info: %v\n", err)
			} else {
				b.SetSiteInfo(info.BricksVersion, info.WPVersion, info.PluginVersion)
			}

			// ACSS tokens (frameworks)
			fw, err := c.GetFrameworks()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Warning: could not fetch frameworks: %v\n", err)
			} else if fw.Frameworks != nil {
				// Extract ACSS settings if present
				if acss, ok := fw.Frameworks["acss"].(map[string]interface{}); ok {
					if settings, ok := acss["settings"].(map[string]interface{}); ok {
						b.AddACSSTokens(settings)
					}
				}
			}

			// Classes
			classResp, err := c.ListClasses("")
			if err != nil {
				fmt.Fprintf(os.Stderr, "Warning: could not fetch classes: %v\n", err)
			} else {
				registry := convert.BuildRegistryFromClasses(classResp.Classes)
				var classInfos []agent.ClassInfo
				for _, cls := range classResp.Classes {
					name, _ := cls["name"].(string)
					id, _ := cls["id"].(string)
					category := categorizeClass(name)
					source := "frames"
					if _, s, ok := registry.Lookup(name); ok {
						if s == "acss" {
							source = "acss"
						}
					}
					classInfos = append(classInfos, agent.ClassInfo{
						Name:     name,
						ID:       id,
						Source:   source,
						Category: category,
					})
				}
				b.AddClasses(classInfos)
				fmt.Fprintf(os.Stderr, "Loaded %d classes\n", len(classInfos))
			}
		} else {
			fmt.Fprintf(os.Stderr, "No site configured — showing local data only. Run: bricks config init\n")
			b.SetSiteInfo("unknown", "unknown", "unknown")
		}

		// Templates from local catalog
		cat := templates.NewCatalog()
		dir := templateDir()
		if _, err := os.Stat(dir); err == nil {
			if err := cat.LoadDir(dir); err != nil {
				fmt.Fprintf(os.Stderr, "Warning: could not load templates: %v\n", err)
			} else {
				var tmplInfos []agent.TemplateInfo
				for _, name := range cat.List() {
					tmpl := cat.Get(name)
					tmplInfos = append(tmplInfos, agent.TemplateInfo{
						Name:         tmpl.Name,
						Slug:         name,
						Category:     tmpl.Category,
						ElementCount: len(tmpl.Elements),
					})
				}
				b.AddTemplates(tmplInfos)
				fmt.Fprintf(os.Stderr, "Loaded %d templates\n", len(tmplInfos))
			}
		}

		b.SetCompact(agentCompact)

		// Render
		var output string
		if agentSection != "" {
			output = b.RenderSection(agentSection)
		} else {
			switch agentFormat {
			case "json":
				output = b.RenderJSON()
			case "prompt":
				output = b.RenderPrompt()
			default:
				output = b.RenderMarkdown()
			}
		}

		// Output
		if agentOutput != "" {
			if err := os.WriteFile(agentOutput, []byte(output), 0644); err != nil {
				return err
			}
			fmt.Fprintf(os.Stderr, "Written to %s\n", agentOutput)
		} else {
			fmt.Print(output)
		}

		return nil
	},
}

// categorizeClass assigns a category based on class name patterns.
func categorizeClass(name string) string {
	prefixes := map[string]string{
		"bg--":      "backgrounds",
		"text--":    "text",
		"grid--":    "grids",
		"flex--":    "flex",
		"gap--":     "gaps",
		"space--":   "spacing",
		"pad--":     "spacing",
		"margin--":  "spacing",
		"height--":  "sizing",
		"width--":   "sizing",
		"max-":      "sizing",
		"min-":      "sizing",
		"border--":  "borders",
		"radius--":  "borders",
		"shadow--":  "shadows",
		"overlay--": "overlays",
		"opacity--": "overlays",
		"font--":    "typography",
		"fw--":      "typography",
		"fs--":      "typography",
		"lh--":      "typography",
		"ls--":      "typography",
		"ta--":      "typography",
		"tt--":      "typography",
		"fr-":       "frames",
		"btn--":     "buttons",
		"intro-":    "frames",
	}
	for prefix, cat := range prefixes {
		if len(name) >= len(prefix) && name[:len(prefix)] == prefix {
			return cat
		}
	}
	return "other"
}

func init() {
	agentContextCmd.Flags().StringVarP(&agentFormat, "format", "f", "md", "output format: md, json, prompt")
	agentContextCmd.Flags().StringVarP(&agentSection, "section", "s", "", "dump single section: tokens, classes, templates, workflows")
	agentContextCmd.Flags().BoolVar(&agentCompact, "compact", false, "shorter output for small context windows")
	agentContextCmd.Flags().StringVarP(&agentOutput, "output", "o", "", "write output to file")

	agentCmd.AddCommand(agentContextCmd)
	rootCmd.AddCommand(agentCmd)
}
