package doctor_test

import (
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/doctor"
)

func TestHealthyPage(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{"c1"}},
		{"id": "c1", "name": "container", "parent": "s1", "children": []interface{}{"h1"}},
		{"id": "h1", "name": "heading", "parent": "c1", "children": []interface{}{}, "settings": map[string]interface{}{"text": "Hello"}},
	}
	report := doctor.Check(elements)
	if report.Summary["error"] > 0 {
		t.Errorf("expected no errors, got %d: %v", report.Summary["error"], report.Issues)
	}
}

func TestDuplicateIDs(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "x1", "name": "heading", "parent": float64(0)},
		{"id": "x1", "name": "text-basic", "parent": float64(0)},
	}
	report := doctor.Check(elements)
	if report.Summary["error"] == 0 {
		t.Error("expected error for duplicate IDs")
	}
	found := false
	for _, i := range report.Issues {
		if i.Check == "duplicate-id" {
			found = true
		}
	}
	if !found {
		t.Error("expected duplicate-id issue")
	}
}

func TestOrphanedParent(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "e1", "name": "heading", "parent": "nonexistent"},
	}
	report := doctor.Check(elements)
	if report.Summary["error"] == 0 {
		t.Error("expected error for orphaned parent")
	}
}

func TestBrokenChildRef(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{"ghost"}},
	}
	report := doctor.Check(elements)
	if report.Summary["warning"] == 0 {
		t.Error("expected warning for broken child reference")
	}
}

func TestNestingViolation(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{"s2"}},
		{"id": "s2", "name": "section", "parent": "s1", "children": []interface{}{}},
	}
	report := doctor.Check(elements)
	found := false
	for _, i := range report.Issues {
		if i.Check == "nesting-violation" {
			found = true
		}
	}
	if !found {
		t.Error("expected nesting violation for nested section")
	}
}

func TestMissingID(t *testing.T) {
	elements := []map[string]interface{}{
		{"name": "heading", "parent": float64(0)},
	}
	report := doctor.Check(elements)
	found := false
	for _, i := range report.Issues {
		if i.Check == "missing-id" {
			found = true
		}
	}
	if !found {
		t.Error("expected missing-id warning")
	}
}

func TestEmptySettings(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "h1", "name": "heading", "parent": float64(0), "settings": map[string]interface{}{}},
	}
	report := doctor.Check(elements)
	found := false
	for _, i := range report.Issues {
		if i.Check == "empty-settings" {
			found = true
		}
	}
	if !found {
		t.Error("expected empty-settings info")
	}
}

func TestParentChildMismatch(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "s1", "name": "section", "parent": float64(0), "children": []interface{}{"h1"}},
		{"id": "s2", "name": "section", "parent": float64(0), "children": []interface{}{}},
		{"id": "h1", "name": "heading", "parent": "s2"}, // parent is s2 but s1 claims h1
	}
	report := doctor.Check(elements)
	found := false
	for _, i := range report.Issues {
		if i.Check == "parent-child-mismatch" {
			found = true
		}
	}
	if !found {
		t.Error("expected parent-child-mismatch warning")
	}
}
