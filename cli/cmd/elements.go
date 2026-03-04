package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var elementsCmd = &cobra.Command{
	Use:   "elements",
	Short: "Element type information",
}

var (
	elemTypesControls bool
	elemTypesCategory string
)

var elemTypesCmd = &cobra.Command{
	Use:   "types [name]",
	Short: "List available Bricks element types with metadata",
	Long: `List all available element types in your Bricks installation.

Examples:
  bricks elements types
  bricks elements types --category media
  bricks elements types --controls
  bricks elements types heading --controls`,
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		singleName := ""
		if len(args) > 0 {
			singleName = args[0]
			elemTypesControls = true
		}

		resp, err := c.ListElementTypes(elemTypesControls, elemTypesCategory)
		if err != nil {
			return fmt.Errorf("failed: %w", err)
		}

		if singleName != "" {
			for _, et := range resp.ElementTypes {
				if et.Name == singleName {
					if output.IsJSON() {
						return output.JSON(et)
					}
					fmt.Printf("Name:     %s\n", et.Name)
					fmt.Printf("Label:    %s\n", et.Label)
					fmt.Printf("Category: %s\n", et.Category)
					if et.Controls != nil {
						fmt.Println("\nControls:")
						data, _ := json.MarshalIndent(et.Controls, "  ", "  ")
						fmt.Printf("  %s\n", string(data))
					}
					return nil
				}
			}
			return fmt.Errorf("element type '%s' not found", singleName)
		}

		if output.IsJSON() {
			return output.JSON(resp)
		}

		if resp.Count == 0 {
			fmt.Println("No element types found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NAME\tLABEL\tCATEGORY\tICON")
		for _, et := range resp.ElementTypes {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", et.Name, et.Label, et.Category, et.Icon)
		}
		w.Flush()
		fmt.Printf("\n%d element types\n", resp.Count)
		return nil
	},
}

func init() {
	elemTypesCmd.Flags().BoolVar(&elemTypesControls, "controls", false, "include element controls schema")
	elemTypesCmd.Flags().StringVar(&elemTypesCategory, "category", "", "filter by category")
	output.AddFormatFlags(elemTypesCmd)

	elementsCmd.AddCommand(elemTypesCmd)
	rootCmd.AddCommand(elementsCmd)
}
