package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/spf13/cobra"
)

var searchCmd = &cobra.Command{
	Use:   "search",
	Short: "Search across your Bricks site",
}

var (
	searchType     string
	searchSetting  string
	searchClass    string
	searchPostType string
	searchJSON     bool
	searchLimit    int
)

var searchElementsCmd = &cobra.Command{
	Use:   "elements",
	Short: "Search elements by type, setting, or class across all pages",
	Long: `Search for elements across all Bricks content on your site.

Examples:
  bricks search elements --type heading
  bricks search elements --setting tag=h1
  bricks search elements --class btn--primary
  bricks search elements --type button --post-type page`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		params := client.SearchParams{
			ElementType: searchType,
			GlobalClass: searchClass,
			PostType:    searchPostType,
		}

		if searchSetting != "" {
			parts := splitSetting(searchSetting)
			params.SettingKey = parts[0]
			if len(parts) > 1 {
				params.SettingValue = parts[1]
			}
		}

		if searchLimit > 0 {
			params.PerPage = searchLimit
		}

		resp, err := c.SearchElements(params)
		if err != nil {
			return fmt.Errorf("search failed: %w", err)
		}

		if searchJSON {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(resp)
		}

		if len(resp.Results) == 0 {
			fmt.Println("No matching elements found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "PAGE\tTYPE\tELEMENT ID\tLABEL\tPOST TYPE")
		for _, r := range resp.Results {
			label := r.ElementLabel
			if label == "" {
				label = "-"
			}
			fmt.Fprintf(w, "%s (ID:%d)\t%s\t%s\t%s\t%s\n",
				r.PostTitle, r.PostID, r.ElementType, r.ElementID, label, r.PostType)
		}
		w.Flush()
		fmt.Printf("\n%d results (page %d of %d)\n", resp.Total, resp.Page, resp.TotalPages)
		return nil
	},
}

func splitSetting(s string) []string {
	for i, c := range s {
		if c == '=' {
			return []string{s[:i], s[i+1:]}
		}
	}
	return []string{s}
}

func init() {
	searchElementsCmd.Flags().StringVar(&searchType, "type", "", "element type (heading, button, etc.)")
	searchElementsCmd.Flags().StringVar(&searchSetting, "setting", "", "setting filter as key=value")
	searchElementsCmd.Flags().StringVar(&searchClass, "class", "", "global class name or ID")
	searchElementsCmd.Flags().StringVar(&searchPostType, "post-type", "", "post type filter")
	searchElementsCmd.Flags().BoolVar(&searchJSON, "json", false, "output as JSON")
	searchElementsCmd.Flags().IntVar(&searchLimit, "limit", 0, "max results")

	searchCmd.AddCommand(searchElementsCmd)
	rootCmd.AddCommand(searchCmd)
}
