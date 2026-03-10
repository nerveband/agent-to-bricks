package templates_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/templates"
	"github.com/nerveband/agent-to-bricks/internal/validator"
)

func testDataDir(t *testing.T) string {
	t.Helper()

	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve caller path")
	}

	root := filepath.Clean(filepath.Join(filepath.Dir(filename), "..", "..", ".."))
	return filepath.Join(root, "docs", "test-data")
}

func requireTemplateCorpus(t *testing.T) string {
	t.Helper()

	dir := filepath.Join(testDataDir(t), "templates")
	if _, err := os.Stat(dir); err != nil {
		if os.IsNotExist(err) {
			t.Skip("template corpus not present under docs/test-data/templates")
		}
		t.Fatalf("failed to stat template corpus: %v", err)
	}

	return dir
}

type catalogEntry struct {
	Category string `json:"category"`
}

func loadCatalogEntries(t *testing.T, root string) []catalogEntry {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(root, "catalog.json"))
	if err != nil {
		t.Fatalf("failed to read catalog.json: %v", err)
	}

	var entries []catalogEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		t.Fatalf("failed to parse catalog.json: %v", err)
	}

	return entries
}

func gatherTemplateCorpusMetadata(t *testing.T, root string) (loadableCount int, categories map[string]bool) {
	t.Helper()

	categories = map[string]bool{}
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			rel, relErr := filepath.Rel(root, path)
			if relErr == nil && rel != "." {
				categories[filepath.Base(path)] = true
			}
			return nil
		}
		if !strings.HasSuffix(info.Name(), ".json") || info.Name() == "catalog.json" {
			return nil
		}

		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}

		var raw map[string]interface{}
		if unmarshalErr := json.Unmarshal(data, &raw); unmarshalErr != nil {
			return unmarshalErr
		}

		loadableCount++
		return nil
	})
	if err != nil {
		t.Fatalf("failed to scan template corpus: %v", err)
	}

	return loadableCount, categories
}

func pickTemplateByCategory(t *testing.T, cat *templates.Catalog, category string) *templates.Template {
	t.Helper()

	names := cat.List()
	sort.Strings(names)
	for _, name := range names {
		tmpl := cat.Get(name)
		if tmpl != nil && tmpl.Category == category {
			return tmpl
		}
	}
	t.Fatalf("no template found for category %q", category)
	return nil
}

func toValidatorElements(elements []map[string]interface{}) []validator.Element {
	result := make([]validator.Element, 0, len(elements))
	for _, el := range elements {
		result = append(result, validator.Element(el))
	}
	return result
}

func TestLoadTemplateCorpus(t *testing.T) {
	root := requireTemplateCorpus(t)

	entries := loadCatalogEntries(t, root)
	loadableCount, _ := gatherTemplateCorpusMetadata(t, root)

	cat := templates.NewCatalog()
	if err := cat.LoadDir(root); err != nil {
		t.Fatalf("failed to load template corpus: %v", err)
	}

	if cat.Count() != loadableCount {
		t.Fatalf("loaded %d templates, want %d", cat.Count(), loadableCount)
	}

	seenCategories := map[string]bool{}
	var blankCategory []string
	withClasses := 0
	for _, name := range cat.List() {
		tmpl := cat.Get(name)
		if tmpl == nil {
			t.Fatalf("template %q missing after load", name)
		}
		if tmpl.Name == "" {
			t.Fatalf("template %q has empty name", name)
		}
		if tmpl.Category == "" {
			blankCategory = append(blankCategory, tmpl.Name)
			continue
		}
		if tmpl.Category == "templates" {
			continue
		}
		if len(tmpl.Elements) == 0 {
			t.Fatalf("template %q has no elements", tmpl.Name)
		}
		seenCategories[tmpl.Category] = true
		if len(tmpl.GlobalClasses) > 0 {
			withClasses++
		}
	}

	expectedCategories := len(entriesToCategorySet(entries))
	if len(seenCategories) != expectedCategories {
		t.Fatalf("loaded %d categories, want %d", len(seenCategories), expectedCategories)
	}
	sort.Strings(blankCategory)
	if strings.Join(blankCategory, ",") != "gallery-bravo,slider-section-basel-import" {
		t.Fatalf("unexpected blank-category templates: %v", blankCategory)
	}
	if withClasses == 0 {
		t.Fatal("expected at least one corpus template to carry global classes")
	}

	hero := cat.Get("Hero Cali")
	if hero == nil {
		t.Fatal("expected Hero Cali to be present in corpus")
	}
	if hero.Category != "hero" {
		t.Fatalf("Hero Cali category = %q, want %q", hero.Category, "hero")
	}
	if len(hero.GlobalClasses) == 0 {
		t.Fatal("expected Hero Cali to include global classes from Frames export")
	}

	if _, ok := seenCategories["feature-section"]; !ok {
		t.Fatal("expected feature-section category to be present in loaded corpus")
	}

	if loadableCount != len(entries)+1 {
		t.Fatalf("loadable corpus count = %d, want catalog entry count + supplemental root export = %d", loadableCount, len(entries)+1)
	}
}

func entriesToCategorySet(entries []catalogEntry) map[string]bool {
	set := map[string]bool{}
	for _, entry := range entries {
		set[entry.Category] = true
	}
	return set
}

func TestComposeRepresentativeCorpusTemplates(t *testing.T) {
	root := requireTemplateCorpus(t)

	cat := templates.NewCatalog()
	if err := cat.LoadDir(root); err != nil {
		t.Fatalf("failed to load template corpus: %v", err)
	}

	selected := []*templates.Template{
		pickTemplateByCategory(t, cat, "hero"),
		pickTemplateByCategory(t, cat, "feature-section"),
		pickTemplateByCategory(t, cat, "footer"),
	}

	result, err := templates.ComposeWithClasses(selected)
	if err != nil {
		t.Fatalf("compose failed: %v", err)
	}

	if len(result.Elements) == 0 {
		t.Fatal("expected composed elements")
	}
	if len(result.GlobalClasses) == 0 {
		t.Fatal("expected composed global classes")
	}

	validation := validator.Validate(toValidatorElements(result.Elements))
	if !validation.Valid {
		t.Fatalf("composed corpus templates invalid: %v", validation.Errors)
	}

	ids := map[string]bool{}
	for _, el := range result.Elements {
		id, _ := el["id"].(string)
		if id == "" {
			t.Fatalf("composed element missing id: %+v", el)
		}
		if ids[id] {
			t.Fatalf("duplicate composed id: %s", id)
		}
		ids[id] = true
	}
}
