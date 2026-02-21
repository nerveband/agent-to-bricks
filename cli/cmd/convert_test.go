package cmd

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/config"
	"github.com/nerveband/agent-to-bricks/internal/convert"
)

// --- Unit tests for configDir() ---

func TestConfigDir(t *testing.T) {
	dir := configDir()
	home, _ := os.UserHomeDir()
	expected := filepath.Join(home, ".agent-to-bricks")
	if dir != expected {
		t.Errorf("configDir() = %q, want %q", dir, expected)
	}
}

// --- Tests for flag registration ---

func TestConvertHTMLCmd_FlagsRegistered(t *testing.T) {
	flags := []struct {
		name      string
		shorthand string
	}{
		{"output", "o"},
		{"push", ""},
		{"stdin", ""},
		{"class-cache", ""},
		{"snapshot", ""},
		{"dry-run", ""},
	}
	for _, f := range flags {
		t.Run(f.name, func(t *testing.T) {
			fl := convertHTMLCmd.Flags().Lookup(f.name)
			if fl == nil {
				t.Fatalf("flag %q not registered on convertHTMLCmd", f.name)
			}
			if f.shorthand != "" && fl.Shorthand != f.shorthand {
				t.Errorf("flag %q shorthand = %q, want %q", f.name, fl.Shorthand, f.shorthand)
			}
		})
	}
}

// --- Tests for HTML file conversion ---

func TestConvertHTML_FileInput(t *testing.T) {
	// Create a temp HTML file
	tmpDir := t.TempDir()
	htmlFile := filepath.Join(tmpDir, "test.html")
	os.WriteFile(htmlFile, []byte("<div><p>Hello</p></div>"), 0644)

	// Set up cfg with no site config (offline mode)
	cfg = &config.Config{}

	// Reset flags
	convertOutput = ""
	convertPush = 0
	convertStdin = false
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = false

	// Capture stdout
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{htmlFile})

	w.Close()
	os.Stdout = oldStdout
	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	// Parse the output JSON
	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("Failed to parse output JSON: %v\nOutput: %s", err, buf.String())
	}

	// Should have elements
	elements, ok := result["elements"].([]interface{})
	if !ok {
		t.Fatal("output missing 'elements' array")
	}
	if len(elements) == 0 {
		t.Error("expected at least one element")
	}

	// Should have count
	count, ok := result["count"].(float64)
	if !ok {
		t.Fatal("output missing 'count'")
	}
	if int(count) != len(elements) {
		t.Errorf("count = %d, want %d", int(count), len(elements))
	}
}

// --- Test --output flag ---

func TestConvertHTML_OutputFlag(t *testing.T) {
	tmpDir := t.TempDir()
	htmlFile := filepath.Join(tmpDir, "test.html")
	outFile := filepath.Join(tmpDir, "output.json")
	os.WriteFile(htmlFile, []byte("<div><p>Hello</p></div>"), 0644)

	cfg = &config.Config{}

	convertOutput = outFile
	convertPush = 0
	convertStdin = false
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = false

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{htmlFile})
	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	// Check output file exists
	data, err := os.ReadFile(outFile)
	if err != nil {
		t.Fatalf("failed to read output file: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("output file is not valid JSON: %v", err)
	}

	if _, ok := result["elements"]; !ok {
		t.Error("output file missing 'elements'")
	}

	// Reset
	convertOutput = ""
}

// --- Test --stdin flag ---

func TestConvertHTML_StdinInput(t *testing.T) {
	cfg = &config.Config{}

	convertOutput = ""
	convertPush = 0
	convertStdin = true
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = false

	// Replace stdin
	oldStdin := os.Stdin
	r, w, _ := os.Pipe()
	os.Stdin = r
	w.Write([]byte("<div><h1>From stdin</h1></div>"))
	w.Close()

	// Capture stdout
	oldStdout := os.Stdout
	rOut, wOut, _ := os.Pipe()
	os.Stdout = wOut

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{})

	wOut.Close()
	os.Stdout = oldStdout
	os.Stdin = oldStdin

	var buf bytes.Buffer
	io.Copy(&buf, rOut)

	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("Failed to parse output: %v\nOutput: %s", err, buf.String())
	}

	elements, ok := result["elements"].([]interface{})
	if !ok || len(elements) == 0 {
		t.Error("expected elements from stdin input")
	}

	// Reset
	convertStdin = false
}

// --- Test empty input ---

