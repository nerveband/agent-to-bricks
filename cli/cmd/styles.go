package cmd

import (
	"fmt"
	"strconv"

	"github.com/nerveband/agent-to-bricks/internal/output"
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
		c := newSiteClient()

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

var stylesColorsCmd = &cobra.Command{
	Use:   "colors",
	Short: "Show color palette from the live site",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		resp, err := c.GetStyles()
		if err != nil {
			return fmt.Errorf("failed to get styles: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(map[string]interface{}{
				"colorPalette": resp.ColorPalette,
				"cssColors":    resp.CSSColors,
			})
		}

		palette, ok := resp.ColorPalette.([]interface{})
		if !ok {
			palette = nil
		}

		if len(palette) > 0 {
			fmt.Printf("Bricks Color Palette (%d colors)\n\n", len(palette))
			for _, item := range palette {
				color, ok := item.(map[string]interface{})
				if !ok {
					continue
				}
				name, _ := color["name"].(string)
				hex, _ := color["color"].(string)
				if name == "" {
					name = "(unnamed)"
				}
				fmt.Printf("  %s  %s\n", hex, name)
			}
		}

		if len(resp.CSSColors) > 0 {
			if len(palette) > 0 {
				fmt.Println()
			}
			fmt.Printf("CSS Colors (%d from generated stylesheets)\n\n", len(resp.CSSColors))
			for _, color := range resp.CSSColors {
				slug, _ := color["slug"].(string)
				hex, _ := color["color"].(string)
				source, _ := color["source"].(string)
				if source != "" {
					fmt.Printf("  %s  %s  (%s)\n", hex, slug, source)
				} else {
					fmt.Printf("  %s  %s\n", hex, slug)
				}
			}
		}

		if len(palette) == 0 && len(resp.CSSColors) == 0 {
			fmt.Println("No colors found.")
		}
		return nil
	},
}

var stylesVariablesCmd = &cobra.Command{
	Use:   "variables",
	Short: "Show CSS custom properties from the live site",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		resp, err := c.GetVariables()
		if err != nil {
			return fmt.Errorf("failed to get variables: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(resp)
		}

		if len(resp.Variables) > 0 {
			fmt.Printf("Custom Properties (%d)\n\n", len(resp.Variables))
			for _, v := range resp.Variables {
				name, _ := v["name"].(string)
				value, _ := v["value"].(string)
				fmt.Printf("  %s: %s\n", name, value)
			}
		}

		if len(resp.ExtractedFromCSS) > 0 {
			fmt.Printf("\nExtracted from CSS (%d)\n\n", len(resp.ExtractedFromCSS))
			for _, v := range resp.ExtractedFromCSS {
				name, _ := v["name"].(string)
				value, _ := v["value"].(string)
				source, _ := v["source"].(string)
				fmt.Printf("  %s: %s  (from %s)\n", name, value, source)
			}
		}

		if len(resp.Variables) == 0 && len(resp.ExtractedFromCSS) == 0 {
			fmt.Println("No CSS variables found.")
		}

		return nil
	},
}

var stylesThemeCmd = &cobra.Command{
	Use:   "theme",
	Short: "Show theme styles from the live site",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		resp, err := c.GetStyles()
		if err != nil {
			return fmt.Errorf("failed to get styles: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(resp.ThemeStyles)
		}

		if len(resp.ThemeStyles) == 0 {
			fmt.Println("No theme styles found.")
			return nil
		}

		fmt.Printf("Theme Styles (%d)\n\n", len(resp.ThemeStyles))
		for _, style := range resp.ThemeStyles {
			key, _ := style["key"].(string)
			label, _ := style["label"].(string)
			fmt.Printf("  %s (%s)\n", label, key)
		}
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
	output.AddFormatFlags(stylesColorsCmd)
	output.AddFormatFlags(stylesVariablesCmd)
	output.AddFormatFlags(stylesThemeCmd)

	stylesCmd.AddCommand(stylesLearnCmd)
	stylesCmd.AddCommand(stylesShowCmd)
	stylesCmd.AddCommand(stylesResetCmd)
	stylesCmd.AddCommand(stylesColorsCmd)
	stylesCmd.AddCommand(stylesVariablesCmd)
	stylesCmd.AddCommand(stylesThemeCmd)
	rootCmd.AddCommand(stylesCmd)
}
