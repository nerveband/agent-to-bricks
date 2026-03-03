package client

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetAbilities(t *testing.T) {
	// Mock the WP Abilities API response format (annotations inside meta)
	type apiAbility struct {
		Name         string                 `json:"name"`
		Label        string                 `json:"label"`
		Description  string                 `json:"description"`
		Category     string                 `json:"category"`
		Meta         AbilityMeta            `json:"meta"`
		InputSchema  map[string]interface{} `json:"input_schema"`
		OutputSchema map[string]interface{} `json:"output_schema"`
	}

	abilities := []apiAbility{
		{
			Name:        "agent-bricks/get-site-info",
			Label:       "Get Site Info",
			Description: "Returns Bricks version info",
			Category:    "agent-bricks-site",
			Meta:        AbilityMeta{Annotations: AbilityAnnotations{Readonly: true}},
			InputSchema: map[string]interface{}{},
			OutputSchema: map[string]interface{}{
				"type": "object",
			},
		},
		{
			Name:        "yoast/get-seo-meta",
			Label:       "Get SEO Meta",
			Description: "Returns SEO metadata for a post",
			Category:    "seo",
			Meta:        AbilityMeta{Annotations: AbilityAnnotations{Readonly: true}},
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"post_id": map[string]interface{}{"type": "integer"},
				},
			},
			OutputSchema: map[string]interface{}{
				"type": "object",
			},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/wp-abilities/v1/abilities" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("X-ATB-Key") != "test-key" {
			t.Error("missing X-ATB-Key header")
		}
		json.NewEncoder(w).Encode(abilities)
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key")
	result, err := c.GetAbilities("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 abilities, got %d", len(result))
	}
	if result[0].Name != "agent-bricks/get-site-info" {
		t.Errorf("expected agent-bricks/get-site-info, got %s", result[0].Name)
	}
	if !result[0].Annotations.Readonly {
		t.Error("expected readonly annotation (promoted from meta)")
	}
}

func TestGetAbilitiesWithCategory(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cat := r.URL.Query().Get("category")
		if cat != "agent-bricks-site" {
			t.Errorf("expected category filter, got %q", cat)
		}
		json.NewEncoder(w).Encode([]Ability{})
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key")
	_, err := c.GetAbilities("agent-bricks-site")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGetAbilitiesNotSupported(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
		w.Write([]byte(`{"code":"rest_no_route","message":"No route was found matching the URL"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key")
	result, err := c.GetAbilities("")
	if err != nil {
		t.Fatal("should not error on 404 — just return empty")
	}
	if len(result) != 0 {
		t.Errorf("expected empty result on 404, got %d", len(result))
	}
}

func TestGetAbilityCategories(t *testing.T) {
	cats := []AbilityCategory{
		{Slug: "agent-bricks-pages", Label: "Bricks Page Management", Description: "Read and manage pages"},
		{Slug: "seo", Label: "SEO", Description: "Search engine optimization"},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(cats)
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key")
	result, err := c.GetAbilityCategories()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 categories, got %d", len(result))
	}
}
