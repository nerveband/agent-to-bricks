package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var componentsCmd = &cobra.Command{
	Use:   "components",
	Short: "Manage reusable Bricks components",
}

var componentsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List reusable components (section templates)",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()
		resp, err := c.ListComponents()
		if err != nil {
			return fmt.Errorf("list failed: %w", err)
		}

		if output.IsJSON() || getDX(cmd).NDJSON {
			return writeDXCollection(cmd, resp.Components, map[string]interface{}{"total": resp.Total}, "components")
		}

		if resp.Count == 0 {
			fmt.Println("No components found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTITLE\tSTATUS\tELEMENTS\tMODIFIED")
		rows := paginate(normalizeSlice(resp.Components), getDX(cmd).Limit, getDX(cmd).Page)
		for _, item := range rows {
			comp, _ := item.(map[string]interface{})
			fmt.Fprintf(w, "%d\t%s\t%s\t%d\t%s\n",
				int(comp["id"].(float64)), comp["title"], comp["status"], int(comp["elementCount"].(float64)), comp["modified"])
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
		output.ResolveFormat(cmd)
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

		if output.IsJSON() {
			return writeDXJSON(cmd, resp)
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
	output.AddFormatFlags(componentsListCmd)
	output.AddFormatFlags(componentsShowCmd)
	addReadDXFlags(componentsListCmd, 0)
	addFieldsFlag(componentsShowCmd)

	componentsCmd.AddCommand(componentsListCmd)
	componentsCmd.AddCommand(componentsShowCmd)
	rootCmd.AddCommand(componentsCmd)
}
