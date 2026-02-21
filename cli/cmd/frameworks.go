package cmd

import (
	"fmt"
	"strings"

	"github.com/nerveband/agent-to-bricks/internal/framework"
	"github.com/spf13/cobra"
)

var frameworksCmd = &cobra.Command{
	Use:   "frameworks",
	Short: "Manage CSS framework configurations",
}

var frameworksListCmd = &cobra.Command{
	Use:   "list",
	Short: "List loaded CSS framework configs",
	RunE: func(cmd *cobra.Command, args []string) error {
		reg, err := framework.NewRegistry()
		if err != nil {
			return err
		}

		for _, id := range reg.List() {
			fw := reg.Get(id)
			fmt.Printf("%s (%s) — %s\n", fw.Name, fw.ID, fw.Version)
			fmt.Printf("  %s\n", fw.Description)

			// Spacing
			spacingVars := make([]string, 0)
			for _, v := range fw.Spacing.Variables {
				spacingVars = append(spacingVars, v)
			}
			fmt.Printf("  Spacing:   %d variables (%s)\n", len(spacingVars), strings.Join(spacingVars, ", "))

			// Colors
			fmt.Printf("  Colors:    %d families (%s)\n", len(fw.Colors.Families), strings.Join(fw.Colors.Families, ", "))

			// Buttons
			fmt.Printf("  Buttons:   %d variants\n", len(fw.Buttons.Variants))

			// Utilities
			classes := fw.AllUtilityClasses()
			fmt.Printf("  Utilities: %d classes\n", len(classes))

			// Variables
			vars := fw.AllVariables()
			fmt.Printf("  Variables: %d total\n", len(vars))
		}
		return nil
	},
}

var frameworksShowCmd = &cobra.Command{
	Use:   "show <framework-id>",
	Short: "Show detailed framework configuration",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		reg, err := framework.NewRegistry()
		if err != nil {
			return err
		}

		fw := reg.Get(args[0])
		if fw == nil {
			return fmt.Errorf("framework '%s' not found", args[0])
		}

		fmt.Printf("%s (%s) v%s\n", fw.Name, fw.ID, fw.Version)
		fmt.Printf("Plugin: %s\n", fw.PluginSlug)
		fmt.Printf("Option key: %s\n\n", fw.OptionKey)

		fmt.Println("Spacing Variables:")
		for size, cssVar := range fw.Spacing.Variables {
			fmt.Printf("  %-4s → %s\n", size, cssVar)
		}

		fmt.Println("\nColor Families:")
		for _, family := range fw.Colors.Families {
			fmt.Printf("  %s → %s\n", family, fw.ColorVariable(family))
		}

		fmt.Println("\nButton Variants:")
		for _, variant := range fw.Buttons.Variants {
			fmt.Printf("  %s → class: %s, bricks ID: %s\n",
				variant, fw.ButtonClass(variant), fw.BricksClassID(fw.ButtonClass(variant)))
		}

		fmt.Println("\nText Sizes:")
		for size, class := range fw.Typography.TextSizes {
			fmt.Printf("  %-4s → %s\n", size, class)
		}

		fmt.Println("\nUtility Classes:")
		classes := fw.AllUtilityClasses()
		for i, c := range classes {
			if i > 0 && i%8 == 0 {
				fmt.Println()
			}
			fmt.Printf("  %s", c)
		}
		fmt.Println()

		return nil
	},
}

func init() {
	frameworksCmd.AddCommand(frameworksListCmd)
	frameworksCmd.AddCommand(frameworksShowCmd)
	rootCmd.AddCommand(frameworksCmd)
}
