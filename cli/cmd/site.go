package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	clierrors "github.com/nerveband/agent-to-bricks/internal/errors"
	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/nerveband/agent-to-bricks/internal/security"
	"github.com/spf13/cobra"
)

var siteCmd = &cobra.Command{
	Use:   "site",
	Short: "Site information and management commands",
}

var siteInfoCmd = &cobra.Command{
	Use:   "info",
	Short: "Show site and Bricks environment info",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()

		info, err := c.GetSiteInfo()
		if err != nil {
			return fmt.Errorf("failed to get site info: %w", err)
		}

		if output.IsJSON() {
			return writeDXJSON(cmd, info)
		}

		fmt.Printf("Bricks Version:  %s\n", info.BricksVersion)
		fmt.Printf("Plugin Version:  %s\n", info.PluginVersion)
		fmt.Printf("Content Meta Key: %s\n", info.ContentMetaKey)
		fmt.Printf("Element Types:   %d\n", len(info.ElementTypes))
		fmt.Printf("Breakpoints:     %d\n", len(info.Breakpoints))
		fmt.Printf("PHP Version:     %s\n", info.PHPVersion)
		fmt.Printf("WP Version:      %s\n", info.WPVersion)

		// Check abilities support
		abilities, err := c.GetAbilities("")
		if err == nil && len(abilities) > 0 {
			// Count ATB vs third-party
			atbCount := 0
			thirdPartyCount := 0
			for _, a := range abilities {
				if strings.HasPrefix(a.Name, "agent-bricks/") {
					atbCount++
				} else {
					thirdPartyCount++
				}
			}
			fmt.Printf("Abilities API:   %d abilities (%d ATB, %d third-party)\n", len(abilities), atbCount, thirdPartyCount)
		}

		return nil
	},
}

var siteFrameworksCmd = &cobra.Command{
	Use:   "frameworks",
	Short: "Detect CSS frameworks (ACSS, etc.)",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()

		resp, err := c.GetFrameworks()
		if err != nil {
			return fmt.Errorf("failed to get frameworks: %w", err)
		}

		if output.IsJSON() {
			return writeDXJSON(cmd, resp)
		}

		if len(resp.Frameworks) == 0 {
			fmt.Println("No CSS frameworks detected.")
			return nil
		}

		for name, data := range resp.Frameworks {
			pretty, _ := json.MarshalIndent(data, "", "  ")
			fmt.Printf("%s:\n%s\n", name, string(pretty))
		}

		return nil
	},
}

var pullOutput string

var sitePullCmd = &cobra.Command{
	Use:   "pull <page-id>",
	Short: "Pull page elements to a JSON file",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		output.ResolveFormat(cmd)
		pageID, err := security.PageID(args[0])
		if err != nil {
			return err
		}
		if err := security.OutputPath(pullOutput, true); err != nil {
			return err
		}

		c := newSiteClient()

		resp, err := c.GetElements(pageID)
		if err != nil {
			return fmt.Errorf("failed to pull elements: %w", err)
		}

		payload := interface{}(resp)
		if len(getDX(cmd).Fields) > 0 {
			payload = selectFields(normalizeJSON(resp), getDX(cmd).Fields)
		}
		if output.IsJSON() {
			return output.JSON(payload)
		}
		data, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal JSON: %w", err)
		}

		if pullOutput != "" {
			if err := os.WriteFile(pullOutput, data, 0644); err != nil {
				return fmt.Errorf("failed to write file: %w", err)
			}
			fmt.Printf("Pulled %d elements (hash: %s) → %s\n", resp.Count, resp.ContentHash, pullOutput)
		} else {
			fmt.Println(string(data))
		}

		return nil
	},
}

