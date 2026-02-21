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

func TestReplaceElements(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PUT" {
			t.Errorf("expected PUT, got %s", r.Method)
		}
		if r.Header.Get("If-Match") != "hash123" {
			t.Errorf("expected If-Match hash123, got %s", r.Header.Get("If-Match"))
		}
		if r.Header.Get("X-ATB-Key") != "atb_testkey" {
			w.WriteHeader(401)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "newhash",
			"count":       2,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	elements := []map[string]interface{}{
		{"id": "e1", "name": "heading"},
		{"id": "e2", "name": "text"},
	}
	resp, err := c.ReplaceElements(2005, elements, "hash123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Success {
		t.Error("expected success")
	}
	if resp.ContentHash != "newhash" {
		t.Errorf("expected newhash, got %s", resp.ContentHash)
	}
}

func TestPatchElements(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" {
			t.Errorf("expected PATCH, got %s", r.Method)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "patched",
			"count":       1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	patches := []map[string]interface{}{
		{"id": "e1", "settings": map[string]interface{}{"text": "Updated"}},
	}
	resp, err := c.PatchElements(2005, patches, "oldhash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ContentHash != "patched" {
		t.Errorf("expected patched, got %s", resp.ContentHash)
	}
}

func TestCreateSnapshot(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/2005/snapshots" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"snapshotId":  "snap_abc",
			"contentHash": "snaphash",
			"label":       "Before edit",
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.CreateSnapshot(2005, "Before edit")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.SnapshotID != "snap_abc" {
		t.Errorf("expected snap_abc, got %s", resp.SnapshotID)
	}
}

func TestRollback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/2005/snapshots/snap_abc/rollback" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "restored",
			"restored":    "snap_abc",
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.Rollback(2005, "snap_abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Success {
		t.Error("expected success")
	}
	if resp.ContentHash != "restored" {
		t.Errorf("expected restored, got %s", resp.ContentHash)
	}
}

func TestTriggerPluginUpdate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/update" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		if body["version"] != "1.4.0" {
			t.Errorf("expected version 1.4.0, got %s", body["version"])
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":         true,
			"version":         "1.4.0",
			"previousVersion": "1.3.0",
		})
	}))
	defer server.Close()

	c := client.New(server.URL, "test-key")
	result, err := c.TriggerPluginUpdate("1.4.0")
	if err != nil {
		t.Fatal(err)
	}
	if result.Version != "1.4.0" {
		t.Errorf("expected 1.4.0, got %s", result.Version)
	}
	if result.PreviousVersion != "1.3.0" {
		t.Errorf("expected 1.3.0, got %s", result.PreviousVersion)
	}
}