func TestConvertHTML_EmptyInput(t *testing.T) {
	cfg = &config.Config{}

	convertOutput = ""
	convertPush = 0
	convertStdin = true
	convertClassCache = false

	// Empty stdin
	oldStdin := os.Stdin
	r, w, _ := os.Pipe()
	os.Stdin = r
	w.Close() // immediate EOF = empty input

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{})

	os.Stdin = oldStdin

	if err == nil {
		t.Fatal("expected error for empty input, got nil")
	}
	if !strings.Contains(err.Error(), "no HTML input") {
		t.Errorf("expected 'no HTML input' error, got: %v", err)
	}

	// Reset
	convertStdin = false
}

// --- Test no args and no --stdin reads from stdin ---

func TestConvertHTML_NoArgsReadsStdin(t *testing.T) {
	cfg = &config.Config{}

	convertOutput = ""
	convertPush = 0
	convertStdin = false // not explicitly set, but no args either
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = false

	oldStdin := os.Stdin
	r, w, _ := os.Pipe()
	os.Stdin = r
	w.Write([]byte("<p>implicit stdin</p>"))
	w.Close()

	oldStdout := os.Stdout
	rOut, wOut, _ := os.Pipe()
	os.Stdout = wOut

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{})

	wOut.Close()
	os.Stdout = oldStdout
	os.Stdin = oldStdin

	var buf bytes.Buffer
	io.Copy(&buf, rOut)

	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("Failed to parse output: %v", err)
	}

	if _, ok := result["elements"]; !ok {
		t.Error("expected elements from implicit stdin")
	}
}

// --- Test --dry-run prevents push ---

func TestConvertHTML_DryRunPreventsPush(t *testing.T) {
	// Start a mock server that should NOT be called for push
	pushCalled := false
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && strings.Contains(r.URL.Path, "/elements") {
			pushCalled = true
		}
		if strings.Contains(r.URL.Path, "/classes") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"classes": []interface{}{},
				"count":   0,
				"total":   0,
			})
			return
		}
		w.WriteHeader(200)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "abc",
			"count":       1,
		})
	}))
	defer ts.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{
			URL:    ts.URL,
			APIKey: "test-key",
		},
	}

	tmpDir := t.TempDir()
	htmlFile := filepath.Join(tmpDir, "test.html")
	os.WriteFile(htmlFile, []byte("<div>Test</div>"), 0644)

	convertOutput = ""
	convertPush = 42
	convertStdin = false
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = true

	// Capture stdout
	oldStdout := os.Stdout
	rOut, wOut, _ := os.Pipe()
	os.Stdout = wOut

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{htmlFile})

	wOut.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, rOut)

	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	if pushCalled {
		t.Error("--dry-run should prevent push, but ReplaceElements was called")
	}

	// With --dry-run, the JSON output should be printed to stdout
	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("expected JSON output in dry-run mode: %v", err)
	}

	// Reset
	convertPush = 0
	convertDryRun = false
}

// --- Test --push with mock server ---

func TestConvertHTML_PushToPage(t *testing.T) {
	var pushCalled bool
	var pushedElements []interface{}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/classes"):
			json.NewEncoder(w).Encode(map[string]interface{}{
				"classes": []interface{}{},
				"count":   0,
				"total":   0,
			})
		case r.Method == "PUT" && strings.Contains(r.URL.Path, "/elements"):
			pushCalled = true
			body, _ := io.ReadAll(r.Body)
			var payload map[string]interface{}
			json.Unmarshal(body, &payload)
			pushedElements, _ = payload["elements"].([]interface{})
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":     true,
				"contentHash": "abc123",
				"count":       len(pushedElements),
			})
		default:
			w.WriteHeader(404)
		}
	}))
	defer ts.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{
			URL:    ts.URL,
			APIKey: "test-key",
		},
	}

	tmpDir := t.TempDir()
	htmlFile := filepath.Join(tmpDir, "test.html")
	os.WriteFile(htmlFile, []byte("<div><p>Push test</p></div>"), 0644)

	convertOutput = ""
	convertPush = 99
	convertStdin = false
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = false

	// Suppress stdout (output goes to stderr in push mode)
	oldStdout := os.Stdout
	os.Stdout, _ = os.Open(os.DevNull)
	defer func() { os.Stdout = oldStdout }()

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{htmlFile})
	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	if !pushCalled {
		t.Error("expected ReplaceElements to be called")
	}
	if len(pushedElements) == 0 {
		t.Error("expected pushed elements to be non-empty")
	}

	// Reset
	convertPush = 0
}

