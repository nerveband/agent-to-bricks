package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var discoverCmd = &cobra.Command{
	Use:   "discover",
	Short: "Dump full site context for LLM/agent consumption",
	Long: `Discover fetches the site's design system, capabilities, pages, classes,
and variables in a single call. Designed for AI agents and LLMs that need
to understand the site before generating content.

Output includes:
  - Site info (Bricks/WP/PHP versions, element types)
  - CSS framework configuration (ACSS colors, spacing, typography)
  - Global classes (grouped by framework)
  - CSS variables
  - Available pages

Use --json (recommended) for structured output that agents can parse.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()

		// Fetch all context in sequence (each is fast)
		result := map[string]interface{}{}

		// Site info
		info, err := c.GetSiteInfo()
		if err != nil {
			return fmt.Errorf("failed to get site info: %w", err)
		}
		result["site"] = map[string]interface{}{
			"url":            cfg.Site.URL,
			"bricksVersion":  info.BricksVersion,
			"wpVersion":      info.WPVersion,
			"phpVersion":     info.PHPVersion,
			"pluginVersion":  info.PluginVersion,
			"elementTypes":   info.ElementTypes,
			"breakpoints":    info.Breakpoints,
			"contentMetaKey": info.ContentMetaKey,
		}

		// Features
		features, err := c.GetSiteFeatures()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: could not fetch features: %v\n", err)
		} else {
			result["features"] = map[string]interface{}{
				"frameworks":    features.Frameworks,
				"queryElements": features.QueryElements,
				"woocommerce":   features.WooCommerce.Active,
				"abilities":     features.Abilities.Available,
			}
		}

		// Frameworks (ACSS config)
		fw, err := c.GetFrameworks()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: could not fetch frameworks: %v\n", err)
		} else {
			result["frameworks"] = fw.Frameworks
		}

		// Global classes
		classes, err := c.ListClasses("")
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: could not fetch classes: %v\n", err)
		} else {
			// Group classes by framework for easier consumption
			grouped := map[string][]string{}
			for _, cls := range classes.Classes {
				name, _ := cls["name"].(string)
				fw, _ := cls["framework"].(string)
				if fw == "" {
					fw = "custom"
				}
				grouped[fw] = append(grouped[fw], name)
			}
			result["classes"] = map[string]interface{}{
				"total":   classes.Count,
				"grouped": grouped,
			}
		}

		// CSS Variables
		vars, err := c.GetVariables()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: could not fetch variables: %v\n", err)
		} else {
			varNames := []string{}
			for _, v := range vars.Variables {
				if name, ok := v["name"].(string); ok {
					varNames = append(varNames, name)
				}
			}
			result["variables"] = varNames
		}

		if output.IsJSON() {
			return output.JSON(result)
		}

		// Human-readable summary
		fmt.Printf("Site: %s\n", cfg.Site.URL)
		fmt.Printf("Bricks: %s | WordPress: %s | Plugin: %s\n",
			info.BricksVersion, info.WPVersion, info.PluginVersion)
		fmt.Printf("Element types: %d\n", len(info.ElementTypes))

		if features != nil {
			fmt.Printf("Frameworks: %v\n", features.Frameworks)
			fmt.Printf("Query elements: %d\n", len(features.QueryElements))
		}

		if classes != nil {
			fmt.Printf("\nGlobal classes: %d total\n", classes.Count)
			grouped := map[string]int{}
			for _, cls := range classes.Classes {
				fw, _ := cls["framework"].(string)
				if fw == "" {
					fw = "custom"
				}
				grouped[fw]++
			}
			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			for fw, count := range grouped {
				fmt.Fprintf(w, "  %s\t%d\n", fw, count)
			}
			w.Flush()
		}

		if vars != nil {
			fmt.Printf("\nCSS variables: %d\n", len(vars.Variables))
		}

		return nil
	},
}

func init() {
	output.AddFormatFlags(discoverCmd)
	rootCmd.AddCommand(discoverCmd)
}

// DiscoverResult is exported for use by the init command's connection test.
type DiscoverResult struct {
	Site       *json.RawMessage `json:"site"`
	Features   *json.RawMessage `json:"features"`
	Frameworks *json.RawMessage `json:"frameworks"`
	Classes    *json.RawMessage `json:"classes"`
	Variables  *json.RawMessage `json:"variables"`
}
