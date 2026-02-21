package templates_test

import (
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/templates"
)

func TestComposeSingle(t *testing.T) {
	tmpl := &templates.Template{
		Name: "hero",
		Elements: []map[string]interface{}{
			{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{"h1"}},
			{"id": "h1", "name": "heading", "parent": "s1", "children": []interface{}{}},
		},
	}

	result, err := templates.Compose([]*templates.Template{tmpl})
	if err != nil {
		t.Fatalf("compose failed: %v", err)
	}

	if len(result) != 2 {
		t.Fatalf("expected 2 elements, got %d", len(result))
	}

	// IDs should be remapped (not original)
	if result[0]["id"] == "s1" || result[1]["id"] == "h1" {
		t.Error("IDs should be remapped")
	}

	// Parent of heading should match new section ID
	sectionID := result[0]["id"].(string)
	headingParent := result[1]["parent"].(string)
	if headingParent != sectionID {
		t.Errorf("heading parent should match section ID: %s != %s", headingParent, sectionID)
	}

	// Children of section should contain new heading ID
	children := result[0]["children"].([]interface{})
	headingID := result[1]["id"].(string)
	if len(children) != 1 || children[0].(string) != headingID {
		t.Errorf("section children should contain heading ID %s, got %v", headingID, children)
	}
}

func TestComposeMultiple(t *testing.T) {
	tmpl1 := &templates.Template{
		Name: "hero",
		Elements: []map[string]interface{}{
			{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{}},
		},
	}
	tmpl2 := &templates.Template{
		Name: "footer",
		Elements: []map[string]interface{}{
			{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{}},
		},
	}

	result, err := templates.Compose([]*templates.Template{tmpl1, tmpl2})
	if err != nil {
		t.Fatalf("compose failed: %v", err)
	}

	if len(result) != 2 {
		t.Fatalf("expected 2 elements, got %d", len(result))
	}

	// Both originally had id "s1" but should now have different IDs
	if result[0]["id"] == result[1]["id"] {
		t.Error("composed elements should have unique IDs")
	}
}

func TestComposeEmpty(t *testing.T) {
	_, err := templates.Compose([]*templates.Template{})
	if err == nil {
		t.Error("expected error for empty compose")
	}
}

func TestComposePreservesSettings(t *testing.T) {
	tmpl := &templates.Template{
		Name: "test",
		Elements: []map[string]interface{}{
			{
				"id":       "e1",
				"name":     "heading",
				"parent":   float64(0),
				"children": []interface{}{},
				"settings": map[string]interface{}{"text": "Hello World", "tag": "h1"},
			},
		},
	}

	result, err := templates.Compose([]*templates.Template{tmpl})
	if err != nil {
		t.Fatalf("compose failed: %v", err)
	}

	settings, ok := result[0]["settings"].(map[string]interface{})
	if !ok {
		t.Fatal("settings not preserved")
	}
	if settings["text"] != "Hello World" {
		t.Errorf("settings text not preserved: %v", settings["text"])
	}
}

func TestComposeWithClasses(t *testing.T) {
	tmpl1 := &templates.Template{
		Name: "hero",
		Elements: []map[string]interface{}{
			{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{}},
		},
		GlobalClasses: []map[string]interface{}{
			{"id": "cls1", "name": "btn--primary"},
			{"id": "cls2", "name": "hero-section"},
		},
	}
	tmpl2 := &templates.Template{
		Name: "footer",
		Elements: []map[string]interface{}{
			{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{}},
		},
		GlobalClasses: []map[string]interface{}{
			{"id": "cls1", "name": "btn--primary"}, // Duplicate — should be deduped
			{"id": "cls3", "name": "footer-dark"},
		},
	}

	result, err := templates.ComposeWithClasses([]*templates.Template{tmpl1, tmpl2})
	if err != nil {
		t.Fatal(err)
	}

	if len(result.Elements) != 2 {
		t.Errorf("expected 2 elements, got %d", len(result.Elements))
	}
	if len(result.GlobalClasses) != 3 {
		t.Errorf("expected 3 unique global classes, got %d", len(result.GlobalClasses))
	}

	// Verify deduplication kept first occurrence
	names := map[string]bool{}
	for _, gc := range result.GlobalClasses {
		name, _ := gc["name"].(string)
		if names[name] {
			t.Errorf("duplicate global class: %s", name)
		}
		names[name] = true
	}
}

func TestComposeWithClassesEmpty(t *testing.T) {
	_, err := templates.ComposeWithClasses([]*templates.Template{})
	if err == nil {
		t.Error("expected error for empty compose")
	}
}
