package cmd

import (
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var wooCmd = &cobra.Command{
	Use:   "woo",
	Short: "WooCommerce discovery and data commands",
}

var (
	wooSearch string
	wooLimit  int
	wooPage   int
)

var wooStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show WooCommerce availability on the connected site",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()
		resp, err := c.GetWooStatus()
		if err != nil {
			return fmt.Errorf("failed to get WooCommerce status: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(resp)
		}

		fmt.Printf("Active:             %t\n", resp.Active)
		fmt.Printf("Version:            %s\n", resp.Version)
		fmt.Printf("HPOS:               %t\n", resp.HPOS)
		fmt.Printf("Product post type:  %t\n", resp.ProductPostType)
		fmt.Printf("Product categories: %t\n", resp.ProductCategories)
		fmt.Printf("Product tags:       %t\n", resp.ProductTags)
		fmt.Printf("Woo element types:  %d\n", resp.ElementTypeCount)
		if len(resp.ElementTypes) > 0 {
			fmt.Printf("Element types:      %s\n", strings.Join(resp.ElementTypes, ", "))
		}
		return nil
	},
}

var wooProductsCmd = &cobra.Command{
	Use:   "products",
	Short: "List WooCommerce products",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		c := newSiteClient()
		resp, err := c.ListWooProducts(wooSearch, wooLimit, wooPage)
		if err != nil {
			return fmt.Errorf("failed to list WooCommerce products: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(resp)
		}
		if len(resp.Products) == 0 {
			fmt.Println("No WooCommerce products found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTITLE\tSKU\tPRICE\tSTATUS")
		for _, product := range resp.Products {
			fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\n", product.ID, product.Title, product.SKU, product.Price, product.Status)
		}
		w.Flush()
		fmt.Printf("\n%d products (page %d of %d)\n", resp.Total, resp.Page, resp.TotalPages)
		return nil
	},
}

var wooCategoriesCmd = &cobra.Command{
	Use:   "categories",
	Short: "List WooCommerce product categories",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runWooTerms(cmd, "categories")
	},
}

var wooTagsCmd = &cobra.Command{
	Use:   "tags",
	Short: "List WooCommerce product tags",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runWooTerms(cmd, "tags")
	},
}

func runWooTerms(cmd *cobra.Command, kind string) error {
	output.ResolveFormat(cmd)
	if err := requireConfig(); err != nil {
		return err
	}

	c := newSiteClient()
	var (
		resp interface{}
		err  error
		rows []struct {
			ID    int
			Name  string
			Slug  string
			Count int
		}
	)

	switch kind {
	case "categories":
		categories, e := c.ListWooProductCategories(wooSearch, wooLimit)
		resp, err = categories, e
		for _, row := range categories.Categories {
			rows = append(rows, struct {
				ID    int
				Name  string
				Slug  string
				Count int
			}{ID: row.ID, Name: row.Name, Slug: row.Slug, Count: row.Count})
		}
	case "tags":
		tags, e := c.ListWooProductTags(wooSearch, wooLimit)
		resp, err = tags, e
		for _, row := range tags.Tags {
			rows = append(rows, struct {
				ID    int
				Name  string
				Slug  string
				Count int
			}{ID: row.ID, Name: row.Name, Slug: row.Slug, Count: row.Count})
		}
	default:
		return fmt.Errorf("unknown Woo term kind %q", kind)
	}
	if err != nil {
		return fmt.Errorf("failed to list WooCommerce %s: %w", kind, err)
	}
	if output.IsJSON() {
		return output.JSON(resp)
	}
	if len(rows) == 0 {
		fmt.Printf("No WooCommerce %s found.\n", kind)
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tSLUG\tCOUNT")
	for _, row := range rows {
		fmt.Fprintf(w, "%d\t%s\t%s\t%d\n", row.ID, row.Name, row.Slug, row.Count)
	}
	w.Flush()
	fmt.Printf("\n%d %s\n", len(rows), kind)
	return nil
}

func init() {
	output.AddFormatFlags(wooStatusCmd)
	output.AddFormatFlags(wooProductsCmd)
	output.AddFormatFlags(wooCategoriesCmd)
	output.AddFormatFlags(wooTagsCmd)

	wooProductsCmd.Flags().StringVar(&wooSearch, "search", "", "filter WooCommerce products by title")
	wooProductsCmd.Flags().IntVar(&wooLimit, "limit", 20, "max results")
	wooProductsCmd.Flags().IntVar(&wooPage, "page", 1, "result page")
	wooCategoriesCmd.Flags().StringVar(&wooSearch, "search", "", "filter WooCommerce categories by name")
	wooCategoriesCmd.Flags().IntVar(&wooLimit, "limit", 20, "max results")
	wooTagsCmd.Flags().StringVar(&wooSearch, "search", "", "filter WooCommerce tags by name")
	wooTagsCmd.Flags().IntVar(&wooLimit, "limit", 20, "max results")

	wooCmd.AddCommand(wooStatusCmd)
	wooCmd.AddCommand(wooProductsCmd)
	wooCmd.AddCommand(wooCategoriesCmd)
	wooCmd.AddCommand(wooTagsCmd)
	rootCmd.AddCommand(wooCmd)
}
