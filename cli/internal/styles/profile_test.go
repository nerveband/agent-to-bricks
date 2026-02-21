package styles_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/styles"
)

func TestNewProfile(t *testing.T) {
	p := styles.NewProfile()
	if p.PagesAnalyzed != 0 {
		t.Errorf("expected 0 pages analyzed, got %d", p.PagesAnalyzed)
	}
	if len(p.ClassFrequency) != 0 {
		t.Error("expected empty ClassFrequency")
	}
}

func TestAnalyzePage(t *testing.T) {
	p := styles.NewProfile()
	elements := []map[string]interface{}{
		{
			"name": "heading",
			"settings": map[string]interface{}{
				"_cssGlobalClasses": []interface{}{"cls-a", "cls-b"},
				"_marginTop":        "20px",
				"_color":            "#333",
			},
		},
		{
			"name": "text-basic",
			"settings": map[string]interface{}{
				"_cssGlobalClasses": []interface{}{"cls-a", "cls-c"},
				"_paddingBottom":    "10px",
				"_backgroundColor":  "#fff",
			},
		},
		{
			"name": "heading",
			"settings": map[string]interface{}{
				"_cssGlobalClasses": []interface{}{"cls-a"},
			},
		},
	}

	p.AnalyzePage(elements)

	if p.PagesAnalyzed != 1 {
		t.Errorf("expected 1 page analyzed, got %d", p.PagesAnalyzed)
	}

	// cls-a appears 3 times
	if p.ClassFrequency["cls-a"] != 3 {
		t.Errorf("expected cls-a=3, got %d", p.ClassFrequency["cls-a"])
	}
	if p.ClassFrequency["cls-b"] != 1 {
		t.Errorf("expected cls-b=1, got %d", p.ClassFrequency["cls-b"])
	}
	if p.ClassFrequency["cls-c"] != 1 {
		t.Errorf("expected cls-c=1, got %d", p.ClassFrequency["cls-c"])
	}

	// heading appears 2 times
	if p.ElementPatterns["heading"] != 2 {
		t.Errorf("expected heading=2, got %d", p.ElementPatterns["heading"])
	}

	// spacing
	if p.SpacingValues["20px"] != 1 {
		t.Errorf("expected 20px=1, got %d", p.SpacingValues["20px"])
	}
	if p.SpacingValues["10px"] != 1 {
		t.Errorf("expected 10px=1, got %d", p.SpacingValues["10px"])
	}

	// colors
	if p.ColorUsage["#333"] != 1 {
		t.Errorf("expected #333=1, got %d", p.ColorUsage["#333"])
	}
	if p.ColorUsage["#fff"] != 1 {
		t.Errorf("expected #fff=1, got %d", p.ColorUsage["#fff"])
	}
}

func TestTopClasses(t *testing.T) {
	p := styles.NewProfile()
	p.ClassFrequency["a"] = 10
	p.ClassFrequency["b"] = 5
	p.ClassFrequency["c"] = 20
	p.ClassFrequency["d"] = 1

	top := p.TopClasses(2)
	if len(top) != 2 {
		t.Fatalf("expected 2 items, got %d", len(top))
	}
	if top[0].Value != "c" || top[0].Count != 20 {
		t.Errorf("expected c=20 first, got %s=%d", top[0].Value, top[0].Count)
	}
	if top[1].Value != "a" || top[1].Count != 10 {
		t.Errorf("expected a=10 second, got %s=%d", top[1].Value, top[1].Count)
	}
}

func TestTopElements(t *testing.T) {
	p := styles.NewProfile()
	p.ElementPatterns["section"] = 3
	p.ElementPatterns["heading"] = 7

	top := p.TopElements(10)
	if len(top) != 2 {
		t.Fatalf("expected 2 items, got %d", len(top))
	}
	if top[0].Value != "heading" {
		t.Errorf("expected heading first, got %s", top[0].Value)
	}
}

func TestSaveAndLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "profile.json")

	p := styles.NewProfile()
	p.PagesAnalyzed = 5
	p.ClassFrequency["test-class"] = 42
	p.SpacingValues["var(--space-m)"] = 10
	p.ColorUsage["var(--primary)"] = 8
	p.ElementPatterns["heading"] = 15

	if err := p.Save(path); err != nil {
		t.Fatalf("save failed: %v", err)
	}

	loaded, err := styles.Load(path)
	if err != nil {
		t.Fatalf("load failed: %v", err)
	}

	if loaded.PagesAnalyzed != 5 {
		t.Errorf("expected 5 pages, got %d", loaded.PagesAnalyzed)
	}
	if loaded.ClassFrequency["test-class"] != 42 {
		t.Errorf("expected test-class=42, got %d", loaded.ClassFrequency["test-class"])
	}
	if loaded.SpacingValues["var(--space-m)"] != 10 {
		t.Errorf("expected spacing=10, got %d", loaded.SpacingValues["var(--space-m)"])
	}
}

func TestLoadMissingFile(t *testing.T) {
	p, err := styles.Load("/nonexistent/path.json")
	if err != nil {
		t.Fatalf("expected nil error for missing file, got %v", err)
	}
	if p.PagesAnalyzed != 0 {
		t.Error("expected fresh profile")
	}
}

func TestLoadCorruptFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad.json")
	os.WriteFile(path, []byte("{invalid json"), 0644)

	p, err := styles.Load(path)
	if err != nil {
		t.Fatalf("expected nil error for corrupt file, got %v", err)
	}
	if p.PagesAnalyzed != 0 {
		t.Error("expected fresh profile for corrupt file")
	}
}

func TestAnalyzeMultiplePages(t *testing.T) {
	p := styles.NewProfile()

	page1 := []map[string]interface{}{
		{"name": "section", "settings": map[string]interface{}{"_cssGlobalClasses": []interface{}{"cls-a"}}},
	}
	page2 := []map[string]interface{}{
		{"name": "heading", "settings": map[string]interface{}{"_cssGlobalClasses": []interface{}{"cls-a", "cls-b"}}},
	}

	p.AnalyzePage(page1)
	p.AnalyzePage(page2)

	if p.PagesAnalyzed != 2 {
		t.Errorf("expected 2 pages, got %d", p.PagesAnalyzed)
	}
	if p.ClassFrequency["cls-a"] != 2 {
		t.Errorf("expected cls-a=2, got %d", p.ClassFrequency["cls-a"])
	}
}

func TestElementWithNoSettings(t *testing.T) {
	p := styles.NewProfile()
	elements := []map[string]interface{}{
		{"name": "div"},
		{"name": ""},
	}
	p.AnalyzePage(elements)
	if p.ElementPatterns["div"] != 1 {
		t.Errorf("expected div=1, got %d", p.ElementPatterns["div"])
	}
}
