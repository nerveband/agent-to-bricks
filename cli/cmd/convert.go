package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/nerveband/agent-to-bricks/internal/convert"
	"github.com/spf13/cobra"
)

var (
	convertOutput     string
	convertPush       int
	convertStdin      bool
	convertClassCache bool
	convertSnapshot   bool
	convertDryRun     bool
)

func configDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".agent-to-bricks")
}

var convertCmd = &cobra.Command{
	Use:   "convert",
	Short: "Convert between formats",
}

var convertHTMLCmd = &cobra.Command{
	Use:   "html [file.html]",
	Short: "Convert HTML to Bricks element JSON",
	Long: `Convert HTML to Bricks elements with ACSS class resolution.

When connected to a site, CSS classes are resolved against the global class
registry: ACSS utility classes and Frames component classes become proper
_cssGlobalClasses IDs. Unresolved classes go to _cssClasses.

Use --push to send converted elements directly to a Bricks page.
Use --stdin to pipe HTML from another tool (e.g., an LLM).`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// Read HTML from file or stdin
		var htmlData []byte
		var err error
		if convertStdin || len(args) == 0 {
			htmlData, err = io.ReadAll(os.Stdin)
		} else {
			htmlData, err = os.ReadFile(args[0])
		}
		if err != nil {
			return fmt.Errorf("failed to read input: %w", err)
		}
		if len(htmlData) == 0 {
			return fmt.Errorf("no HTML input provided")
		}

		// Build class registry (from cache or API)
		var registry *convert.ClassRegistry
		if cfg.Site.URL != "" && cfg.Site.APIKey != "" {
			cachePath := filepath.Join(configDir(), "class-registry.json")

			if convertClassCache {
				if reg, loadErr := convert.LoadRegistryFromFile(cachePath); loadErr == nil {
					registry = reg
					stats := reg.Stats()
					fmt.Fprintf(os.Stderr, "Using cached class registry (%d classes: %d ACSS, %d Frames)\n",
						stats.Total, stats.ACSS, stats.Frames)
				}
			}

			if registry == nil {
				c := newSiteClient()
				classResp, apiErr := c.ListClasses("")
				if apiErr != nil {
					fmt.Fprintf(os.Stderr, "Warning: could not fetch classes: %v\n", apiErr)
				} else {
					registry = convert.BuildRegistryFromClasses(classResp.Classes)
					stats := registry.Stats()
					fmt.Fprintf(os.Stderr, "Loaded %d classes (ACSS: %d, Frames: %d)\n",
						stats.Total, stats.ACSS, stats.Frames)
					// Save cache for next time
					os.MkdirAll(configDir(), 0755)
					_ = registry.SaveToFile(cachePath, cfg.Site.URL)
				}
			}
		}

		// Convert
		var elements []map[string]interface{}
		if registry != nil {
			elements, err = convert.HTMLToBricksWithRegistry(string(htmlData), registry)
		} else {
			elements, err = convert.HTMLToBricks(string(htmlData))
		}
		if err != nil {
			return fmt.Errorf("conversion failed: %w", err)
		}

		fmt.Fprintf(os.Stderr, "Converted %d elements\n", len(elements))

		// Push to page
		if convertPush > 0 && !convertDryRun {
			if err := requireConfig(); err != nil {
				return err
			}
			c := newSiteClient()

			// Optional snapshot before pushing
			if convertSnapshot {
				snap, snapErr := c.CreateSnapshot(convertPush, "Pre-convert backup")
				if snapErr != nil {
					fmt.Fprintf(os.Stderr, "Warning: snapshot failed: %v\n", snapErr)
				} else {
					fmt.Fprintf(os.Stderr, "Snapshot created: %s\n", snap.SnapshotID)
				}
			}

			// Fetch current contentHash for If-Match header
			existing, getErr := c.GetElements(convertPush)
			ifMatch := ""
			if getErr == nil {
				ifMatch = existing.ContentHash
			}

			result, pushErr := c.ReplaceElements(convertPush, elements, ifMatch)
			if pushErr != nil {
				return fmt.Errorf("push failed: %w", pushErr)
			}
			fmt.Fprintf(os.Stderr, "Pushed %d elements to page %d (hash: %s)\n",
				result.Count, convertPush, result.ContentHash)
		}

		// Output JSON
		output := map[string]interface{}{
			"elements": elements,
			"count":    len(elements),
		}
		jsonData, err := json.MarshalIndent(output, "", "  ")
		if err != nil {
			return err
		}

		if convertOutput != "" {
			if err := os.WriteFile(convertOutput, jsonData, 0644); err != nil {
				return err
			}
			fmt.Fprintf(os.Stderr, "Written to %s\n", convertOutput)
		} else if convertPush == 0 || convertDryRun {
			fmt.Println(string(jsonData))
		}

		return nil
	},
}

func init() {
	convertHTMLCmd.Flags().StringVarP(&convertOutput, "output", "o", "", "output file path")
	convertHTMLCmd.Flags().IntVar(&convertPush, "push", 0, "push to page ID after converting")
	convertHTMLCmd.Flags().BoolVar(&convertStdin, "stdin", false, "read HTML from stdin")
	convertHTMLCmd.Flags().BoolVar(&convertClassCache, "class-cache", false, "use cached class registry")
	convertHTMLCmd.Flags().BoolVar(&convertSnapshot, "snapshot", false, "create snapshot before pushing")
	convertHTMLCmd.Flags().BoolVar(&convertDryRun, "dry-run", false, "show result without pushing")

	convertCmd.AddCommand(convertHTMLCmd)
	rootCmd.AddCommand(convertCmd)
}
