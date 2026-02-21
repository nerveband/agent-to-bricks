package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/nerveband/agent-to-bricks/internal/config"
	"github.com/nerveband/agent-to-bricks/internal/updater"
	"github.com/spf13/cobra"
)

var (
	cfgFile    string
	cfg        *config.Config
	cliVersion string
	cliCommit  string
	cliDate    string
)

var rootCmd = &cobra.Command{
	Use:   "bricks",
	Short: "Agent to Bricks — AI-powered Bricks Builder CLI",
	Long:  "Build and manage Bricks Builder pages programmatically via AI agents.",
}

// SetVersion sets the CLI version info from ldflags.
func SetVersion(version, commit, date string) {
	cliVersion = version
	cliCommit = commit
	cliDate = date
	rootCmd.Version = fmt.Sprintf("%s (commit: %s, built: %s)", version, commit, date)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default: ~/.agent-to-bricks/config.yaml)")
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentPreRun = func(cmd *cobra.Command, args []string) {
		// Skip update check for these commands
		name := cmd.Name()
		if name == "update" || name == "version" || name == "help" {
			return
		}

		cache := &updater.CheckCache{Path: updater.DefaultCachePath()}
		if !cache.NeedsCheck() {
			// Still show notice if cached version is newer
			data := cache.Load()
			if data != nil && data.LatestVersion != "" {
				cv := strings.TrimPrefix(cliVersion, "v")
				if updater.CompareVersions(cv, data.LatestVersion) < 0 {
					fmt.Fprintf(os.Stderr, "\n  Update available: v%s -> run: bricks update\n\n", data.LatestVersion)
				}
			}
			return
		}

		// Check GitHub (don't block on network errors)
		u := updater.New(cliVersion, "https://api.github.com/repos/nerveband/agent-to-bricks")
		rel, err := u.GetLatestRelease()
		if err != nil {
			return
		}

		cache.Save(rel.Version)

		if rel.HasUpdate(cliVersion) {
			fmt.Fprintf(os.Stderr, "\n  Update available: v%s -> run: bricks update\n\n", rel.Version)
		}
	}
}

func initConfig() {
	path := cfgFile
	if path == "" {
		path = config.DefaultPath()
	}
	loaded, err := config.Load(path)
	if err != nil {
		// Config not found is OK for init/help commands
		cfg = &config.Config{}
		return
	}
	cfg = loaded
}

func requireConfig() error {
	if cfg.Site.URL == "" {
		return fmt.Errorf("site URL not configured. Run: bricks config init")
	}
	if cfg.Site.APIKey == "" {
		return fmt.Errorf("API key not configured. Run: bricks config set site.api_key <key>")
	}
	return nil
}
