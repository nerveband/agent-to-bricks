package validator_test

import (
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/validator"
)

func TestValidMinimalElement(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "heading", "parent": float64(0), "children": []interface{}{}, "settings": map[string]interface{}{"text": "Hello"}},
	}
	r := validator.Validate(elements)
	if !r.Valid {
		t.Errorf("expected valid, got errors: %v", r.Errors)
	}
}

func TestMissingName(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "parent": float64(0)},
	}
	r := validator.Validate(elements)
	if r.Valid {
		t.Error("expected invalid for missing name")
	}
	if len(r.Errors) == 0 {
		t.Error("expected errors")
	}
}

func TestInvalidElementType(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "nonexistent-widget", "parent": float64(0)},
	}
	r := validator.Validate(elements)
	// Should be valid (warning only) since Bricks may have custom elements
	if !r.Valid {
		t.Error("unknown type should be warning, not error")
	}
	if len(r.Warnings) == 0 {
		t.Error("expected warning for unknown type")
	}
}

func TestDuplicateIDs(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "heading", "parent": float64(0)},
		{"id": "e1", "name": "text-basic", "parent": float64(0)},
	}
	r := validator.Validate(elements)
	if r.Valid {
		t.Error("expected invalid for duplicate IDs")
	}
}

func TestOrphanedParent(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "heading", "parent": "nonexistent"},
	}
	r := validator.Validate(elements)
	if r.Valid {
		t.Error("expected invalid for orphaned parent reference")
	}
}

func TestSectionNesting(t *testing.T) {
	elements := []validator.Element{
		{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{"c1"}},
		{"id": "c1", "name": "section", "parent": "s1", "children": []interface{}{}},
	}
	r := validator.Validate(elements)
	// Section inside section should produce a warning
	if len(r.Warnings) == 0 {
		t.Error("expected warning for nested section")
	}
}

func TestDynamicDataTags(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "heading", "parent": float64(0), "settings": map[string]interface{}{
			"text": "{post_title} - {acf_custom_field}",
		}},
	}
	r := validator.Validate(elements)
	if !r.Valid {
		t.Errorf("expected valid, got errors: %v", r.Errors)
	}
	// Known prefixes should not produce warnings
	if len(r.Warnings) > 0 {
		t.Errorf("expected no warnings for known dynamic tags, got: %v", r.Warnings)
	}
}

func TestUnknownDynamicDataTag(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "heading", "parent": float64(0), "settings": map[string]interface{}{
			"text": "{unknown_prefix_field}",
		}},
	}
	r := validator.Validate(elements)
	if len(r.Warnings) == 0 {
		t.Error("expected warning for unknown dynamic data tag prefix")
	}
}

func TestCssGlobalClasses(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "heading", "parent": float64(0), "settings": map[string]interface{}{
			"_cssGlobalClasses": []interface{}{"class1", "class2"},
		}},
	}
	r := validator.Validate(elements)
	if !r.Valid {
		t.Errorf("expected valid, got errors: %v", r.Errors)
	}
}

func TestMediaWithBareURL(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "image", "parent": float64(0), "settings": map[string]interface{}{
			"image": map[string]interface{}{
				"url": "https://example.com/photo.jpg",
			},
		}},
	}
	r := validator.Validate(elements)
	// Should warn about bare URL without attachment ID
	if len(r.Warnings) == 0 {
		t.Error("expected warning for media with bare URL")
	}
}

func TestMediaWithAttachmentID(t *testing.T) {
	elements := []validator.Element{
		{"id": "e1", "name": "image", "parent": float64(0), "settings": map[string]interface{}{
			"image": map[string]interface{}{
				"id":  float64(123),
				"url": "https://example.com/photo.jpg",
			},
		}},
	}
	r := validator.Validate(elements)
	// No warning when attachment ID is present
	hasMediaWarning := false
	for _, w := range r.Warnings {
		if contains(w, "bare URL") {
			hasMediaWarning = true
		}
	}
	if hasMediaWarning {
		t.Error("should not warn about bare URL when attachment ID present")
	}
}

func TestEmptyElements(t *testing.T) {
	r := validator.Validate([]validator.Element{})
	if r.Valid {
		t.Error("expected invalid for empty elements")
	}
}

func TestValidateFile(t *testing.T) {
	data := map[string]interface{}{
		"elements": []interface{}{
			map[string]interface{}{"id": "e1", "name": "section", "parent": float64(0)},
		},
	}
	r := validator.ValidateFile(data)
	if !r.Valid {
		t.Errorf("expected valid, got errors: %v", r.Errors)
	}
}

func TestValidateFileMissingElements(t *testing.T) {
	data := map[string]interface{}{}
	r := validator.ValidateFile(data)
	if r.Valid {
		t.Error("expected invalid for missing elements array")
	}
}

func TestChildrenReferenceCheck(t *testing.T) {
	elements := []validator.Element{
		{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{"ghost_child"}},
	}
	r := validator.Validate(elements)
	if len(r.Warnings) == 0 {
		t.Error("expected warning for non-existent child reference")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstr(s, substr))
}

func containsSubstr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
