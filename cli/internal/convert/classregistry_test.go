package convert

import (
	"os"
	"path/filepath"
	"testing"
)

func TestClassRegistry_Lookup(t *testing.T) {
	r := NewClassRegistry()
	r.Add("mt-l", "acss_import_mt-l", "acss")
	r.Add("mb-m", "acss_import_mb-m", "acss")
	r.Add("hero-section", "frm_style_abc123", "frames")

	// Verify ACSS lookup
	id, source, found := r.Lookup("mt-l")
	if !found {
		t.Fatal("expected mt-l to be found")
	}
	if id != "acss_import_mt-l" {
		t.Errorf("expected id acss_import_mt-l, got %s", id)
	}
	if source != "acss" {
		t.Errorf("expected source acss, got %s", source)
	}

	// Verify Frames lookup
	id, source, found = r.Lookup("hero-section")
	if !found {
		t.Fatal("expected hero-section to be found")
	}
	if id != "frm_style_abc123" {
		t.Errorf("expected id frm_style_abc123, got %s", id)
	}
	if source != "frames" {
		t.Errorf("expected source frames, got %s", source)
	}

	// Verify not-found
	_, _, found = r.Lookup("nonexistent")
	if found {
		t.Error("expected nonexistent class not to be found")
	}
}

func TestClassRegistry_Stats(t *testing.T) {
	r := NewClassRegistry()
	r.Add("mt-l", "acss_import_mt-l", "acss")
	r.Add("mb-m", "acss_import_mb-m", "acss")
	r.Add("hero-section", "frm_style_abc123", "frames")

	s := r.Stats()
	if s.Total != 3 {
		t.Errorf("expected total 3, got %d", s.Total)
	}
	if s.ACSS != 2 {
		t.Errorf("expected ACSS 2, got %d", s.ACSS)
	}
	if s.Frames != 1 {
		t.Errorf("expected Frames 1, got %d", s.Frames)
	}
}

func TestBuildRegistryFromClasses(t *testing.T) {
	classes := []map[string]interface{}{
		{"id": "acss_import_mt-l", "name": "mt-l"},
		{"id": "acss_import_mb-m", "name": "mb-m"},
		{"id": "frm_style_abc123", "name": "hero-section"},
		{"id": "frm_style_def456", "name": "card-grid"},
	}

	r := BuildRegistryFromClasses(classes)

	// Verify ACSS detection
	id, source, found := r.Lookup("mt-l")
	if !found {
		t.Fatal("expected mt-l to be found")
	}
	if source != "acss" {
		t.Errorf("expected source acss, got %s", source)
	}
	if id != "acss_import_mt-l" {
		t.Errorf("expected id acss_import_mt-l, got %s", id)
	}

	// Verify Frames classification
	id, source, found = r.Lookup("hero-section")
	if !found {
		t.Fatal("expected hero-section to be found")
	}
	if source != "frames" {
		t.Errorf("expected source frames, got %s", source)
	}
	if id != "frm_style_abc123" {
		t.Errorf("expected id frm_style_abc123, got %s", id)
	}

	// Verify counts
	s := r.Stats()
	if s.Total != 4 {
		t.Errorf("expected total 4, got %d", s.Total)
	}
	if s.ACSS != 2 {
		t.Errorf("expected ACSS 2, got %d", s.ACSS)
	}
	if s.Frames != 2 {
		t.Errorf("expected Frames 2, got %d", s.Frames)
	}

	// Verify entries with missing fields are skipped
	classesWithBad := []map[string]interface{}{
		{"id": "acss_import_mt-l", "name": "mt-l"},
		{"id": "", "name": "empty-id"},
		{"id": "some_id", "name": ""},
		{"id": 123, "name": "non-string-id"},
	}
	r2 := BuildRegistryFromClasses(classesWithBad)
	s2 := r2.Stats()
	if s2.Total != 1 {
		t.Errorf("expected total 1 after filtering bad entries, got %d", s2.Total)
	}
}

func TestClassRegistry_SaveLoad(t *testing.T) {
	// Build a registry
	r := NewClassRegistry()
	r.Add("mt-l", "acss_import_mt-l", "acss")
	r.Add("mb-m", "acss_import_mb-m", "acss")
	r.Add("hero-section", "frm_style_abc123", "frames")

	// Save to temp file
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "class-registry.json")
	if err := r.SaveToFile(path, "https://example.com"); err != nil {
		t.Fatalf("SaveToFile failed: %v", err)
	}

	// Verify file exists
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected file to exist: %v", err)
	}

	// Load back
	loaded, err := LoadRegistryFromFile(path)
	if err != nil {
		t.Fatalf("LoadRegistryFromFile failed: %v", err)
	}

	// Verify all entries preserved
	for _, name := range r.Names() {
		origID, origSource, _ := r.Lookup(name)
		loadedID, loadedSource, found := loaded.Lookup(name)
		if !found {
			t.Errorf("class %q not found in loaded registry", name)
			continue
		}
		if loadedID != origID {
			t.Errorf("class %q: expected id %q, got %q", name, origID, loadedID)
		}
		if loadedSource != origSource {
			t.Errorf("class %q: expected source %q, got %q", name, origSource, loadedSource)
		}
	}

	// Verify counts match
	origStats := r.Stats()
	loadedStats := loaded.Stats()
	if origStats != loadedStats {
		t.Errorf("stats mismatch: orig %+v, loaded %+v", origStats, loadedStats)
	}
}
