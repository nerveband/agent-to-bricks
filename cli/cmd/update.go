package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/nerveband/agent-to-bricks/internal/updater"
	"github.com/spf13/cobra"
)

var (
	updateCLIOnly bool
	updateCheck   bool
	updateForce   bool
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update CLI and plugin to the latest version",
	Long: `Downloads the latest CLI binary from GitHub Releases and triggers
the WordPress plugin to self-update via the REST API.

Use --check to just check without installing.
Use --cli-only to skip the plugin update.
Use --force to re-download even if already on the latest version.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		u := updater.New(cliVersion, "https://api.github.com/repos/nerveband/agent-to-bricks")

		fmt.Fprintln(os.Stderr, "Checking for updates...")
		rel, err := u.GetLatestRelease()
		if err != nil {
			return fmt.Errorf("failed to check for updates: %w", err)
		}

		cliNeedsUpdate := rel.HasUpdate(cliVersion) || updateForce
		pluginVersion := ""
		pluginNeedsUpdate := false

		if cfg != nil && cfg.Site.URL != "" && cfg.Site.APIKey != "" && !updateCLIOnly {
			c := newSiteClient()
			info, err := c.GetSiteInfo()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Warning: could not reach plugin: %v\n", err)
			} else {
				pluginVersion = info.PluginVersion
				pluginNeedsUpdate = rel.HasUpdate(pluginVersion) || updateForce
			}
		}

		fmt.Fprintf(os.Stderr, "  Latest: v%s", rel.Version)
		fmt.Fprintf(os.Stderr, "  (current CLI: v%s", cliVersion)
		if pluginVersion != "" {
			fmt.Fprintf(os.Stderr, ", plugin: v%s", pluginVersion)
		}
		fmt.Fprintln(os.Stderr, ")")
		fmt.Fprintln(os.Stderr)

		if !cliNeedsUpdate && !pluginNeedsUpdate {
			fmt.Fprintln(os.Stderr, "Already up to date.")
			return nil
		}

		if updateCheck {
			if cliNeedsUpdate {
				fmt.Fprintf(os.Stderr, "CLI update available: v%s -> v%s\n", cliVersion, rel.Version)
			}
			if pluginNeedsUpdate {
				fmt.Fprintf(os.Stderr, "Plugin update available: v%s -> v%s\n", pluginVersion, rel.Version)
			}
			fmt.Fprintln(os.Stderr, "\nRun 'bricks update' to install.")
			return nil
		}

		if cliNeedsUpdate {
			goos, goarch := updater.DetectPlatform()
			asset := rel.FindCLIAsset(goos, goarch)
			if asset == nil {
				return fmt.Errorf("no CLI binary found for %s/%s in release v%s", goos, goarch, rel.Version)
			}

			fmt.Fprintf(os.Stderr, "Updating CLI binary...")
			checksumsURL := asset.URL[:strings.LastIndex(asset.URL, "/")+1] + "checksums.txt"
			if err := updater.SelfUpdate(asset.URL, checksumsURL); err != nil {
				return fmt.Errorf("CLI update failed: %w", err)
			}
			fmt.Fprintf(os.Stderr, "  done (v%s)\n", rel.Version)
		}

		if pluginNeedsUpdate && !updateCLIOnly {
			fmt.Fprintf(os.Stderr, "Updating plugin on %s...", cfg.Site.URL)
			c := newSiteClient()
			result, err := c.TriggerPluginUpdate(rel.Version)
			if err != nil {
				fmt.Fprintf(os.Stderr, "\nPlugin update failed: %v\n", err)
				fmt.Fprintln(os.Stderr, "CLI was updated successfully. Retry with: bricks update")
				return nil
			}
			fmt.Fprintf(os.Stderr, "  done (v%s)\n", result.Version)
		}

		parts := []string{}
		if cliNeedsUpdate {
			parts = append(parts, "CLI")
		}
		if pluginNeedsUpdate && !updateCLIOnly {
			parts = append(parts, "plugin")
		}
		fmt.Fprintf(os.Stderr, "\n%s updated to v%s.\n", strings.Join(parts, " and "), rel.Version)

		cache := &updater.CheckCache{Path: updater.DefaultCachePath()}
		cache.Save(rel.Version)

		return nil
	},
}

func init() {
	updateCmd.Flags().BoolVar(&updateCLIOnly, "cli-only", false, "only update the CLI binary")
	updateCmd.Flags().BoolVar(&updateCheck, "check", false, "check for updates without installing")
	updateCmd.Flags().BoolVar(&updateForce, "force", false, "force update even if already on latest")
	rootCmd.AddCommand(updateCmd)
}
