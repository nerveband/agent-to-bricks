package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/nerveband/agent-to-bricks/internal/security"
	"github.com/spf13/cobra"
)

var (
	patchList       bool
	patchElement    string
	patchSets       []string
	patchRemoves    []string
	patchStdin      bool
	patchInputFile  string
	patchDryRun     bool
	patchNoSnapshot bool
	patchUndo       bool
	patchFilterType string
	patchFilterName string
)

const patchSnapshotLabel = "pre-patch"

var patchCmd = &cobra.Command{
	Use:   "patch <page-id>",
	Short: "Patch existing elements on a Bricks page",
	Long: `Update specific elements on a page without regenerating the whole thing.

List elements to find IDs:
  bricks patch 1338 --list
  bricks patch 1338 --list --type section
  bricks patch 1338 --list --name "Call to Action" --json

Patch classes or settings by element ID:
  bricks patch 1338 -e abc123 --set '_cssClasses=btn--primary hero-btn'
  bricks patch 1338 -e abc123 --set '_display=flex' --set '_gap=var(--space-m)'
  bricks patch 1338 -e abc123 --set 'text=New Heading Text'
  bricks patch 1338 -e abc123 --rm '_padding'

Patch from a JSON file or stdin:
  bricks patch 1338 --file patch.json
  cat patch.json | bricks patch 1338 --stdin

Undo the last patch (rolls back to the pre-patch snapshot):
  bricks patch 1338 --undo

A snapshot is automatically created before each patch. Use --no-snapshot
to skip. This is faster and cheaper than regenerating full page JSON —
only the changed settings are sent.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := security.PageID(args[0])
		if err != nil {
			return err
		}

		c := newSiteClient()

		// --undo mode: rollback to the most recent pre-patch snapshot
		if patchUndo {
			return patchUndoFn(c, pageID)
		}

		// --list mode: show elements with IDs, optionally filtered
		if patchList {
			return patchListFn(cmd, c, pageID)
		}

		// Build patches from flags, file, or stdin
		patches, err := buildPatches()
		if err != nil {
			return err
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

		// Auto-snapshot before patching (unless --no-snapshot)
		if !patchNoSnapshot {
			snap, snapErr := c.CreateSnapshot(pageID, patchSnapshotLabel)
			if snapErr != nil {
				fmt.Fprintf(os.Stderr, "Warning: could not create pre-patch snapshot: %v\n", snapErr)
			} else {
				fmt.Fprintf(os.Stderr, "Snapshot %s created\n", snap.SnapshotID)
			}
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

// patchListFn handles --list with optional --type and --name server-side filters.
func patchListFn(cmd *cobra.Command, c *client.Client, pageID int) error {
	filter := client.GetElementsFilter{
		Type: patchFilterType,
		Name: patchFilterName,
	}
	existing, err := c.GetElementsFiltered(pageID, filter)
	if err != nil {
		return fmt.Errorf("failed to read page: %w", err)
	}

	if output.IsJSON() || getDX(cmd).NDJSON {
		return writePatchListCollection(cmd, existing)
	}

	if existing.Count == 0 {
		if patchFilterType != "" || patchFilterName != "" {
			fmt.Println("No matching elements found.")
		} else {
			fmt.Println("No elements on this page.")
		}
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tTYPE\tLABEL\tPARENT\tCLASSES")
	rows := normalizeSlice(existing.Elements)
	if !getDX(cmd).PageAll {
		rows = paginate(rows, getDX(cmd).Limit, getDX(cmd).Page)
	}
	for _, item := range rows {
		el, _ := item.(map[string]interface{})
		id, _ := el["id"].(string)
		name, _ := el["name"].(string)
		label, _ := el["label"].(string)
		parent := fmt.Sprint(el["parent"])
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

func writePatchListCollection(cmd *cobra.Command, existing *client.ElementsResponse) error {
	return writeDXCollection(cmd, existing.Elements, map[string]interface{}{
		"contentHash": existing.ContentHash,
		"total":       existing.Count,
	}, "elements")
}

// patchUndoFn rolls back to the most recent pre-patch snapshot.
func patchUndoFn(c *client.Client, pageID int) error {
	list, err := c.ListSnapshots(pageID)
	if err != nil {
		return fmt.Errorf("failed to list snapshots: %w", err)
	}

	// Find the most recent snapshot with the pre-patch label.
	var target *client.Snapshot
	for i := range list.Snapshots {
		if list.Snapshots[i].Label == patchSnapshotLabel {
			target = &list.Snapshots[i]
			break
		}
	}
	if target == nil {
		return fmt.Errorf("no pre-patch snapshot found for page %d", pageID)
	}

	result, err := c.Rollback(pageID, target.ID)
	if err != nil {
		return fmt.Errorf("rollback failed: %w", err)
	}

	if output.IsJSON() {
		return output.JSON(result)
	}

	fmt.Fprintf(os.Stderr, "Rolled back page %d to snapshot %s (hash: %s)\n",
		pageID, target.ID, result.ContentHash)
	return nil
}

// buildPatches constructs the patch list from --file, --stdin, or --element flags.
func buildPatches() ([]map[string]interface{}, error) {
	var patches []map[string]interface{}

	if patchInputFile != "" {
		data, err := os.ReadFile(patchInputFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read file %s: %w", patchInputFile, err)
		}
		return parsePatchJSON(data)
	}

	if patchStdin {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return nil, fmt.Errorf("failed to read stdin: %w", err)
		}
		return parsePatchJSON(data)
	}

	if patchElement != "" {
		if err := security.ResourceID("element ID", patchElement); err != nil {
			return nil, err
		}
		patch := map[string]interface{}{
			"id": patchElement,
		}
		settings := map[string]interface{}{}

		for _, s := range patchSets {
			key, val, err := parseSetFlag(s)
			if err != nil {
				return nil, err
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
		return patches, nil
	}

	return nil, fmt.Errorf("use --list, --undo, --element/-e with --set, --file, or --stdin")
}

func parsePatchJSON(data []byte) ([]map[string]interface{}, error) {
	var body struct {
		Patches []map[string]interface{} `json:"patches"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	return body.Patches, nil
}

func init() {
	patchCmd.Flags().BoolVar(&patchList, "list", false, "list elements with IDs (discover what to patch)")
	patchCmd.Flags().StringVar(&patchFilterType, "type", "", "filter --list by element type (e.g. section, heading)")
	patchCmd.Flags().StringVar(&patchFilterName, "name", "", "filter --list by label (case-insensitive substring)")
	patchCmd.Flags().StringVarP(&patchElement, "element", "e", "", "element ID to patch")
	patchCmd.Flags().StringArrayVar(&patchSets, "set", nil, "set a setting: 'key=value' (repeatable)")
	patchCmd.Flags().StringArrayVar(&patchRemoves, "rm", nil, "remove a setting key (repeatable)")
	patchCmd.Flags().BoolVar(&patchStdin, "stdin", false, "read JSON patches from stdin")
	patchCmd.Flags().StringVarP(&patchInputFile, "file", "f", "", "read JSON patches from a file")
	patchCmd.Flags().BoolVar(&patchDryRun, "dry-run", false, "show patch payload without sending")
	patchCmd.Flags().BoolVar(&patchNoSnapshot, "no-snapshot", false, "skip automatic pre-patch snapshot")
	patchCmd.Flags().BoolVar(&patchUndo, "undo", false, "rollback to the most recent pre-patch snapshot")
	output.AddFormatFlags(patchCmd)
	addReadDXFlags(patchCmd, 0)
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
