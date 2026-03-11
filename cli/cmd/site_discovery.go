package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var siteFeaturesCmd = &cobra.Command{
	Use:   "features",
	Short: "Show machine-discoverable site features",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()
		resp, err := c.GetSiteFeatures()
		if err != nil {
			return fmt.Errorf("failed to get site features: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(resp)
		}

		fmt.Printf("Bricks:          %t (%s)\n", resp.Bricks.Active, resp.Bricks.Version)
		fmt.Printf("WordPress:       %s\n", resp.WordPress.Version)
		fmt.Printf("Plugin:          %s\n", resp.Plugin.Version)
		fmt.Printf("Abilities API:   %t\n", resp.Abilities.Available)
		fmt.Printf("Frameworks:      %d\n", len(resp.Frameworks))
		fmt.Printf("Query Elements:  %d\n", resp.QueryElementCount)
		fmt.Printf("WooCommerce:     %t (%s)\n", resp.WooCommerce.Active, resp.WooCommerce.Version)
		if len(resp.Frameworks) > 0 {
			fmt.Printf("\nFrameworks: %v\n", resp.Frameworks)
		}
		if len(resp.QueryElements) > 0 {
			fmt.Printf("Query-capable element types: %v\n", resp.QueryElements)
		}
		if len(resp.WooCommerce.ElementTypes) > 0 {
			fmt.Printf("Woo element types: %v\n", resp.WooCommerce.ElementTypes)
		}
		return nil
	},
}

var siteQueryElementsControls bool

var siteQueryElementsCmd = &cobra.Command{
	Use:   "query-elements [name]",
	Short: "List Bricks element types with query controls",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()
		singleName := ""
		if len(args) > 0 {
			singleName = args[0]
			siteQueryElementsControls = true
		}

		resp, err := c.ListQueryElementTypes(siteQueryElementsControls)
		if err != nil {
			return fmt.Errorf("failed to get query element types: %w", err)
		}

		if singleName != "" {
			for _, et := range resp.QueryElements {
				if et.Name != singleName {
					continue
				}
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
			return fmt.Errorf("query element type %q not found", singleName)
		}

		if output.IsJSON() {
			return output.JSON(resp)
		}

		if resp.Count == 0 {
			fmt.Println("No query-capable element types found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NAME\tLABEL\tCATEGORY")
		for _, et := range resp.QueryElements {
			fmt.Fprintf(w, "%s\t%s\t%s\n", et.Name, et.Label, et.Category)
		}
		w.Flush()
		fmt.Printf("\n%d query-capable element types\n", resp.Count)
		return nil
	},
}

func init() {
	output.AddFormatFlags(siteFeaturesCmd)
	output.AddFormatFlags(siteQueryElementsCmd)
	siteQueryElementsCmd.Flags().BoolVar(&siteQueryElementsControls, "controls", false, "include query element controls schema")

	siteCmd.AddCommand(siteFeaturesCmd)
	siteCmd.AddCommand(siteQueryElementsCmd)
}
