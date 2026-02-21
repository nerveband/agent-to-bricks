package cmd

import (
	"fmt"
	"strconv"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/nerveband/agent-to-bricks/internal/styles"
	"github.com/spf13/cobra"
)

var stylesCmd = &cobra.Command{
	Use:   "styles",
	Short: "Style profile analysis commands",
}

var stylesLearnCmd = &cobra.Command{
	Use:   "learn <page-id> [page-id...]",
	Short: "Analyze pages to build a style profile",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		profilePath := styles.DefaultPath()
		profile, _ := styles.Load(profilePath)
		c := client.New(cfg.Site.URL, cfg.Site.APIKey)

		for _, arg := range args {
			pageID, err := strconv.Atoi(arg)
			if err != nil {
				fmt.Printf("Skipping invalid page ID: %s\n", arg)
				continue
			}

			resp, err := c.GetElements(pageID)
			if err != nil {
				fmt.Printf("Failed to pull page %d: %v\n", pageID, err)
				continue
			}

			profile.AnalyzePage(resp.Elements)
			fmt.Printf("Analyzed page %d (%d elements)\n", pageID, resp.Count)
		}

		if err := profile.Save(profilePath); err != nil {
			return fmt.Errorf("failed to save profile: %w", err)
		}

		fmt.Printf("\nProfile updated: %d pages analyzed total\n", profile.PagesAnalyzed)
		fmt.Printf("Saved to %s\n", profilePath)
		return nil
	},
}

var stylesShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Display the current style profile",
	RunE: func(cmd *cobra.Command, args []string) error {
		profile, _ := styles.Load(styles.DefaultPath())

		if profile.PagesAnalyzed == 0 {
			fmt.Println("No style profile yet. Run 'bricks styles learn <page-id>' first.")
			return nil
		}

		fmt.Printf("Style Profile (%d pages analyzed)\n\n", profile.PagesAnalyzed)

		limit, _ := cmd.Flags().GetInt("limit")

		fmt.Println("Top CSS Classes:")
		for i, item := range profile.TopClasses(limit) {
			fmt.Printf("  %d. %s (%d uses)\n", i+1, item.Value, item.Count)
		}

		fmt.Println("\nTop Elements:")
		for i, item := range profile.TopElements(limit) {
			fmt.Printf("  %d. %s (%d uses)\n", i+1, item.Value, item.Count)
		}

		if len(profile.SpacingValues) > 0 {
			fmt.Println("\nSpacing Values:")
			for _, item := range topFromMap(profile.SpacingValues, limit) {
				fmt.Printf("  %s (%d uses)\n", item.Value, item.Count)
			}
		}

		if len(profile.ColorUsage) > 0 {
			fmt.Println("\nColors:")
			for _, item := range topFromMap(profile.ColorUsage, limit) {
				fmt.Printf("  %s (%d uses)\n", item.Value, item.Count)
			}
		}

		return nil
	},
}

var stylesResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Reset the style profile",
	RunE: func(cmd *cobra.Command, args []string) error {
		profile := styles.NewProfile()
		if err := profile.Save(styles.DefaultPath()); err != nil {
			return err
		}
		fmt.Println("Style profile reset.")
		return nil
	},
}

func topFromMap(m map[string]int, limit int) []styles.RankedItem {
	items := make([]styles.RankedItem, 0, len(m))
	for k, v := range m {
		items = append(items, styles.RankedItem{Value: k, Count: v})
	}
	// Sort by count descending
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			if items[j].Count > items[i].Count {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items
}

func init() {
	stylesShowCmd.Flags().Int("limit", 10, "number of items to display")

	stylesCmd.AddCommand(stylesLearnCmd)
	stylesCmd.AddCommand(stylesShowCmd)
	stylesCmd.AddCommand(stylesResetCmd)
	rootCmd.AddCommand(stylesCmd)
}
