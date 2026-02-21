package client_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/client"
)

func TestGetElements(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/2005/elements" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("unexpected method: %s", r.Method)
		}
		// Check X-ATB-Key header
		if r.Header.Get("X-ATB-Key") != "atb_testkey" {
			w.WriteHeader(401)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elements":    []interface{}{},
			"contentHash": "abc123",
			"count":       0,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.GetElements(2005)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ContentHash != "abc123" {
		t.Errorf("expected hash abc123, got %s", resp.ContentHash)
	}
}

func TestGetSiteInfo(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/info" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("X-ATB-Key") != "atb_testkey" {
			w.WriteHeader(401)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"bricksVersion":  "2.2",
			"contentMetaKey": "_bricks_page_content_2",
			"elementTypes":   []string{"section", "heading"},
			"breakpoints":    []interface{}{},
			"pluginVersion":  "1.3.0",
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	info, err := c.GetSiteInfo()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.BricksVersion != "2.2" {
		t.Errorf("expected bricks 2.2, got %s", info.BricksVersion)
	}
	if len(info.ElementTypes) != 2 {
		t.Errorf("expected 2 element types, got %d", len(info.ElementTypes))
	}
}

func TestUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "bad_key")
	_, err := c.GetSiteInfo()
	if err == nil {
		t.Error("expected error for 401")
	}
}
