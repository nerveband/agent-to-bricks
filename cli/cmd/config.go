package cmd

import (
	"fmt"

	"github.com/nerveband/agent-to-bricks/internal/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage CLI configuration",
}

var configInitCmd = &cobra.Command{
	Use:   "init",
	Short: "Create a new config file interactively",
	RunE: func(cmd *cobra.Command, args []string) error {
		path := cfgFile
		if path == "" {
			path = config.DefaultPath()
		}

		var url, apiKey string
		fmt.Print("Site URL (e.g. https://example.com): ")
		fmt.Scanln(&url)
		fmt.Print("API Key (from WP Admin > Agent to Bricks): ")
		fmt.Scanln(&apiKey)

		newCfg := &config.Config{
			Site: config.SiteConfig{
				URL:    url,
				APIKey: apiKey,
			},
		}

		if err := newCfg.Save(path); err != nil {
			return fmt.Errorf("failed to save config: %w", err)
		}

		fmt.Printf("Config saved to %s\n", path)
		return nil
	},
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a config value (e.g. site.url, site.api_key, llm.provider)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := cfgFile
		if path == "" {
			path = config.DefaultPath()
		}

		// Load existing or create new
		c, err := config.Load(path)
		if err != nil {
			c = &config.Config{}
		}

		key, value := args[0], args[1]
		switch key {
		case "site.url":
			c.Site.URL = value
		case "site.api_key":
			c.Site.APIKey = value
		case "llm.provider":
			c.LLM.Provider = value
		case "llm.api_key":
			c.LLM.APIKey = value
		case "llm.model":
			c.LLM.Model = value
		case "llm.base_url":
			c.LLM.BaseURL = value
		default:
			return fmt.Errorf("unknown config key: %s", key)
		}

		if err := c.Save(path); err != nil {
			return fmt.Errorf("failed to save: %w", err)
		}

		fmt.Printf("Set %s = %s\n", key, value)
		return nil
	},
}

var configListCmd = &cobra.Command{
	Use:   "list",
	Short: "Show current configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Printf("Site URL:    %s\n", cfg.Site.URL)
		if cfg.Site.APIKey != "" {
			fmt.Printf("API Key:     %s...\n", cfg.Site.APIKey[:min(12, len(cfg.Site.APIKey))])
		} else {
			fmt.Println("API Key:     (not set)")
		}
		fmt.Printf("LLM Provider: %s\n", cfg.LLM.Provider)
		fmt.Printf("LLM Model:    %s\n", cfg.LLM.Model)
		return nil
	},
}

func init() {
	configCmd.AddCommand(configInitCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configListCmd)
	rootCmd.AddCommand(configCmd)
}
