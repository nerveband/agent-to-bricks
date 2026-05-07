package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nerveband/agent-to-bricks/internal/embeddings"
	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/nerveband/agent-to-bricks/internal/security"
	"github.com/nerveband/agent-to-bricks/internal/templates"
	"github.com/spf13/cobra"
)

func templateDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".agent-to-bricks", "templates")
}

func loadCatalog() (*templates.Catalog, error) {
	cat := templates.NewCatalog()
	dir := templateDir()
	if _, err := os.Stat(dir); err == nil {
		if err := cat.LoadDir(dir); err != nil {
			return nil, err
		}
	}
	return cat, nil
}

var templatesCmd = &cobra.Command{
	Use:   "templates",
	Short: "Manage local template library",
}

var templatesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List available templates",
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		cat, err := loadCatalog()
		if err != nil {
			return err
		}

		names := cat.List()
		if len(names) == 0 {
			fmt.Println("No templates found.")
			fmt.Printf("Import templates to: %s\n", templateDir())
			return nil
		}

		rows := []map[string]interface{}{}
		for _, name := range names {
			tmpl := cat.Get(name)
			rows = append(rows, map[string]interface{}{
				"name": name, "category": tmpl.Category, "description": tmpl.Description,
				"tags": tmpl.Tags, "elementCount": len(tmpl.Elements), "source": tmpl.Source,
			})
		}
		if output.IsJSON() || getDX(cmd).NDJSON {
			return writeDXCollection(cmd, rows, nil, "templates")
		}
		for _, item := range paginate(normalizeSlice(rows), getDX(cmd).Limit, getDX(cmd).Page) {
			row, _ := item.(map[string]interface{})
			fmt.Printf("  %-30s %s (%.0f elements)\n", row["name"], row["category"], row["elementCount"])
		}
		fmt.Printf("\n%d templates\n", len(names))
		return nil
	},
}

var templatesShowCmd = &cobra.Command{
	Use:   "show <name>",
	Short: "Show template details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		cat, err := loadCatalog()
		if err != nil {
			return err
		}

		tmpl := cat.Get(args[0])
		if tmpl == nil {
			return fmt.Errorf("template '%s' not found", args[0])
		}

		if output.IsJSON() {
			return writeDXJSON(cmd, tmpl)
		}
		fmt.Printf("Name:        %s\n", tmpl.Name)
		fmt.Printf("Description: %s\n", tmpl.Description)
		fmt.Printf("Category:    %s\n", tmpl.Category)
		fmt.Printf("Tags:        %v\n", tmpl.Tags)
		fmt.Printf("Elements:    %d\n", len(tmpl.Elements))
		if len(tmpl.GlobalClasses) > 0 {
			fmt.Printf("Classes:     %d\n", len(tmpl.GlobalClasses))
		}
		fmt.Printf("Source:      %s\n", tmpl.Source)
		return nil
	},
}

var templatesImportCmd = &cobra.Command{
	Use:   "import <dir-or-file>",
	Short: "Import templates from a directory or JSON file",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		cat, err := loadCatalog()
		if err != nil {
			return err
		}

		src := args[0]
		if getDX(cmd).DryRun {
			return dryRun(cmd, "LOCAL_IMPORT", "templates", map[string]interface{}{"source": src, "destination": templateDir()})
		}
		info, err := os.Stat(src)
		if err != nil {
			return fmt.Errorf("cannot access %s: %w", src, err)
		}

		dest := templateDir()
		count := 0

		if info.IsDir() {
			srcCat := templates.NewCatalog()
			if err := srcCat.LoadDir(src); err != nil {
				return err
			}
			for _, name := range srcCat.List() {
				tmpl := srcCat.Get(name)
				if err := cat.Save(tmpl, dest); err != nil {
					return err
				}
				count++
			}
		} else {
			tmpl, err := templates.LoadFile(src)
			if err != nil {
				return err
			}
			if err := cat.Save(tmpl, dest); err != nil {
				return err
			}
			count = 1
		}

		fmt.Printf("Imported %d templates to %s\n", count, dest)
		return nil
	},
}

var templatesLearnCmd = &cobra.Command{
	Use:   "learn <page-id>",
	Short: "Learn templates from an existing page (splits into sections)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := security.PageID(args[0])
		if err != nil {
			return err
		}

		c := newSiteClient()
		resp, err := c.GetElements(pageID)
		if err != nil {
			return fmt.Errorf("failed to pull elements: %w", err)
		}

		pageName := fmt.Sprintf("page-%d", pageID)
		learned := templates.LearnFromPage(resp.Elements, pageName)

		if len(learned) == 0 {
			fmt.Println("No sections found on page.")
			return nil
		}

		cat, _ := loadCatalog()
		dest := templateDir()
		for _, tmpl := range learned {
			if err := cat.Save(tmpl, dest); err != nil {
				return err
			}
			fmt.Printf("  Learned: %s (%d elements)\n", tmpl.Name, len(tmpl.Elements))
		}
		fmt.Printf("\nLearned %d templates from page %d\n", len(learned), pageID)
		return nil
	},
}

