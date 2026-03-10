package convert_test

import (
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/convert"
	"github.com/nerveband/agent-to-bricks/internal/validator"
)

func toValidatorElements(elements []map[string]interface{}) []validator.Element {
	result := make([]validator.Element, 0, len(elements))
	for _, el := range elements {
		result = append(result, validator.Element(el))
	}
	return result
}

func fixtureTestDataDir(t *testing.T) string {
	t.Helper()

	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve caller path")
	}

	root := filepath.Clean(filepath.Join(filepath.Dir(filename), "..", "..", ".."))
	return filepath.Join(root, "docs", "test-data")
}

func collectHTMLFixtures(t *testing.T) []string {
	t.Helper()

	root := fixtureTestDataDir(t)
	if _, err := os.Stat(root); err != nil {
		if os.IsNotExist(err) {
			t.Skip("fixture corpus not present under docs/test-data")
		}
		t.Fatalf("failed to stat docs/test-data: %v", err)
	}

	var fixtures []string
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(strings.ToLower(info.Name()), ".html") {
			return nil
		}
		fixtures = append(fixtures, path)
		return nil
	})
	if err != nil {
		t.Fatalf("failed to scan HTML fixtures: %v", err)
	}

	sort.Strings(fixtures)
	if len(fixtures) == 0 {
		t.Skip("no HTML fixtures found under docs/test-data")
	}
	return fixtures
}

func TestConvertHTMLFixtures(t *testing.T) {
	fixtures := collectHTMLFixtures(t)

	for _, fixture := range fixtures {
		fixture := fixture
		t.Run(filepath.Base(fixture), func(t *testing.T) {
			data, err := os.ReadFile(fixture)
			if err != nil {
				t.Fatalf("failed to read fixture: %v", err)
			}

			elements, err := convert.HTMLToBricks(string(data))
			if err != nil {
				t.Fatalf("failed to convert HTML fixture: %v", err)
			}
			if len(elements) == 0 {
				t.Fatal("expected at least one converted element")
			}

			rootElements := 0
			for _, el := range elements {
				switch parent := el["parent"].(type) {
				case string:
					if parent == "0" {
						rootElements++
					}
				case float64:
					if parent == 0 {
						rootElements++
					}
				}
			}
			if rootElements == 0 {
				t.Fatal("expected at least one root-level element")
			}

			result := validator.Validate(toValidatorElements(elements))
			if !result.Valid {
				t.Fatalf("converted fixture invalid: %v", result.Errors)
			}
		})
	}
}
