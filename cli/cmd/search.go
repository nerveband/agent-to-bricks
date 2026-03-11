package cmd

import (
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var searchCmd = &cobra.Command{
	Use:   "search",
	Short: "Search across your Bricks site",
}

var (
	searchType            string
	searchSetting         string
	searchClass           string
	searchPostType        string
	searchLimit           int
	searchHasQuery        bool
	searchQueryObjectType string
	searchQueryPostType   string
	searchQueryTaxonomy   string
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
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		params := client.SearchParams{
			ElementType:     searchType,
			GlobalClass:     searchClass,
			PostType:        searchPostType,
			HasQuery:        searchHasQuery,
			QueryObjectType: searchQueryObjectType,
			QueryPostType:   searchQueryPostType,
			QueryTaxonomy:   searchQueryTaxonomy,
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

		if output.IsJSON() {
			return output.JSON(resp)
		}

		if len(resp.Results) == 0 {
			fmt.Println("No matching elements found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "PAGE\tTYPE\tELEMENT ID\tLABEL\tPOST TYPE\tQUERY")
		for _, r := range resp.Results {
			label := r.ElementLabel
			if label == "" {
				label = "-"
			}
			fmt.Fprintf(w, "%s (ID:%d)\t%s\t%s\t%s\t%s\t%s\n",
				r.PostTitle, r.PostID, r.ElementType, r.ElementID, label, r.PostType, summarizeQueryResult(r))
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
	searchElementsCmd.Flags().BoolVar(&searchHasQuery, "has-query", false, "only return elements with Bricks query settings")
	searchElementsCmd.Flags().StringVar(&searchQueryObjectType, "query-object-type", "", "filter query elements by query object type")
	searchElementsCmd.Flags().StringVar(&searchQueryPostType, "query-post-type", "", "filter query elements by queried post type")
	searchElementsCmd.Flags().StringVar(&searchQueryTaxonomy, "query-taxonomy", "", "filter query elements by queried taxonomy")
	output.AddFormatFlags(searchElementsCmd)
	searchElementsCmd.Flags().IntVar(&searchLimit, "limit", 0, "max results")

	searchCmd.AddCommand(searchElementsCmd)
	rootCmd.AddCommand(searchCmd)
}

func summarizeQueryResult(r client.SearchResult) string {
	if !r.HasQuery {
		return "-"
	}

	parts := []string{}
	if r.QueryObjectType != "" {
		parts = append(parts, r.QueryObjectType)
	}
	if len(r.QueryPostTypes) > 0 {
		parts = append(parts, "post_type="+strings.Join(r.QueryPostTypes, ","))
	}
	if len(r.QueryTaxonomies) > 0 {
		parts = append(parts, "taxonomy="+strings.Join(r.QueryTaxonomies, ","))
	}
	if len(parts) == 0 {
		return "query"
	}
	return strings.Join(parts, " | ")
}
