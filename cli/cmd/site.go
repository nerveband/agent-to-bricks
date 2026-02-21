package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"

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
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()

		info, err := c.GetSiteInfo()
		if err != nil {
			return fmt.Errorf("failed to get site info: %w", err)
		}

		fmt.Printf("Bricks Version:  %s\n", info.BricksVersion)
		fmt.Printf("Plugin Version:  %s\n", info.PluginVersion)
		fmt.Printf("Content Meta Key: %s\n", info.ContentMetaKey)
		fmt.Printf("Element Types:   %d\n", len(info.ElementTypes))
		fmt.Printf("Breakpoints:     %d\n", len(info.Breakpoints))
		fmt.Printf("PHP Version:     %s\n", info.PHPVersion)
		fmt.Printf("WP Version:      %s\n", info.WPVersion)

		return nil
	},
}

var siteFrameworksCmd = &cobra.Command{
	Use:   "frameworks",
	Short: "Detect CSS frameworks (ACSS, etc.)",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()

		resp, err := c.GetFrameworks()
		if err != nil {
			return fmt.Errorf("failed to get frameworks: %w", err)
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

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		c := newSiteClient()

		resp, err := c.GetElements(pageID)
		if err != nil {
			return fmt.Errorf("failed to pull elements: %w", err)
		}

		data, err := json.MarshalIndent(resp, "", "  ")
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
	Use:   "push <page-id> <file.json>",
	Short: "Push elements from a JSON file (full replace)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		data, err := os.ReadFile(args[1])
		if err != nil {
			return fmt.Errorf("failed to read file: %w", err)
		}

		var payload struct {
			Elements    []map[string]interface{} `json:"elements"`
			ContentHash string                   `json:"contentHash"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			return fmt.Errorf("failed to parse JSON: %w", err)
		}

		c := newSiteClient()

		resp, err := c.ReplaceElements(pageID, payload.Elements, payload.ContentHash)
		if err != nil {
			return fmt.Errorf("failed to push elements: %w", err)
		}

		fmt.Printf("Pushed %d elements (new hash: %s)\n", resp.Count, resp.ContentHash)
		return nil
	},
}

var patchFile string

var sitePatchCmd = &cobra.Command{
	Use:   "patch <page-id>",
	Short: "Patch specific elements on a page",
	Long:  "Patch elements using --element <id> --set key=value or --file patches.json",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		if patchFile == "" {
			return fmt.Errorf("--file is required (e.g. --file patches.json)")
		}

		data, err := os.ReadFile(patchFile)
		if err != nil {
			return fmt.Errorf("failed to read patch file: %w", err)
		}

		var patches struct {
			Elements    []map[string]interface{} `json:"elements"`
			ContentHash string                   `json:"contentHash"`
		}
		if err := json.Unmarshal(data, &patches); err != nil {
			return fmt.Errorf("failed to parse patch JSON: %w", err)
		}

		c := newSiteClient()

		resp, err := c.PatchElements(pageID, patches.Elements, patches.ContentHash)
		if err != nil {
			return fmt.Errorf("failed to patch elements: %w", err)
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

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		c := newSiteClient()

		resp, err := c.CreateSnapshot(pageID, snapshotLabel)
		if err != nil {
			return fmt.Errorf("failed to create snapshot: %w", err)
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

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		c := newSiteClient()

		resp, err := c.ListSnapshots(pageID)
		if err != nil {
			return fmt.Errorf("failed to list snapshots: %w", err)
		}

		if len(resp.Snapshots) == 0 {
			fmt.Println("No snapshots found.")
			return nil
		}

		for _, s := range resp.Snapshots {
			fmt.Printf("  %s  %s  (%d elements, hash: %s)\n", s.ID, s.Label, s.Count, s.ContentHash)
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

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		c := newSiteClient()

		snapshotID := ""
		if len(args) > 1 {
			snapshotID = args[1]
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

		resp, err := c.Rollback(pageID, snapshotID)
		if err != nil {
			return fmt.Errorf("failed to rollback: %w", err)
		}

		fmt.Printf("Rolled back to %s (new hash: %s)\n", resp.Restored, resp.ContentHash)
		return nil
	},
}

func init() {
	sitePullCmd.Flags().StringVarP(&pullOutput, "output", "o", "", "output file path (default: stdout)")
	sitePatchCmd.Flags().StringVarP(&patchFile, "file", "f", "", "patch file (JSON)")
	siteSnapshotCmd.Flags().StringVarP(&snapshotLabel, "label", "l", "", "snapshot label")

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
