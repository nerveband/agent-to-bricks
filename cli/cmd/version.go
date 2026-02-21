package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/nerveband/agent-to-bricks/internal/updater"
	"github.com/spf13/cobra"
)

var versionChangelog bool

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show CLI and plugin versions",
	RunE: func(cmd *cobra.Command, args []string) error {
		if versionChangelog {
			return showChangelog()
		}
		return showVersion()
	},
}

func showVersion() error {
	fmt.Printf("CLI:       v%s (commit: %s, built: %s)\n", cliVersion, cliCommit, cliDate)

	if cfg != nil && cfg.Site.URL != "" && cfg.Site.APIKey != "" {
		c := newSiteClient()
		info, err := c.GetSiteInfo()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Plugin:    (unreachable: %v)\n", err)
		} else {
			fmt.Printf("Plugin:    v%s (on %s)\n", info.PluginVersion, cfg.Site.URL)

			if updater.MajorMinorMatch(cliVersion, info.PluginVersion) {
				fmt.Println("Status:    in sync")
			} else {
				fmt.Println("Status:    VERSION MISMATCH — run: bricks update")
			}

			fmt.Println()
			fmt.Printf("Bricks:    %s\n", info.BricksVersion)
			fmt.Printf("WordPress: %s\n", info.WPVersion)
			fmt.Printf("PHP:       %s\n", info.PHPVersion)
		}
	} else {
		fmt.Println("Plugin:    (no site configured)")
	}

	return nil
}

func showChangelog() error {
	req, err := http.NewRequest("GET", "https://api.github.com/repos/nerveband/agent-to-bricks/releases?per_page=10", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "agent-to-bricks-cli/"+cliVersion)

	httpClient := &http.Client{Timeout: 15 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch releases: %w", err)
	}
	defer resp.Body.Close()

	var releases []struct {
		TagName     string `json:"tag_name"`
		PublishedAt string `json:"published_at"`
		Body        string `json:"body"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return err
	}

	if len(releases) == 0 {
		fmt.Println("No releases found.")
		return nil
	}

	for _, r := range releases {
		date := r.PublishedAt
		if t, err := time.Parse(time.RFC3339, r.PublishedAt); err == nil {
			date = t.Format("2006-01-02")
		}
		fmt.Printf("%s (%s)\n", r.TagName, date)
		if r.Body != "" {
			for _, line := range strings.Split(strings.TrimSpace(r.Body), "\n") {
				fmt.Printf("  %s\n", line)
			}
		}
		fmt.Println()
	}
	return nil
}

func init() {
	versionCmd.Flags().BoolVar(&versionChangelog, "changelog", false, "show changelog from GitHub Releases")
	rootCmd.AddCommand(versionCmd)
}