var composeOutput string
var composePush int

var composeCmd = &cobra.Command{
	Use:   "compose <template1> [template2] ...",
	Short: "Compose multiple templates into a single page",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		cat, err := loadCatalog()
		if err != nil {
			return err
		}

		var tmpls []*templates.Template
		for _, name := range args {
			tmpl := cat.Get(name)
			if tmpl == nil {
				return fmt.Errorf("template '%s' not found", name)
			}
			tmpls = append(tmpls, tmpl)
		}

		result, err := templates.ComposeWithClasses(tmpls)
		if err != nil {
			return err
		}

		elements := result.Elements

		// Push to a page if --push flag is set
		if composePush > 0 {
			if err := requireConfig(); err != nil {
				return err
			}
			if getDX(cmd).DryRun {
				return dryRun(cmd, "PUT", fmt.Sprintf("/pages/%d/elements", composePush), map[string]interface{}{"elements": elements})
			}
			c := newSiteClient()
			existing, _ := c.GetElements(composePush)
			ifMatch := ""
			if existing != nil {
				ifMatch = existing.ContentHash
			}
			pushResult, err := c.ReplaceElements(composePush, elements, ifMatch)
			if err != nil {
				return fmt.Errorf("push failed: %w", err)
			}
			fmt.Printf("Pushed %d elements to page %d\n", pushResult.Count, composePush)
			return nil
		}

		// Build output payload including globalClasses if present
		payload := map[string]interface{}{
			"elements": elements,
			"count":    len(elements),
		}
		if len(result.GlobalClasses) > 0 {
			payload["globalClasses"] = result.GlobalClasses
		}

		data, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return err
		}

		if output.IsJSON() {
			return writeDXJSON(cmd, payload)
		}
		if composeOutput != "" {
			if err := security.OutputPath(composeOutput, true); err != nil {
				return err
			}
			if err := os.WriteFile(composeOutput, data, 0644); err != nil {
				return err
			}
			fmt.Printf("Composed %d templates (%d elements) → %s\n", len(tmpls), len(elements), composeOutput)
		} else {
			fmt.Println(string(data))
		}
		return nil
	},
}

var templatesSearchCmd = &cobra.Command{
	Use:   "search <query>",
	Short: "Search templates by description or tags",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		cat, err := loadCatalog()
		if err != nil {
			return err
		}

		// Build search index from catalog
		idx := embeddings.NewIndex()
		for _, name := range cat.List() {
			tmpl := cat.Get(name)
			idx.Add(name, tmpl.Name, tmpl.Description, tmpl.Category, tmpl.Tags)
		}

		results := idx.Search(args[0], 10)
		if len(results) == 0 {
			fmt.Println("No matching templates found.")
			return nil
		}

		rows := []map[string]interface{}{}
		for _, r := range results {
			tmpl := cat.Get(r.ID)
			row := map[string]interface{}{"id": r.ID, "name": r.Name, "score": r.Score}
			if tmpl != nil {
				row["description"] = tmpl.Description
				row["category"] = tmpl.Category
				row["tags"] = tmpl.Tags
			}
			rows = append(rows, row)
		}
		if output.IsJSON() || getDX(cmd).NDJSON {
			return writeDXCollection(cmd, rows, nil, "templates")
		}
		for i, item := range paginate(normalizeSlice(rows), getDX(cmd).Limit, getDX(cmd).Page) {
			row, _ := item.(map[string]interface{})
			fmt.Printf("  %d. %-30s (score: %.3f)\n", i+1, row["name"], row["score"])
			if desc, _ := row["description"].(string); desc != "" {
				fmt.Printf("     %s\n", desc)
			}
		}
		return nil
	},
}

func init() {
	composeCmd.Flags().StringVarP(&composeOutput, "output", "o", "", "output file path")
	composeCmd.Flags().IntVar(&composePush, "push", 0, "push composed result to page ID")
	output.AddFormatFlags(composeCmd)
	addFieldsFlag(composeCmd)
	addDryRunFlag(composeCmd)
	output.AddFormatFlags(templatesListCmd)
	addReadDXFlags(templatesListCmd, 0)
	output.AddFormatFlags(templatesShowCmd)
	addFieldsFlag(templatesShowCmd)
	output.AddFormatFlags(templatesSearchCmd)
	addReadDXFlags(templatesSearchCmd, 10)
	output.AddFormatFlags(templatesImportCmd)
	addDryRunFlag(templatesImportCmd)

	templatesCmd.AddCommand(templatesListCmd)
	templatesCmd.AddCommand(templatesShowCmd)
	templatesCmd.AddCommand(templatesImportCmd)
	templatesCmd.AddCommand(templatesLearnCmd)
	templatesCmd.AddCommand(templatesSearchCmd)
	rootCmd.AddCommand(templatesCmd)
	rootCmd.AddCommand(composeCmd)
}
