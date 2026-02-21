package framework_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/framework"
)

func TestNewRegistryLoadsACSS(t *testing.T) {
	reg, err := framework.NewRegistry()
	if err != nil {
		t.Fatalf("failed to create registry: %v", err)
	}

	acss := reg.Get("acss")
	if acss == nil {
		t.Fatal("ACSS not found in registry")
	}
	if acss.Name != "Automatic.css" {
		t.Errorf("expected 'Automatic.css', got '%s'", acss.Name)
	}
}

func TestListFrameworks(t *testing.T) {
	reg, _ := framework.NewRegistry()
	ids := reg.List()
	if len(ids) == 0 {
		t.Error("expected at least one framework")
	}
	found := false
	for _, id := range ids {
		if id == "acss" {
			found = true
		}
	}
	if !found {
		t.Error("acss not in framework list")
	}
}

func TestSpacingVariable(t *testing.T) {
	reg, _ := framework.NewRegistry()
	acss := reg.Get("acss")

	if v := acss.SpacingVariable("m"); v != "--space-m" {
		t.Errorf("expected --space-m, got %s", v)
	}
	if v := acss.SpacingVariable("xl"); v != "--space-xl" {
		t.Errorf("expected --space-xl, got %s", v)
	}
}

func TestButtonClass(t *testing.T) {
	reg, _ := framework.NewRegistry()
	acss := reg.Get("acss")

	if v := acss.ButtonClass("primary"); v != "btn--primary" {
		t.Errorf("expected btn--primary, got %s", v)
	}
	if v := acss.ButtonClass("accent"); v != "btn--accent" {
		t.Errorf("expected btn--accent, got %s", v)
	}
}

func TestBricksClassID(t *testing.T) {
	reg, _ := framework.NewRegistry()
	acss := reg.Get("acss")

	if v := acss.BricksClassID("btn--primary"); v != "acss_import_btn--primary" {
		t.Errorf("expected acss_import_btn--primary, got %s", v)
	}
}

func TestColorVariable(t *testing.T) {
	reg, _ := framework.NewRegistry()
	acss := reg.Get("acss")

	if v := acss.ColorVariable("primary"); v != "--primary" {
		t.Errorf("expected --primary, got %s", v)
	}
}

func TestColorShadeVariable(t *testing.T) {
	reg, _ := framework.NewRegistry()
	acss := reg.Get("acss")

	if v := acss.ColorShadeVariable("primary", "light"); v != "--primary-light" {
		t.Errorf("expected --primary-light, got %s", v)
	}
}

func TestAllUtilityClasses(t *testing.T) {
	reg, _ := framework.NewRegistry()
	acss := reg.Get("acss")

	classes := acss.AllUtilityClasses()
	if len(classes) == 0 {
		t.Error("expected utility classes")
	}
	// Check a known class exists
	found := false
	for _, c := range classes {
		if c == "text-center" {
			found = true
		}
	}
	if !found {
		t.Error("text-center not in utility classes")
	}
}

func TestAllVariables(t *testing.T) {
	reg, _ := framework.NewRegistry()
	acss := reg.Get("acss")

	vars := acss.AllVariables()
	if len(vars) == 0 {
		t.Error("expected variables")
	}
	if v, ok := vars["spacing.m"]; !ok || v != "--space-m" {
		t.Errorf("expected spacing.m = --space-m, got %s (ok=%v)", v, ok)
	}
	if _, ok := vars["color.primary"]; !ok {
		t.Error("expected color.primary variable")
	}
}

func TestLoadFromDir(t *testing.T) {
	reg, _ := framework.NewRegistry()

	// Create a temp dir with a custom framework
	dir := t.TempDir()
	custom := `{"name":"CustomCSS","id":"custom","version":"1.0","spacing":{"variables":{"m":"--custom-m"}}}`
	os.WriteFile(filepath.Join(dir, "custom.json"), []byte(custom), 0644)

	err := reg.LoadFromDir(dir)
	if err != nil {
		t.Fatalf("failed to load from dir: %v", err)
	}

	fw := reg.Get("custom")
	if fw == nil {
		t.Fatal("custom framework not found")
	}
	if fw.SpacingVariable("m") != "--custom-m" {
		t.Errorf("expected --custom-m, got %s", fw.SpacingVariable("m"))
	}
}

func TestLoadFromNonexistentDir(t *testing.T) {
	reg, _ := framework.NewRegistry()
	err := reg.LoadFromDir("/nonexistent/path")
	if err != nil {
		t.Error("should not error on nonexistent dir")
	}
}