var sitePushCmd = &cobra.Command{
	Use:   "push <page-id> [file.json]",
	Short: "Push elements from a JSON file or stdin (full replace)",
	Example: `  bricks site push 1234 layout.json
  cat layout.json | bricks site push 1234`,
	Args: cobra.RangeArgs(1, 2),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := security.PageID(args[0])
		if err != nil {
			return clierrors.ValidationError("INVALID_PAGE_ID", err.Error())
		}

		var data []byte
		if len(args) >= 2 {
			data, err = os.ReadFile(args[1])
		} else {
			data, err = io.ReadAll(os.Stdin)
		}
		if err != nil {
			return clierrors.ValidationError("INVALID_INPUT", fmt.Sprintf("failed to read input: %v", err))
		}

		var payload struct {
			Elements    []map[string]interface{} `json:"elements"`
			ContentHash string                   `json:"contentHash"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			return clierrors.ValidationError("INVALID_JSON", "failed to parse JSON input")
		}

		if getDX(cmd).DryRun {
			return dryRun(cmd, "PUT", fmt.Sprintf("/pages/%d/elements", pageID), payload)
		}

		c := newSiteClient()

		resp, err := c.ReplaceElements(pageID, payload.Elements, payload.ContentHash)
		if err != nil {
			return fmt.Errorf("failed to push elements: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(resp)
		}
		fmt.Printf("Pushed %d elements (new hash: %s)\n", resp.Count, resp.ContentHash)
		return nil
	},
}

var patchFile string

var sitePatchCmd = &cobra.Command{
	Use:   "patch <page-id>",
	Short: "Patch specific elements on a page",
	Long:  "Patch elements using --file patches.json or stdin",
	Example: `  bricks site patch 1234 --file fixes.json
  echo '{"patches":[...]}' | bricks site patch 1234`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := security.PageID(args[0])
		if err != nil {
			return clierrors.ValidationError("INVALID_PAGE_ID", err.Error())
		}

		var data []byte
		if patchFile != "" {
			data, err = os.ReadFile(patchFile)
		} else {
			data, err = io.ReadAll(os.Stdin)
		}
		if err != nil {
			return clierrors.ValidationError("INVALID_INPUT", fmt.Sprintf("failed to read input: %v", err))
		}

		var patches struct {
			Patches     []map[string]interface{} `json:"patches"`
			ContentHash string                   `json:"contentHash"`
		}
		if err := json.Unmarshal(data, &patches); err != nil {
			return clierrors.ValidationError("INVALID_JSON", "failed to parse patch JSON input")
		}

		if getDX(cmd).DryRun {
			return dryRun(cmd, "PATCH", fmt.Sprintf("/pages/%d/elements", pageID), patches)
		}

		c := newSiteClient()

		resp, err := c.PatchElements(pageID, patches.Patches, patches.ContentHash)
		if err != nil {
			return fmt.Errorf("failed to patch elements: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(resp)
		}
		fmt.Printf("Patched elements (new hash: %s)\n", resp.ContentHash)
		return nil
	},
}

var snapshotLabel string

var siteSnapshotCmd = &cobra.Command{
	Use:   "snapshot <page-id>",
	Short: "Create a snapshot of the current page state",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		output.ResolveFormat(cmd)
		pageID, err := security.PageID(args[0])
		if err != nil {
			return err
		}

		if getDX(cmd).DryRun {
			return dryRun(cmd, "POST", fmt.Sprintf("/pages/%d/snapshots", pageID), map[string]string{"label": snapshotLabel})
		}

		c := newSiteClient()

		resp, err := c.CreateSnapshot(pageID, snapshotLabel)
		if err != nil {
			return fmt.Errorf("failed to create snapshot: %w", err)
		}

		if output.IsJSON() {
			return writeDXJSON(cmd, resp)
		}
		fmt.Printf("Snapshot created: %s (hash: %s)\n", resp.SnapshotID, resp.ContentHash)
		return nil
	},
}

var siteSnapshotsListCmd = &cobra.Command{
	Use:   "snapshots <page-id>",
	Short: "List snapshots for a page",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		output.ResolveFormat(cmd)
		pageID, err := security.PageID(args[0])
		if err != nil {
			return err
		}

		c := newSiteClient()

		resp, err := c.ListSnapshots(pageID)
		if err != nil {
			return fmt.Errorf("failed to list snapshots: %w", err)
		}

		if output.IsJSON() || getDX(cmd).NDJSON {
			return writeDXCollection(cmd, resp.Snapshots, map[string]interface{}{}, "snapshots")
		}

		snapshots := resp.Snapshots
		items := normalizeSlice(snapshots)
		if !getDX(cmd).PageAll {
			items = paginate(items, getDX(cmd).Limit, getDX(cmd).Page)
		}
		if len(items) == 0 {
			fmt.Println("No snapshots found.")
			return nil
		}

		for _, item := range items {
			m, _ := item.(map[string]interface{})
			fmt.Printf("  %s  %s  (%v elements, hash: %s)\n", m["snapshotId"], m["label"], m["elementCount"], m["contentHash"])
		}
		return nil
	},
}

var siteRollbackCmd = &cobra.Command{
	Use:   "rollback <page-id> [snapshot-id]",
	Short: "Rollback a page to a snapshot (defaults to latest)",
	Args:  cobra.RangeArgs(1, 2),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		output.ResolveFormat(cmd)
		pageID, err := security.PageID(args[0])
		if err != nil {
			return err
		}

		c := newSiteClient()

		snapshotID := ""
		if len(args) > 1 {
			snapshotID = args[1]
			if err := security.ResourceID("snapshot ID", snapshotID); err != nil {
				return err
			}
		} else {
			// Get latest snapshot
			list, err := c.ListSnapshots(pageID)
			if err != nil {
				return fmt.Errorf("failed to list snapshots: %w", err)
			}
			if len(list.Snapshots) == 0 {
				return fmt.Errorf("no snapshots found for page %d", pageID)
			}
			snapshotID = list.Snapshots[0].ID
		}

		if getDX(cmd).DryRun {
			return dryRun(cmd, "POST", fmt.Sprintf("/pages/%d/snapshots/%s/rollback", pageID, snapshotID), nil)
		}

		resp, err := c.Rollback(pageID, snapshotID)
		if err != nil {
			return fmt.Errorf("failed to rollback: %w", err)
		}

		if output.IsJSON() {
			return writeDXJSON(cmd, resp)
		}
		fmt.Printf("Rolled back to %s (new hash: %s)\n", resp.RestoredFrom, resp.ContentHash)
		return nil
	},
}

func init() {
	output.AddFormatFlags(siteInfoCmd)
	output.AddFormatFlags(siteFrameworksCmd)
	addFieldsFlag(siteInfoCmd)
	addFieldsFlag(siteFrameworksCmd)
	output.AddFormatFlags(sitePullCmd)
	output.AddFormatFlags(sitePushCmd)
	output.AddFormatFlags(sitePatchCmd)
	output.AddFormatFlags(siteSnapshotCmd)
	output.AddFormatFlags(siteSnapshotsListCmd)
	output.AddFormatFlags(siteRollbackCmd)
	sitePullCmd.Flags().StringVarP(&pullOutput, "output", "o", "", "output file path (default: stdout)")
	addFieldsFlag(sitePullCmd)
	sitePatchCmd.Flags().StringVarP(&patchFile, "file", "f", "", "patch file (JSON)")
	addDryRunFlag(sitePushCmd)
	addDryRunFlag(sitePatchCmd)
	siteSnapshotCmd.Flags().StringVarP(&snapshotLabel, "label", "l", "", "snapshot label")
	addFieldsFlag(siteSnapshotCmd)
	addReadDXFlags(siteSnapshotsListCmd, 20)
	addDryRunFlag(siteSnapshotCmd)
	addDryRunFlag(siteRollbackCmd)

	siteCmd.AddCommand(siteInfoCmd)
	siteCmd.AddCommand(siteFrameworksCmd)
	siteCmd.AddCommand(sitePullCmd)
	siteCmd.AddCommand(sitePushCmd)
	siteCmd.AddCommand(sitePatchCmd)
	siteCmd.AddCommand(siteSnapshotCmd)
	siteCmd.AddCommand(siteSnapshotsListCmd)
	siteCmd.AddCommand(siteRollbackCmd)
	rootCmd.AddCommand(siteCmd)
}
