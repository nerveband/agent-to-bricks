package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/nerveband/agent-to-bricks/internal/embeddings"
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

		for _, name := range names {
			tmpl := cat.Get(name)
			fmt.Printf("  %-30s %s (%d elements)\n", name, tmpl.Category, len(tmpl.Elements))
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
		cat, err := loadCatalog()
		if err != nil {
			return err
		}

		tmpl := cat.Get(args[0])
		if tmpl == nil {
			return fmt.Errorf("template '%s' not found", args[0])
		}

		fmt.Printf("Name:        %s\n", tmpl.Name)
		fmt.Printf("Description: %s\n", tmpl.Description)
		fmt.Printf("Category:    %s\n", tmpl.Category)
		fmt.Printf("Tags:        %v\n", tmpl.Tags)
		fmt.Printf("Elements:    %d\n", len(tmpl.Elements))
		fmt.Printf("Source:      %s\n", tmpl.Source)
		return nil
	},
}

var templatesImportCmd = &cobra.Command{
	Use:   "import <dir-or-file>",
	Short: "Import templates from a directory or JSON file",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cat, err := loadCatalog()
		if err != nil {
			return err
		}

		src := args[0]
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
			data, err := os.ReadFile(src)
			if err != nil {
				return err
			}
			var tmpl templates.Template
			if err := json.Unmarshal(data, &tmpl); err != nil {
				return err
			}
			if err := cat.Save(&tmpl, dest); err != nil {
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

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		c := client.New(cfg.Site.URL, cfg.Site.APIKey)
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

var composeCmd = &cobra.Command{
	Use:   "compose <template1> [template2] ...",
	Short: "Compose multiple templates into a single page",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
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

		elements, err := templates.Compose(tmpls)
		if err != nil {
			return err
		}

		data, err := json.MarshalIndent(map[string]interface{}{
			"elements": elements,
			"count":    len(elements),
		}, "", "  ")
		if err != nil {
			return err
		}

		if composeOutput != "" {
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

		for i, r := range results {
			tmpl := cat.Get(r.ID)
			fmt.Printf("  %d. %-30s (score: %.3f)\n", i+1, r.Name, r.Score)
			if tmpl != nil && tmpl.Description != "" {
				fmt.Printf("     %s\n", tmpl.Description)
			}
		}
		return nil
	},
}

func init() {
	composeCmd.Flags().StringVarP(&composeOutput, "output", "o", "", "output file path")

	templatesCmd.AddCommand(templatesListCmd)
	templatesCmd.AddCommand(templatesShowCmd)
	templatesCmd.AddCommand(templatesImportCmd)
	templatesCmd.AddCommand(templatesLearnCmd)
	templatesCmd.AddCommand(templatesSearchCmd)
	rootCmd.AddCommand(templatesCmd)
	rootCmd.AddCommand(composeCmd)
}
