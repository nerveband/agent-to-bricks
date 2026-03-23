package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var (
	patchList    bool
	patchElement string
	patchSets    []string
	patchRemoves []string
	patchStdin   bool
	patchDryRun  bool
)

var patchCmd = &cobra.Command{
	Use:   "patch <page-id>",
	Short: "Patch existing elements on a Bricks page",
	Long: `Update specific elements on a page without regenerating the whole thing.

List elements to find IDs:
  bricks patch 1338 --list
  bricks patch 1338 --list --json

Patch classes or settings by element ID:
  bricks patch 1338 -e abc123 --set '_cssClasses=btn--primary hero-btn'
  bricks patch 1338 -e abc123 --set '_display=flex' --set '_gap=var(--space-m)'
  bricks patch 1338 -e abc123 --set 'text=New Heading Text'
  bricks patch 1338 -e abc123 --rm '_padding'

Patch from JSON stdin (for complex or multi-element patches):
  echo '{"patches":[{"id":"abc123","settings":{"_cssClasses":"new"}}]}' | bricks patch 1338 --stdin

This is faster and cheaper than regenerating full page JSON — only the
changed settings are sent. Perfect for class swaps, text edits, and
style tweaks.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		pageID := 0
		if _, err := fmt.Sscanf(args[0], "%d", &pageID); err != nil || pageID == 0 {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		c := newSiteClient()

		// --list mode: show elements with IDs
		if patchList {
			existing, err := c.GetElements(pageID)
			if err != nil {
				return fmt.Errorf("failed to read page: %w", err)
			}

			if output.IsJSON() {
				return output.JSON(existing)
			}

			if existing.Count == 0 {
				fmt.Println("No elements on this page.")
				return nil
			}

			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "ID\tTYPE\tLABEL\tPARENT\tCLASSES")
			for _, el := range existing.Elements {
				id, _ := el["id"].(string)
				name, _ := el["name"].(string)
				label, _ := el["label"].(string)
				parent, _ := el["parent"].(string)
				classes := ""
				if s, ok := el["settings"].(map[string]interface{}); ok {
					if c, ok := s["_cssClasses"].(string); ok {
						classes = c
					}
				}
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", id, name, label, parent, classes)
			}
			w.Flush()
			fmt.Fprintf(os.Stderr, "\n%d elements (hash: %s)\n", existing.Count, existing.ContentHash)
			return nil
		}

		// Build patches from flags or stdin
		var patches []map[string]interface{}

		if patchStdin {
			data, err := io.ReadAll(os.Stdin)
			if err != nil {
				return fmt.Errorf("failed to read stdin: %w", err)
			}
			var body struct {
				Patches []map[string]interface{} `json:"patches"`
			}
			if err := json.Unmarshal(data, &body); err != nil {
				return fmt.Errorf("invalid JSON: %w", err)
			}
			patches = body.Patches
		} else if patchElement != "" {
			// Build patch from --set and --rm flags
			patch := map[string]interface{}{
				"id": patchElement,
			}
			settings := map[string]interface{}{}

			for _, s := range patchSets {
				key, val, err := parseSetFlag(s)
				if err != nil {
					return err
				}
				settings[key] = val
			}

			for _, r := range patchRemoves {
				settings[r] = nil
			}

			if len(settings) > 0 {
				patch["settings"] = settings
			}

			patches = append(patches, patch)
		} else {
			return fmt.Errorf("use --list, --element/-e with --set, or --stdin")
		}

		if len(patches) == 0 {
			return fmt.Errorf("no patches to apply")
		}

		// Dry run: show what would be sent
		if patchDryRun {
			payload := map[string]interface{}{"patches": patches}
			if output.IsJSON() {
				return output.JSON(payload)
			}
			data, _ := json.MarshalIndent(payload, "", "  ")
			fmt.Println(string(data))
			fmt.Fprintf(os.Stderr, "(dry run — nothing sent)\n")
			return nil
		}

		// Get current contentHash for If-Match
		existing, err := c.GetElements(pageID)
		if err != nil {
			return fmt.Errorf("failed to read page: %w", err)
		}

		result, err := c.PatchElements(pageID, patches, existing.ContentHash)
		if err != nil {
			return fmt.Errorf("patch failed: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(result)
		}

		fmt.Fprintf(os.Stderr, "Patched %d element(s) on page %d (hash: %s)\n",
			len(patches), pageID, result.ContentHash)
		return nil
	},
}

// patchListElements is unused — list is handled inline in RunE.
// Kept as a compile guard.

func init() {
	patchCmd.Flags().BoolVar(&patchList, "list", false, "list elements with IDs (discover what to patch)")
	patchCmd.Flags().StringVarP(&patchElement, "element", "e", "", "element ID to patch")
	patchCmd.Flags().StringArrayVar(&patchSets, "set", nil, "set a setting: 'key=value' (repeatable)")
	patchCmd.Flags().StringArrayVar(&patchRemoves, "rm", nil, "remove a setting key (repeatable)")
	patchCmd.Flags().BoolVar(&patchStdin, "stdin", false, "read JSON patches from stdin")
	patchCmd.Flags().BoolVar(&patchDryRun, "dry-run", false, "show patch payload without sending")
	output.AddFormatFlags(patchCmd)
	rootCmd.AddCommand(patchCmd)
}

// parseSetFlag parses "key=value" into setting key and typed value.
// Handles nested keys like "_typography.font-size=2rem" and JSON values.
func parseSetFlag(s string) (string, interface{}, error) {
	idx := strings.IndexByte(s, '=')
	if idx < 0 {
		return "", nil, fmt.Errorf("invalid --set format %q (expected key=value)", s)
	}
	key := s[:idx]
	val := s[idx+1:]

	// Try to parse as JSON for complex values (arrays, objects)
	if len(val) > 0 && (val[0] == '[' || val[0] == '{' || val == "true" || val == "false" || val == "null") {
		var parsed interface{}
		if err := json.Unmarshal([]byte(val), &parsed); err == nil {
			return key, parsed, nil
		}
	}

	return key, val, nil
}