// --- Test --snapshot before push ---

func TestConvertHTML_SnapshotBeforePush(t *testing.T) {
	var snapshotCalled bool
	var snapshotPageID string

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/classes"):
			json.NewEncoder(w).Encode(map[string]interface{}{
				"classes": []interface{}{},
				"count":   0,
				"total":   0,
			})
		case r.Method == "POST" && strings.Contains(r.URL.Path, "/snapshots"):
			snapshotCalled = true
			parts := strings.Split(r.URL.Path, "/")
			// URL path: /wp-json/agent-bricks/v1/pages/55/snapshots
			for i, p := range parts {
				if p == "pages" && i+1 < len(parts) {
					snapshotPageID = parts[i+1]
					break
				}
			}
			json.NewEncoder(w).Encode(map[string]interface{}{
				"snapshotId":  "snap-123",
				"contentHash": "hash-before",
				"label":       "Pre-convert backup",
			})
		case r.Method == "PUT" && strings.Contains(r.URL.Path, "/elements"):
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":     true,
				"contentHash": "hash-after",
				"count":       1,
			})
		default:
			w.WriteHeader(404)
		}
	}))
	defer ts.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{
			URL:    ts.URL,
			APIKey: "test-key",
		},
	}

	tmpDir := t.TempDir()
	htmlFile := filepath.Join(tmpDir, "test.html")
	os.WriteFile(htmlFile, []byte("<div>Snapshot test</div>"), 0644)

	convertOutput = ""
	convertPush = 55
	convertStdin = false
	convertClassCache = false
	convertSnapshot = true
	convertDryRun = false

	oldStdout := os.Stdout
	os.Stdout, _ = os.Open(os.DevNull)
	defer func() { os.Stdout = oldStdout }()

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{htmlFile})
	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	if !snapshotCalled {
		t.Error("expected snapshot to be created before push")
	}
	if snapshotPageID != "55" {
		t.Errorf("snapshot page ID = %q, want %q", snapshotPageID, "55")
	}

	// Reset
	convertPush = 0
	convertSnapshot = false
}

// --- Test --class-cache loads from file ---

func TestConvertHTML_ClassCacheFlag(t *testing.T) {
	// Create a cached registry file and verify round-trip
	tmpDir := t.TempDir()

	reg := convert.NewClassRegistry()
	reg.Add("test-class", "cls-001", "acss")
	reg.Add("frame-class", "cls-002", "frames")

	cachePath := filepath.Join(tmpDir, "class-registry.json")
	if err := reg.SaveToFile(cachePath, "https://example.com"); err != nil {
		t.Fatalf("failed to save registry: %v", err)
	}

	// Load it back
	loaded, err := convert.LoadRegistryFromFile(cachePath)
	if err != nil {
		t.Fatalf("failed to load registry: %v", err)
	}

	stats := loaded.Stats()
	if stats.Total != 2 {
		t.Errorf("loaded registry total = %d, want 2", stats.Total)
	}
	if stats.ACSS != 1 {
		t.Errorf("loaded registry ACSS = %d, want 1", stats.ACSS)
	}
	if stats.Frames != 1 {
		t.Errorf("loaded registry Frames = %d, want 1", stats.Frames)
	}
}

// --- Test conversion with class registry ---

func TestConvertHTML_WithClassRegistry(t *testing.T) {
	// Set up a mock server that returns classes
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/classes") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"classes": []interface{}{
					map[string]interface{}{"id": "acss_import_1", "name": "mt-m"},
					map[string]interface{}{"id": "frames-btn", "name": "btn-primary"},
				},
				"count": 2,
				"total": 2,
			})
			return
		}
		w.WriteHeader(404)
	}))
	defer ts.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{
			URL:    ts.URL,
			APIKey: "test-key",
		},
	}

	tmpDir := t.TempDir()
	htmlFile := filepath.Join(tmpDir, "test.html")
	os.WriteFile(htmlFile, []byte(`<div class="mt-m btn-primary unknown-class">Hello</div>`), 0644)

	convertOutput = ""
	convertPush = 0
	convertStdin = false
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = false

	// Capture stdout
	oldStdout := os.Stdout
	rOut, wOut, _ := os.Pipe()
	os.Stdout = wOut

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{htmlFile})

	wOut.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, rOut)

	if err != nil {
		t.Fatalf("RunE returned error: %v\nOutput: %s", err, buf.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("Failed to parse output: %v\nOutput: %s", err, buf.String())
	}

	elements, _ := result["elements"].([]interface{})
	if len(elements) == 0 {
		t.Fatal("expected at least one element")
	}

	// Check the first (div) element has _cssGlobalClasses and _cssClasses
	el := elements[0].(map[string]interface{})
	settings, _ := el["settings"].(map[string]interface{})

	globalClasses, ok := settings["_cssGlobalClasses"].([]interface{})
	if !ok {
		t.Fatal("expected _cssGlobalClasses in settings")
	}
	if len(globalClasses) != 2 {
		t.Errorf("_cssGlobalClasses length = %d, want 2", len(globalClasses))
	}

	cssClasses, ok := settings["_cssClasses"].(string)
	if !ok {
		t.Fatal("expected _cssClasses in settings")
	}
	if cssClasses != "unknown-class" {
		t.Errorf("_cssClasses = %q, want %q", cssClasses, "unknown-class")
	}
}

