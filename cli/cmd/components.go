package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var componentsCmd = &cobra.Command{
	Use:   "components",
	Short: "Manage reusable Bricks components",
}

var componentsJSON bool

var componentsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List reusable components (section templates)",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()
		resp, err := c.ListComponents()
		if err != nil {
			return fmt.Errorf("list failed: %w", err)
		}

		if componentsJSON {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(resp)
		}

		if resp.Count == 0 {
			fmt.Println("No components found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTITLE\tSTATUS\tELEMENTS\tMODIFIED")
		for _, comp := range resp.Components {
			fmt.Fprintf(w, "%d\t%s\t%s\t%d\t%s\n",
				comp.ID, comp.Title, comp.Status, comp.ElementCount, comp.Modified)
		}
		w.Flush()
		fmt.Printf("\n%d components\n", resp.Count)
		return nil
	},
}

var componentsShowCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "Show a component with its element tree",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		var id int
		if _, err := fmt.Sscanf(args[0], "%d", &id); err != nil {
			return fmt.Errorf("invalid component ID: %s", args[0])
		}
		c := newSiteClient()
		resp, err := c.GetComponent(id)
		if err != nil {
			return fmt.Errorf("get component failed: %w", err)
		}

		if componentsJSON {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(resp)
		}

		fmt.Printf("Component: %s (ID: %d)\n", resp.Title, resp.ID)
		fmt.Printf("Status:    %s\n", resp.Status)
		fmt.Printf("Elements:  %d\n", resp.ElementCount)
		fmt.Printf("Hash:      %s\n", resp.ContentHash)
		fmt.Println("\nElement tree:")
		data, _ := json.MarshalIndent(resp.Elements, "  ", "  ")
		fmt.Printf("  %s\n", string(data))
		return nil
	},
}

func init() {
	componentsListCmd.Flags().BoolVar(&componentsJSON, "json", false, "output as JSON")
	componentsShowCmd.Flags().BoolVar(&componentsJSON, "json", false, "output as JSON")

	componentsCmd.AddCommand(componentsListCmd)
	componentsCmd.AddCommand(componentsShowCmd)
	rootCmd.AddCommand(componentsCmd)
}
