package embeddings_test

import (
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/embeddings"
)

func TestIndexAndSearch(t *testing.T) {
	idx := embeddings.NewIndex()
	idx.Add("1", "hero-dark", "Dark hero section with CTA buttons", "hero", []string{"dark", "cta"})
	idx.Add("2", "feature-grid", "Feature grid with icons and descriptions", "features", []string{"grid", "icons"})
	idx.Add("3", "cta-banner", "Call to action banner with gradient background", "cta", []string{"cta", "gradient"})
	idx.Add("4", "footer-basic", "Simple footer with links and copyright", "footer", []string{"footer", "links"})

	if idx.Count() != 4 {
		t.Fatalf("expected 4 docs, got %d", idx.Count())
	}

	results := idx.Search("dark hero section", 10)
	if len(results) == 0 {
		t.Fatal("expected results for 'dark hero section'")
	}
	if results[0].ID != "1" {
		t.Errorf("expected hero-dark as top result, got %s", results[0].Name)
	}
}

func TestSearchCTA(t *testing.T) {
	idx := embeddings.NewIndex()
	idx.Add("1", "hero-dark", "Dark hero with CTA", "hero", []string{"dark", "cta"})
	idx.Add("2", "feature-grid", "Feature grid layout", "features", []string{"grid"})
	idx.Add("3", "cta-banner", "Call to action banner", "cta", []string{"cta", "action"})

	results := idx.Search("call to action", 10)
	if len(results) == 0 {
		t.Fatal("expected results")
	}
	// cta-banner should rank high for "call to action"
	found := false
	for _, r := range results {
		if r.ID == "3" {
			found = true
		}
	}
	if !found {
		t.Error("cta-banner should be in results for 'call to action'")
	}
}

func TestSearchNoResults(t *testing.T) {
	idx := embeddings.NewIndex()
	idx.Add("1", "hero", "Hero section", "hero", nil)

	results := idx.Search("xyznotaword", 10)
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestSearchLimit(t *testing.T) {
	idx := embeddings.NewIndex()
	for i := 0; i < 20; i++ {
		idx.Add("id", "dark section", "dark themed section", "hero", []string{"dark"})
	}

	results := idx.Search("dark", 5)
	if len(results) > 5 {
		t.Errorf("expected max 5 results, got %d", len(results))
	}
}

func TestSearchEmptyQuery(t *testing.T) {
	idx := embeddings.NewIndex()
	idx.Add("1", "hero", "Hero section", "hero", nil)

	results := idx.Search("", 10)
	if results != nil {
		t.Error("expected nil for empty query")
	}
}

func TestSearchRelevanceRanking(t *testing.T) {
	idx := embeddings.NewIndex()
	idx.Add("1", "hero-dark-gradient", "Dark hero section with gradient overlay and centered text", "hero", []string{"dark", "gradient", "hero"})
	idx.Add("2", "feature-card", "Feature cards with icons", "features", []string{"cards"})
	idx.Add("3", "hero-minimal", "Minimal hero with large heading", "hero", []string{"minimal", "hero"})

	results := idx.Search("hero", 10)
	if len(results) < 2 {
		t.Fatal("expected at least 2 results")
	}

	// Both hero templates should appear before feature-card
	heroResults := 0
	for i, r := range results {
		if r.ID == "1" || r.ID == "3" {
			heroResults++
			if i >= 2 {
				t.Error("hero templates should rank before non-hero")
			}
		}
	}
	if heroResults < 2 {
		t.Error("both hero templates should be in results")
	}
}