// --- Test --push requires config ---

func TestConvertHTML_PushRequiresConfig(t *testing.T) {
	cfg = &config.Config{} // no site URL or API key

	tmpDir := t.TempDir()
	htmlFile := filepath.Join(tmpDir, "test.html")
	os.WriteFile(htmlFile, []byte("<div>Test</div>"), 0644)

	convertOutput = ""
	convertPush = 42
	convertStdin = false
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = false

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{htmlFile})

	if err == nil {
		t.Fatal("expected error when pushing without config")
	}
	if !strings.Contains(err.Error(), "not configured") {
		t.Errorf("expected config error, got: %v", err)
	}

	// Reset
	convertPush = 0
}

// --- Test nonexistent file ---

func TestConvertHTML_NonexistentFile(t *testing.T) {
	cfg = &config.Config{}

	convertOutput = ""
	convertPush = 0
	convertStdin = false

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{"/nonexistent/file.html"})
	if err == nil {
		t.Fatal("expected error for nonexistent file")
	}
	if !strings.Contains(err.Error(), "failed to read input") {
		t.Errorf("expected 'failed to read input' error, got: %v", err)
	}
}

// --- Test convertCmd is parent of convertHTMLCmd ---

func TestConvertCmd_HasHTMLSubcommand(t *testing.T) {
	found := false
	for _, sub := range convertCmd.Commands() {
		if sub.Name() == "html" {
			found = true
			break
		}
	}
	if !found {
		t.Error("convertCmd should have 'html' subcommand")
	}
}

// --- Test command metadata ---

func TestConvertHTMLCmd_Metadata(t *testing.T) {
	if convertHTMLCmd.Use != "html [file.html]" {
		t.Errorf("Use = %q, want %q", convertHTMLCmd.Use, "html [file.html]")
	}
	if convertHTMLCmd.Short == "" {
		t.Error("Short description should not be empty")
	}
	if convertHTMLCmd.Long == "" {
		t.Error("Long description should not be empty")
	}
}

// --- Test push does not output JSON to stdout (only stderr messages) ---

func TestConvertHTML_PushSuppressesStdout(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/classes"):
			json.NewEncoder(w).Encode(map[string]interface{}{
				"classes": []interface{}{},
				"count":   0,
				"total":   0,
			})
		case r.Method == "PUT" && strings.Contains(r.URL.Path, "/elements"):
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":     true,
				"contentHash": "abc",
				"count":       1,
			})
		default:
			w.WriteHeader(404)
		}
	}))
	defer ts.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{
			URL:    ts.URL,
			APIKey: "test-key",
		},
	}

	tmpDir := t.TempDir()
	htmlFile := filepath.Join(tmpDir, "test.html")
	os.WriteFile(htmlFile, []byte("<div>Test</div>"), 0644)

	convertOutput = ""
	convertPush = 1
	convertStdin = false
	convertClassCache = false
	convertSnapshot = false
	convertDryRun = false

	oldStdout := os.Stdout
	rOut, wOut, _ := os.Pipe()
	os.Stdout = wOut

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{htmlFile})

	wOut.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, rOut)

	if err != nil {
		t.Fatalf("RunE returned error: %v", err)
	}

	// When pushing (not dry-run, no --output), stdout should be empty
	if buf.Len() > 0 {
		t.Errorf("expected no stdout output when pushing, got: %s", buf.String())
	}

	// Reset
	convertPush = 0
}
