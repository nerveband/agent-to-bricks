package cmd

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/config"
	"github.com/nerveband/agent-to-bricks/internal/output"
)

func TestSitePush_JSONOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PUT" {
			t.Fatalf("expected PUT, got %s", r.Method)
		}
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/2005/elements" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("If-Match") != "oldhash" {
			t.Fatalf("expected If-Match oldhash, got %s", r.Header.Get("If-Match"))
		}
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if _, ok := body["elements"]; !ok {
			t.Fatalf("expected elements in request body, got %v", body)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "newhash",
			"count":       2,
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{
			URL:    server.URL,
			APIKey: "atb_testkey",
		},
	}
	output.Reset()
	defer output.Reset()
	_ = sitePushCmd.Flags().Set("format", "json")
	defer sitePushCmd.Flags().Set("format", "")

	tmpDir := t.TempDir()
	inputFile := filepath.Join(tmpDir, "push.json")
	data := []byte(`{"elements":[{"id":"e1","name":"heading"},{"id":"e2","name":"text-basic"}],"contentHash":"oldhash"}`)
	if err := os.WriteFile(inputFile, data, 0644); err != nil {
		t.Fatalf("failed to write input file: %v", err)
	}

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := sitePushCmd.RunE(sitePushCmd, []string{"2005", inputFile})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	_, _ = io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("failed to parse JSON output: %v\noutput: %s", err, buf.String())
	}
	if result["contentHash"] != "newhash" {
		t.Fatalf("expected contentHash=newhash, got %v", result["contentHash"])
	}
}

func TestSitePatch_JSONOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" {
			t.Fatalf("expected PATCH, got %s", r.Method)
		}
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/2005/elements" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("If-Match") != "oldhash" {
			t.Fatalf("expected If-Match oldhash, got %s", r.Header.Get("If-Match"))
		}
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if _, ok := body["patches"]; !ok {
			t.Fatalf("expected patches in request body, got %v", body)
		}
		if _, ok := body["elements"]; ok {
			t.Fatalf("expected request body to omit elements, got %v", body)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "patchedhash",
			"count":       1,
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{
			URL:    server.URL,
			APIKey: "atb_testkey",
		},
	}
	output.Reset()
	defer output.Reset()
	_ = sitePatchCmd.Flags().Set("format", "json")
	defer sitePatchCmd.Flags().Set("format", "")

	tmpDir := t.TempDir()
	inputFile := filepath.Join(tmpDir, "patch.json")
	data := []byte(`{"patches":[{"id":"e1","settings":{"text":"Updated"}}],"contentHash":"oldhash"}`)
	if err := os.WriteFile(inputFile, data, 0644); err != nil {
		t.Fatalf("failed to write input file: %v", err)
	}

	oldPatchFile := patchFile
	patchFile = inputFile
	defer func() { patchFile = oldPatchFile }()

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := sitePatchCmd.RunE(sitePatchCmd, []string{"2005"})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	_, _ = io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("failed to parse JSON output: %v\noutput: %s", err, buf.String())
	}
	if result["contentHash"] != "patchedhash" {
		t.Fatalf("expected contentHash=patchedhash, got %v", result["contentHash"])
	}
}
