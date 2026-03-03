package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var abilitiesCmd = &cobra.Command{
	Use:   "abilities",
	Short: "Discover WordPress Abilities on the site (WP 6.9+)",
	Long: `Query the WordPress Abilities API to discover what actions are available
on the connected site. This includes abilities registered by Agent to Bricks
and any other plugin that supports the Abilities API.

Requires WordPress 6.9 or later. Returns empty results on older versions.

Reference: https://developer.wordpress.org/apis/abilities-api/`,
}

var abilitiesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all available abilities",
	Long: `Lists all abilities registered on the site via the WordPress Abilities API.
Abilities from all plugins are included, not just Agent to Bricks.

Examples:
  bricks abilities list                           # All abilities
  bricks abilities list --category agent-bricks-pages  # Filter by category
  bricks abilities list --json                    # JSON output`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		category, _ := cmd.Flags().GetString("category")
		jsonOut, _ := cmd.Flags().GetBool("json")

		abilities, err := c.GetAbilities(category)
		if err != nil {
			return fmt.Errorf("failed to fetch abilities: %w", err)
		}

		if len(abilities) == 0 {
			fmt.Fprintln(os.Stderr, "No abilities found. The site may not support the WordPress Abilities API (requires WP 6.9+).")
			return nil
		}

		if jsonOut {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(abilities)
		}

		// Group by category
		cats := make(map[string][]struct{ Name, Label, Mode string })
		for _, a := range abilities {
			mode := "read/write"
			if a.Annotations.Readonly {
				mode = "readonly"
			}
			if a.Annotations.Destructive {
				mode = "destructive"
			}
			cats[a.Category] = append(cats[a.Category], struct{ Name, Label, Mode string }{
				Name: a.Name, Label: a.Label, Mode: mode,
			})
		}

		keys := make([]string, 0, len(cats))
		for k := range cats {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintf(w, "ABILITY\tLABEL\tMODE\n")
		for _, cat := range keys {
			fmt.Fprintf(w, "\n[%s]\n", cat)
			for _, a := range cats[cat] {
				fmt.Fprintf(w, "%s\t%s\t%s\n", a.Name, a.Label, a.Mode)
			}
		}
		w.Flush()
		fmt.Fprintf(os.Stderr, "\n%d abilities across %d categories\n", len(abilities), len(cats))
		return nil
	},
}

var abilitiesDescribeCmd = &cobra.Command{
	Use:   "describe <ability-name>",
	Short: "Show details and schemas for an ability",
	Long: `Shows the full details of a specific ability including its description,
input/output JSON schemas, annotations, and category.

Examples:
  bricks abilities describe agent-bricks/get-site-info
  bricks abilities describe yoast/get-seo-meta`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()
		name := args[0]

		abilities, err := c.GetAbilities("")
		if err != nil {
			return fmt.Errorf("failed to fetch abilities: %w", err)
		}

		for _, a := range abilities {
			if a.Name == name {
				fmt.Printf("Name:        %s\n", a.Name)
				fmt.Printf("Label:       %s\n", a.Label)
				fmt.Printf("Description: %s\n", a.Description)
				fmt.Printf("Category:    %s\n", a.Category)

				mode := "read/write"
				if a.Annotations.Readonly {
					mode = "readonly"
				}
				if a.Annotations.Destructive {
					mode += ", destructive"
				}
				if a.Annotations.Idempotent {
					mode += ", idempotent"
				}
				fmt.Printf("Mode:        %s\n", mode)

				if a.InputSchema != nil && len(a.InputSchema) > 0 {
					schemaJSON, _ := json.MarshalIndent(a.InputSchema, "", "  ")
					fmt.Printf("\nInput Schema:\n%s\n", string(schemaJSON))
				}
				if a.OutputSchema != nil && len(a.OutputSchema) > 0 {
					schemaJSON, _ := json.MarshalIndent(a.OutputSchema, "", "  ")
					fmt.Printf("\nOutput Schema:\n%s\n", string(schemaJSON))
				}

				method := "POST"
			if a.Annotations.Readonly {
				method = "GET"
			}
			fmt.Printf("\nExecute: %s %s/wp-json/wp-abilities/v1/%s/run\n",
				method, strings.TrimRight(cfg.Site.URL, "/"), name)
				return nil
			}
		}

		return fmt.Errorf("ability %q not found", name)
	},
}

var abilitiesCategoriesCmd = &cobra.Command{
	Use:   "categories",
	Short: "List ability categories",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		cats, err := c.GetAbilityCategories()
		if err != nil {
			return fmt.Errorf("failed to fetch categories: %w", err)
		}

		if len(cats) == 0 {
			fmt.Fprintln(os.Stderr, "No ability categories found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintf(w, "SLUG\tLABEL\tDESCRIPTION\n")
		for _, cat := range cats {
			fmt.Fprintf(w, "%s\t%s\t%s\n", cat.Slug, cat.Label, cat.Description)
		}
		w.Flush()
		return nil
	},
}

func init() {
	abilitiesListCmd.Flags().String("category", "", "filter by category slug")
	abilitiesListCmd.Flags().Bool("json", false, "output as JSON")

	abilitiesCmd.AddCommand(abilitiesListCmd)
	abilitiesCmd.AddCommand(abilitiesDescribeCmd)
	abilitiesCmd.AddCommand(abilitiesCategoriesCmd)
	rootCmd.AddCommand(abilitiesCmd)
}
