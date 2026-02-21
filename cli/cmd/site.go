package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/nerveband/agent-to-bricks/internal/client"
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

		c := client.New(cfg.Site.URL, cfg.Site.APIKey)

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

		c := client.New(cfg.Site.URL, cfg.Site.APIKey)

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

func init() {
	siteCmd.AddCommand(siteInfoCmd)
	siteCmd.AddCommand(siteFrameworksCmd)
	rootCmd.AddCommand(siteCmd)
}
