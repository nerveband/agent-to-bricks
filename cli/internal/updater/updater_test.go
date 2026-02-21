package updater

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetLatestRelease(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/nerveband/agent-to-bricks/releases/latest" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"tag_name":     "v1.4.0",
			"published_at": "2026-02-21T00:00:00Z",
			"body":         "- Added auto-update\n- Fixed bugs",
			"assets": []map[string]interface{}{
				{"name": "agent-to-bricks_1.4.0_darwin_arm64.tar.gz", "browser_download_url": "https://example.com/darwin_arm64.tar.gz"},
				{"name": "agent-to-bricks-plugin-1.4.0.zip", "browser_download_url": "https://example.com/plugin.zip"},
			},
		})
	}))
	defer server.Close()

	u := New("1.3.0", server.URL+"/repos/nerveband/agent-to-bricks")
	rel, err := u.GetLatestRelease()
	if err != nil {
		t.Fatal(err)
	}
	if rel.Version != "1.4.0" {
		t.Errorf("expected 1.4.0, got %s", rel.Version)
	}
	if rel.HasUpdate("1.3.0") != true {
		t.Error("expected update available")
	}
	if rel.HasUpdate("1.4.0") != false {
		t.Error("expected no update for same version")
	}
}

func TestFindAsset(t *testing.T) {
	rel := &Release{
		Version: "1.4.0",
		Assets: []Asset{
			{Name: "agent-to-bricks_1.4.0_darwin_arm64.tar.gz", URL: "https://example.com/a"},
			{Name: "agent-to-bricks_1.4.0_linux_amd64.tar.gz", URL: "https://example.com/b"},
			{Name: "agent-to-bricks-plugin-1.4.0.zip", URL: "https://example.com/c"},
		},
	}
	asset := rel.FindCLIAsset("darwin", "arm64")
	if asset == nil || asset.URL != "https://example.com/a" {
		t.Error("expected darwin arm64 asset")
	}
	plugin := rel.FindPluginAsset()
	if plugin == nil || plugin.URL != "https://example.com/c" {
		t.Error("expected plugin asset")
	}
	missing := rel.FindCLIAsset("freebsd", "riscv")
	if missing != nil {
		t.Error("expected nil for unsupported platform")
	}
}

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"1.3.0", "1.4.0", -1},
		{"1.4.0", "1.4.0", 0},
		{"1.4.0", "1.3.0", 1},
		{"2.0.0", "1.9.9", 1},
	}
	for _, tt := range tests {
		got := CompareVersions(tt.a, tt.b)
		if got != tt.want {
			t.Errorf("CompareVersions(%s, %s) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestMajorMinorMatch(t *testing.T) {
	if !MajorMinorMatch("1.4.0", "1.4.2") {
		t.Error("1.4.0 and 1.4.2 should match")
	}
	if MajorMinorMatch("1.4.0", "1.3.0") {
		t.Error("1.4.0 and 1.3.0 should not match")
	}
	if MajorMinorMatch("2.0.0", "1.4.0") {
		t.Error("2.0.0 and 1.4.0 should not match")
	}
}
