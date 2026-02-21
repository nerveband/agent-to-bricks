package templates_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/templates"
)

func TestCatalogLoadDir(t *testing.T) {
	dir := t.TempDir()
	// Write a test template
	tmpl := `{"name":"hero-alpha","description":"A dark hero section","category":"hero","tags":["hero","dark","cta"],"elements":[{"id":"s1","name":"section","parent":0}]}`
	os.WriteFile(filepath.Join(dir, "hero-alpha.json"), []byte(tmpl), 0644)

	cat := templates.NewCatalog()
	err := cat.LoadDir(dir)
	if err != nil {
		t.Fatalf("failed to load dir: %v", err)
	}

	if cat.Count() != 1 {
		t.Errorf("expected 1 template, got %d", cat.Count())
	}

	tmplObj := cat.Get("hero-alpha")
	if tmplObj == nil {
		t.Fatal("hero-alpha not found")
	}
	if tmplObj.Description != "A dark hero section" {
		t.Errorf("unexpected description: %s", tmplObj.Description)
	}
}

func TestCatalogList(t *testing.T) {
	cat := templates.NewCatalog()
	cat.Add(&templates.Template{Name: "hero", Elements: []map[string]interface{}{}})
	cat.Add(&templates.Template{Name: "footer", Elements: []map[string]interface{}{}})

	names := cat.List()
	if len(names) != 2 {
		t.Errorf("expected 2 templates, got %d", len(names))
	}
}

func TestCatalogSearch(t *testing.T) {
	cat := templates.NewCatalog()
	cat.Add(&templates.Template{Name: "hero-dark", Description: "Dark hero with CTA buttons", Tags: []string{"hero", "dark"}})
	cat.Add(&templates.Template{Name: "feature-grid", Description: "Feature grid layout", Tags: []string{"features", "grid"}})
	cat.Add(&templates.Template{Name: "cta-banner", Description: "Call to action banner", Tags: []string{"cta"}})

	results := cat.Search("dark")
	if len(results) != 1 {
		t.Errorf("expected 1 result for 'dark', got %d", len(results))
	}

	results = cat.Search("cta")
	if len(results) != 2 {
		t.Errorf("expected 2 results for 'cta', got %d", len(results))
	}
}

func TestCatalogSave(t *testing.T) {
	dir := t.TempDir()
	cat := templates.NewCatalog()
	tmpl := &templates.Template{
		Name:        "Test Template",
		Description: "A test",
		Elements:    []map[string]interface{}{{"id": "e1", "name": "heading"}},
	}

	err := cat.Save(tmpl, dir)
	if err != nil {
		t.Fatalf("failed to save: %v", err)
	}

	// Verify file exists
	path := filepath.Join(dir, "test-template.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Error("template file not created")
	}

	// Reload and verify
	cat2 := templates.NewCatalog()
	cat2.LoadDir(dir)
	loaded := cat2.Get("Test Template")
	if loaded == nil {
		t.Fatal("loaded template not found")
	}
	if loaded.Description != "A test" {
		t.Errorf("unexpected description: %s", loaded.Description)
	}
}

func TestLearnFromPage(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{"c1"}, "label": "Hero"},
		{"id": "c1", "name": "container", "parent": "s1", "children": []interface{}{"h1"}},
		{"id": "h1", "name": "heading", "parent": "c1", "children": []interface{}{}, "settings": map[string]interface{}{"text": "Welcome"}},
		{"id": "s2", "name": "section", "parent": float64(0), "children": []interface{}{"c2"}, "label": "Features"},
		{"id": "c2", "name": "container", "parent": "s2", "children": []interface{}{}},
	}

	learned := templates.LearnFromPage(elements, "test-page")
	if len(learned) != 2 {
		t.Fatalf("expected 2 templates, got %d", len(learned))
	}

	// First section should have 3 elements (section + container + heading)
	if len(learned[0].Elements) != 3 {
		t.Errorf("expected 3 elements in first template, got %d", len(learned[0].Elements))
	}

	// Second section should have 2 elements (section + container)
	if len(learned[1].Elements) != 2 {
		t.Errorf("expected 2 elements in second template, got %d", len(learned[1].Elements))
	}

	if learned[0].Category != "learned" {
		t.Errorf("expected category 'learned', got '%s'", learned[0].Category)
	}
}
