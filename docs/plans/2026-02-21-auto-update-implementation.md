# Auto-Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lockstep versioning with a single `bricks update` command that self-updates the CLI binary and triggers the plugin to pull its own update from GitHub Releases.

**Architecture:** CLI checks GitHub Releases API (cached 24h). `bricks update` replaces the binary in-place, then calls `POST /site/update` to tell the plugin to upgrade itself via WordPress Plugin_Upgrader. Plugin adds `X-ATB-Version` header to all responses; CLI reads it and warns on mismatch.

**Tech Stack:** Go (CLI), PHP/WordPress (plugin), GitHub Releases API, GoReleaser

---

### Task 1: Updater core — GitHub release checker

**Files:**
- Create: `cli/internal/updater/updater.go`
- Create: `cli/internal/updater/updater_test.go`

**Step 1: Write the failing test**

```go
// cli/internal/updater/updater_test.go
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
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./internal/updater/ -v`
Expected: FAIL (package doesn't exist)

**Step 3: Write minimal implementation**

```go
// cli/internal/updater/updater.go
package updater

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Release represents a GitHub release.
type Release struct {
	Version     string    `json:"version"`
	TagName     string    `json:"tagName"`
	PublishedAt string    `json:"publishedAt"`
	Body        string    `json:"body"`
	Assets      []Asset   `json:"assets"`
}

// Asset is a downloadable file attached to a release.
type Asset struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// Updater checks GitHub for new releases.
type Updater struct {
	currentVersion string
	apiBase        string
	httpClient     *http.Client
}

// New creates an Updater. apiBase is like "https://api.github.com/repos/nerveband/agent-to-bricks".
func New(currentVersion, apiBase string) *Updater {
	return &Updater{
		currentVersion: strings.TrimPrefix(currentVersion, "v"),
		apiBase:        strings.TrimRight(apiBase, "/"),
		httpClient:     &http.Client{Timeout: 15 * time.Second},
	}
}

// GetLatestRelease fetches the latest release from GitHub.
func (u *Updater) GetLatestRelease() (*Release, error) {
	url := u.apiBase + "/releases/latest"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "agent-to-bricks-cli/"+u.currentVersion)

	resp, err := u.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("GitHub API returned %d", resp.StatusCode)
	}

	var gh struct {
		TagName     string `json:"tag_name"`
		PublishedAt string `json:"published_at"`
		Body        string `json:"body"`
		Assets      []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&gh); err != nil {
		return nil, err
	}

	rel := &Release{
		Version:     strings.TrimPrefix(gh.TagName, "v"),
		TagName:     gh.TagName,
		PublishedAt: gh.PublishedAt,
		Body:        gh.Body,
	}
	for _, a := range gh.Assets {
		rel.Assets = append(rel.Assets, Asset{Name: a.Name, URL: a.BrowserDownloadURL})
	}
	return rel, nil
}

// HasUpdate returns true if the release is newer than the given version.
func (r *Release) HasUpdate(currentVersion string) bool {
	return CompareVersions(strings.TrimPrefix(currentVersion, "v"), r.Version) < 0
}

// FindCLIAsset returns the CLI binary asset for the given OS and arch.
func (r *Release) FindCLIAsset(goos, goarch string) *Asset {
	pattern := fmt.Sprintf("agent-to-bricks_%s_%s_%s", r.Version, goos, goarch)
	for i := range r.Assets {
		if strings.HasPrefix(r.Assets[i].Name, pattern) {
			return &r.Assets[i]
		}
	}
	return nil
}

// FindPluginAsset returns the WordPress plugin zip asset.
func (r *Release) FindPluginAsset() *Asset {
	for i := range r.Assets {
		if strings.HasPrefix(r.Assets[i].Name, "agent-to-bricks-plugin-") && strings.HasSuffix(r.Assets[i].Name, ".zip") {
			return &r.Assets[i]
		}
	}
	return nil
}

// CompareVersions compares two semver strings. Returns -1, 0, or 1.
func CompareVersions(a, b string) int {
	pa := parseSemver(a)
	pb := parseSemver(b)
	for i := 0; i < 3; i++ {
		if pa[i] < pb[i] {
			return -1
		}
		if pa[i] > pb[i] {
			return 1
		}
	}
	return 0
}

// MajorMinorMatch returns true if two versions share the same major.minor.
func MajorMinorMatch(a, b string) bool {
	pa := parseSemver(a)
	pb := parseSemver(b)
	return pa[0] == pb[0] && pa[1] == pb[1]
}

func parseSemver(v string) [3]int {
	v = strings.TrimPrefix(v, "v")
	parts := strings.SplitN(v, ".", 3)
	var nums [3]int
	for i := 0; i < 3 && i < len(parts); i++ {
		n, _ := strconv.Atoi(parts[i])
		nums[i] = n
	}
	return nums
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./internal/updater/ -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add cli/internal/updater/
git commit -m "feat(cli): add updater core — GitHub release checker with semver comparison"
```

---

### Task 2: Update check cache

**Files:**
- Modify: `cli/internal/updater/updater.go`
- Modify: `cli/internal/updater/updater_test.go`

**Step 1: Write the failing test**

Add to `updater_test.go`:

```go
func TestCheckCache(t *testing.T) {
	dir := t.TempDir()
	cachePath := filepath.Join(dir, "update-check.json")

	cache := &CheckCache{Path: cachePath}

	// First check: no cache file, should need check
	if !cache.NeedsCheck() {
		t.Error("expected needs check when no cache file")
	}

	// Save a recent check
	cache.Save("1.4.0")

	// Should not need check now
	if cache.NeedsCheck() {
		t.Error("expected no check needed after save")
	}

	// Load and verify
	loaded := cache.Load()
	if loaded == nil || loaded.LatestVersion != "1.4.0" {
		t.Error("expected loaded cache with version 1.4.0")
	}
}
```

Add `"path/filepath"` to the test imports.

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./internal/updater/ -v -run TestCheckCache`
Expected: FAIL (CheckCache not defined)

**Step 3: Write minimal implementation**

Add to `updater.go`:

```go
import (
	// add to existing imports:
	"os"
	"path/filepath"
)

// CheckCache manages the local update check cache file.
type CheckCache struct {
	Path string
}

type checkCacheData struct {
	LatestVersion string `json:"latestVersion"`
	CheckedAt     int64  `json:"checkedAt"`
	TTLHours      int    `json:"ttlHours"`
}

// DefaultCachePath returns ~/.agent-to-bricks/update-check.json.
func DefaultCachePath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".agent-to-bricks", "update-check.json")
}

// NeedsCheck returns true if the cache is missing or expired (24h TTL).
func (c *CheckCache) NeedsCheck() bool {
	data := c.Load()
	if data == nil {
		return true
	}
	age := time.Now().Unix() - data.CheckedAt
	ttl := int64(24 * 3600)
	if data.TTLHours > 0 {
		ttl = int64(data.TTLHours) * 3600
	}
	return age > ttl
}

// Load reads the cache file. Returns nil if missing or invalid.
func (c *CheckCache) Load() *checkCacheData {
	raw, err := os.ReadFile(c.Path)
	if err != nil {
		return nil
	}
	var data checkCacheData
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil
	}
	return &data
}

// Save writes the latest version and current timestamp to cache.
func (c *CheckCache) Save(latestVersion string) error {
	data := checkCacheData{
		LatestVersion: latestVersion,
		CheckedAt:     time.Now().Unix(),
		TTLHours:      24,
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	os.MkdirAll(filepath.Dir(c.Path), 0755)
	return os.WriteFile(c.Path, raw, 0644)
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./internal/updater/ -v`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add cli/internal/updater/
git commit -m "feat(cli): add update check cache with 24h TTL"
```

---

### Task 3: CLI self-update (binary replacement)

**Files:**
- Modify: `cli/internal/updater/updater.go`
- Create: `cli/internal/updater/selfupdate.go`
- Create: `cli/internal/updater/selfupdate_test.go`

**Step 1: Write the failing test**

```go
// cli/internal/updater/selfupdate_test.go
package updater

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestSelfUpdate(t *testing.T) {
	// Create a fake "binary" tar.gz
	// We just need to test the download + extract + replace logic
	// For unit testing, we mock the server and verify the flow

	fakeContent := []byte("#!/bin/sh\necho updated")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(fakeContent)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	destPath := filepath.Join(tmpDir, "bricks")
	os.WriteFile(destPath, []byte("old binary"), 0755)

	err := DownloadFile(server.URL+"/test.tar.gz", destPath)
	if err != nil {
		t.Fatal(err)
	}

	data, _ := os.ReadFile(destPath)
	if string(data) != string(fakeContent) {
		t.Errorf("expected updated content, got %s", string(data))
	}
}

func TestDetectPlatform(t *testing.T) {
	goos, goarch := DetectPlatform()
	if goos != runtime.GOOS {
		t.Errorf("expected %s, got %s", runtime.GOOS, goos)
	}
	if goarch != runtime.GOARCH {
		t.Errorf("expected %s, got %s", runtime.GOARCH, goarch)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./internal/updater/ -v -run TestSelf`
Expected: FAIL (DownloadFile, DetectPlatform not defined)

**Step 3: Write minimal implementation**

```go
// cli/internal/updater/selfupdate.go
package updater

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// DetectPlatform returns the current OS and architecture.
func DetectPlatform() (string, string) {
	return runtime.GOOS, runtime.GOARCH
}

// CurrentBinaryPath returns the path of the running binary.
func CurrentBinaryPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(exe)
}

// DownloadFile downloads a URL to a local path, overwriting it.
// If the URL ends in .tar.gz, it extracts the first file from the archive.
// If the URL ends in .zip, it extracts the first file.
// Otherwise it writes the raw bytes.
func DownloadFile(url, destPath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	if strings.HasSuffix(url, ".tar.gz") || strings.HasSuffix(url, ".tgz") {
		return extractTarGz(resp.Body, destPath)
	}

	// Raw download
	return writeToFile(resp.Body, destPath)
}

func extractTarGz(r io.Reader, destPath string) error {
	gz, err := gzip.NewReader(r)
	if err != nil {
		// Not actually gzipped — treat as raw file
		return writeToFile(r, destPath)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		// Extract the binary (skip directories)
		if header.Typeflag == tar.TypeReg {
			name := filepath.Base(header.Name)
			if name == "bricks" || strings.HasPrefix(name, "bricks") {
				return writeToFile(tr, destPath)
			}
		}
	}
	return fmt.Errorf("no bricks binary found in archive")
}

func writeToFile(r io.Reader, destPath string) error {
	tmpPath := destPath + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}

	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}
	f.Close()

	// Atomic rename
	return os.Rename(tmpPath, destPath)
}

// SelfUpdate downloads a new CLI binary and replaces the current one.
func SelfUpdate(downloadURL string) error {
	binPath, err := CurrentBinaryPath()
	if err != nil {
		return fmt.Errorf("cannot determine binary path: %w", err)
	}
	return DownloadFile(downloadURL, binPath)
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./internal/updater/ -v`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add cli/internal/updater/
git commit -m "feat(cli): add self-update — download, extract, replace binary"
```

---

### Task 4: `bricks version` command

**Files:**
- Create: `cli/cmd/version.go`
- Create: `cli/cmd/version_test.go`
- Modify: `cli/cmd/root.go:23-25` (expose version string)
- Modify: `cli/main.go:9` (export version var)

**Step 1: Write the failing test**

```go
// cli/cmd/version_test.go
package cmd

import "testing"

func TestVersionCommandExists(t *testing.T) {
	found := false
	for _, c := range rootCmd.Commands() {
		if c.Use == "version" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'version' subcommand on root")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./cmd/ -v -run TestVersionCommand`
Expected: FAIL (no version subcommand)

**Step 3: Write minimal implementation**

First, modify `cli/cmd/root.go` to store and expose version parts:

```go
// Add to the var block at line 11-14:
var (
	cfgFile    string
	cfg        *config.Config
	cliVersion string
	cliCommit  string
	cliDate    string
)

// Modify SetVersion at line 23:
func SetVersion(version, commit, date string) {
	cliVersion = version
	cliCommit = commit
	cliDate = date
	rootCmd.Version = fmt.Sprintf("%s (commit: %s, built: %s)", version, commit, date)
}
```

Then create `cli/cmd/version.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/nerveband/agent-to-bricks/internal/updater"
	"github.com/spf13/cobra"
)

var versionChangelog bool

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show CLI and plugin versions",
	RunE: func(cmd *cobra.Command, args []string) error {
		if versionChangelog {
			return showChangelog()
		}
		return showVersion()
	},
}

func showVersion() error {
	fmt.Printf("CLI:       v%s (commit: %s, built: %s)\n", cliVersion, cliCommit, cliDate)

	// Try to get plugin version
	if cfg.Site.URL != "" && cfg.Site.APIKey != "" {
		c := client.New(cfg.Site.URL, cfg.Site.APIKey)
		info, err := c.GetSiteInfo()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Plugin:    (unreachable: %v)\n", err)
		} else {
			fmt.Printf("Plugin:    v%s (on %s)\n", info.PluginVersion, cfg.Site.URL)

			// Sync status
			if updater.MajorMinorMatch(cliVersion, info.PluginVersion) {
				fmt.Println("Status:    in sync")
			} else {
				fmt.Println("Status:    VERSION MISMATCH — run: bricks update")
			}

			fmt.Println()
			fmt.Printf("Bricks:    %s\n", info.BricksVersion)
			fmt.Printf("WordPress: %s\n", info.WPVersion)
			fmt.Printf("PHP:       %s\n", info.PHPVersion)
		}
	} else {
		fmt.Println("Plugin:    (no site configured)")
	}

	return nil
}

func showChangelog() error {
	u := updater.New(cliVersion, "https://api.github.com/repos/nerveband/agent-to-bricks")

	// Fetch multiple releases for changelog
	req, err := http.NewRequest("GET", "https://api.github.com/repos/nerveband/agent-to-bricks/releases?per_page=10", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "agent-to-bricks-cli/"+cliVersion)
	_ = u // suppress unused warning

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch releases: %w", err)
	}
	defer resp.Body.Close()

	var releases []struct {
		TagName     string `json:"tag_name"`
		PublishedAt string `json:"published_at"`
		Body        string `json:"body"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return err
	}

	if len(releases) == 0 {
		fmt.Println("No releases found.")
		return nil
	}

	for _, r := range releases {
		date := r.PublishedAt
		if t, err := time.Parse(time.RFC3339, r.PublishedAt); err == nil {
			date = t.Format("2006-01-02")
		}
		fmt.Printf("%s (%s)\n", r.TagName, date)
		if r.Body != "" {
			for _, line := range strings.Split(strings.TrimSpace(r.Body), "\n") {
				fmt.Printf("  %s\n", line)
			}
		}
		fmt.Println()
	}
	return nil
}

func init() {
	versionCmd.Flags().BoolVar(&versionChangelog, "changelog", false, "show changelog from GitHub Releases")
	rootCmd.AddCommand(versionCmd)
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./cmd/ -v -run TestVersionCommand`
Expected: PASS

**Step 5: Commit**

```bash
git add cli/cmd/version.go cli/cmd/version_test.go cli/cmd/root.go
git commit -m "feat(cli): add 'bricks version' command with --changelog flag"
```

---

### Task 5: `bricks update` command

**Files:**
- Create: `cli/cmd/update.go`
- Create: `cli/cmd/update_test.go`

**Step 1: Write the failing test**

```go
// cli/cmd/update_test.go
package cmd

import "testing"

func TestUpdateCommandExists(t *testing.T) {
	found := false
	for _, c := range rootCmd.Commands() {
		if c.Use == "update" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'update' subcommand on root")
	}
}

func TestUpdateCommandFlags(t *testing.T) {
	for _, c := range rootCmd.Commands() {
		if c.Use == "update" {
			if c.Flags().Lookup("cli-only") == nil {
				t.Error("expected --cli-only flag")
			}
			if c.Flags().Lookup("check") == nil {
				t.Error("expected --check flag")
			}
			if c.Flags().Lookup("force") == nil {
				t.Error("expected --force flag")
			}
			return
		}
	}
	t.Error("update command not found")
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./cmd/ -v -run TestUpdateCommand`
Expected: FAIL

**Step 3: Write minimal implementation**

```go
// cli/cmd/update.go
package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/nerveband/agent-to-bricks/internal/updater"
	"github.com/spf13/cobra"
)

var (
	updateCLIOnly bool
	updateCheck   bool
	updateForce   bool
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update CLI and plugin to the latest version",
	Long: `Downloads the latest CLI binary from GitHub Releases and triggers
the WordPress plugin to self-update via the REST API.

Use --check to just check without installing.
Use --cli-only to skip the plugin update.
Use --force to re-download even if already on the latest version.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		u := updater.New(cliVersion, "https://api.github.com/repos/nerveband/agent-to-bricks")

		fmt.Fprintln(os.Stderr, "Checking for updates...")
		rel, err := u.GetLatestRelease()
		if err != nil {
			return fmt.Errorf("failed to check for updates: %w", err)
		}

		cliNeedsUpdate := rel.HasUpdate(cliVersion) || updateForce
		pluginVersion := ""
		pluginNeedsUpdate := false

		// Check plugin version if site is configured
		if cfg.Site.URL != "" && cfg.Site.APIKey != "" && !updateCLIOnly {
			c := client.New(cfg.Site.URL, cfg.Site.APIKey)
			info, err := c.GetSiteInfo()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Warning: could not reach plugin: %v\n", err)
			} else {
				pluginVersion = info.PluginVersion
				pluginNeedsUpdate = rel.HasUpdate(pluginVersion) || updateForce
			}
		}

		// Report status
		fmt.Fprintf(os.Stderr, "  Latest: v%s", rel.Version)
		fmt.Fprintf(os.Stderr, "  (current CLI: v%s", cliVersion)
		if pluginVersion != "" {
			fmt.Fprintf(os.Stderr, ", plugin: v%s", pluginVersion)
		}
		fmt.Fprintln(os.Stderr, ")")
		fmt.Fprintln(os.Stderr)

		if !cliNeedsUpdate && !pluginNeedsUpdate {
			fmt.Fprintln(os.Stderr, "Already up to date.")
			return nil
		}

		if updateCheck {
			if cliNeedsUpdate {
				fmt.Fprintf(os.Stderr, "CLI update available: v%s -> v%s\n", cliVersion, rel.Version)
			}
			if pluginNeedsUpdate {
				fmt.Fprintf(os.Stderr, "Plugin update available: v%s -> v%s\n", pluginVersion, rel.Version)
			}
			fmt.Fprintln(os.Stderr, "\nRun 'bricks update' to install.")
			return nil
		}

		// Update CLI
		if cliNeedsUpdate {
			goos, goarch := updater.DetectPlatform()
			asset := rel.FindCLIAsset(goos, goarch)
			if asset == nil {
				return fmt.Errorf("no CLI binary found for %s/%s in release v%s", goos, goarch, rel.Version)
			}

			fmt.Fprintf(os.Stderr, "Updating CLI binary...")
			if err := updater.SelfUpdate(asset.URL); err != nil {
				return fmt.Errorf("CLI update failed: %w", err)
			}
			fmt.Fprintf(os.Stderr, "  done (v%s)\n", rel.Version)
		}

		// Update plugin
		if pluginNeedsUpdate && !updateCLIOnly {
			fmt.Fprintf(os.Stderr, "Updating plugin on %s...", cfg.Site.URL)
			c := client.New(cfg.Site.URL, cfg.Site.APIKey)
			result, err := c.TriggerPluginUpdate(rel.Version)
			if err != nil {
				fmt.Fprintf(os.Stderr, "\nPlugin update failed: %v\n", err)
				fmt.Fprintln(os.Stderr, "CLI was updated successfully. Retry with: bricks update")
				return nil
			}
			fmt.Fprintf(os.Stderr, "  done (v%s)\n", result.Version)
		}

		// Summary
		parts := []string{}
		if cliNeedsUpdate {
			parts = append(parts, "CLI")
		}
		if pluginNeedsUpdate && !updateCLIOnly {
			parts = append(parts, "plugin")
		}
		fmt.Fprintf(os.Stderr, "\n%s updated to v%s.\n", strings.Join(parts, " and "), rel.Version)

		// Update the cache
		cache := &updater.CheckCache{Path: updater.DefaultCachePath()}
		cache.Save(rel.Version)

		return nil
	},
}

func init() {
	updateCmd.Flags().BoolVar(&updateCLIOnly, "cli-only", false, "only update the CLI binary")
	updateCmd.Flags().BoolVar(&updateCheck, "check", false, "check for updates without installing")
	updateCmd.Flags().BoolVar(&updateForce, "force", false, "force update even if already on latest")
	rootCmd.AddCommand(updateCmd)
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./cmd/ -v -run TestUpdateCommand`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add cli/cmd/update.go cli/cmd/update_test.go
git commit -m "feat(cli): add 'bricks update' command with --cli-only, --check, --force"
```

---

### Task 6: Client — TriggerPluginUpdate method

**Files:**
- Modify: `cli/internal/client/client.go`
- Modify: `cli/internal/client/client_test.go`

**Step 1: Write the failing test**

Add to `client_test.go`:

```go
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

	c := New(server.URL, "test-key")
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
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./internal/client/ -v -run TestTriggerPluginUpdate`
Expected: FAIL (TriggerPluginUpdate not defined)

**Step 3: Write minimal implementation**

Add to `client.go`:

```go
// PluginUpdateResponse from POST /site/update.
type PluginUpdateResponse struct {
	Success         bool   `json:"success"`
	Version         string `json:"version"`
	PreviousVersion string `json:"previousVersion"`
	Error           string `json:"error,omitempty"`
}

// TriggerPluginUpdate tells the plugin to self-update to the given version.
func (c *Client) TriggerPluginUpdate(version string) (*PluginUpdateResponse, error) {
	payload, _ := json.Marshal(map[string]string{"version": version})
	resp, err := c.do("POST", "/site/update", strings.NewReader(string(payload)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result PluginUpdateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if !result.Success {
		return nil, fmt.Errorf("plugin update failed: %s", result.Error)
	}
	return &result, nil
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./internal/client/ -v -run TestTriggerPluginUpdate`
Expected: PASS

**Step 5: Commit**

```bash
git add cli/internal/client/
git commit -m "feat(cli): add TriggerPluginUpdate client method for POST /site/update"
```

---

### Task 7: Version mismatch middleware

**Files:**
- Modify: `cli/internal/client/client.go:54-77` (doWithHeaders)

**Step 1: Write the failing test**

Add to `client_test.go`:

```go
func TestVersionHeaderWarning(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-ATB-Version", "1.5.0")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"bricksVersion": "1.12", "pluginVersion": "1.5.0",
			"wpVersion": "6.7", "phpVersion": "8.2",
		})
	}))
	defer server.Close()

	c := New(server.URL, "test-key")
	c.SetCLIVersion("1.4.0")
	_, err := c.GetSiteInfo()
	if err != nil {
		t.Fatal(err)
	}
	// The warning was printed to stderr — we just verify no crash
	// and that the version was captured
	if c.LastPluginVersion() != "1.5.0" {
		t.Errorf("expected 1.5.0, got %s", c.LastPluginVersion())
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./internal/client/ -v -run TestVersionHeaderWarning`
Expected: FAIL (SetCLIVersion, LastPluginVersion not defined)

**Step 3: Write minimal implementation**

Modify the Client struct and doWithHeaders in `client.go`:

```go
// Add fields to Client struct:
type Client struct {
	baseURL           string
	apiKey            string
	httpClient        *http.Client
	cliVersion        string
	lastPluginVersion string
	versionWarned     bool
}

// Add methods:
func (c *Client) SetCLIVersion(v string) {
	c.cliVersion = strings.TrimPrefix(v, "v")
}

func (c *Client) LastPluginVersion() string {
	return c.lastPluginVersion
}
```

In `doWithHeaders`, after getting the response (before the status code check at line 71), add:

```go
	// Read plugin version header
	if pv := resp.Header.Get("X-ATB-Version"); pv != "" {
		c.lastPluginVersion = strings.TrimPrefix(pv, "v")
		c.checkVersionMismatch()
	}
```

Add the check method:

```go
func (c *Client) checkVersionMismatch() {
	if c.cliVersion == "" || c.lastPluginVersion == "" || c.versionWarned {
		return
	}
	cli := strings.TrimPrefix(c.cliVersion, "v")
	plugin := strings.TrimPrefix(c.lastPluginVersion, "v")
	if cli == plugin {
		return
	}
	c.versionWarned = true
	fmt.Fprintf(os.Stderr, "\n  Version mismatch: CLI v%s, plugin v%s. Run: bricks update\n\n", cli, plugin)
}
```

Add `"os"` to imports if not already present.

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./internal/client/ -v`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add cli/internal/client/
git commit -m "feat(cli): add version mismatch detection via X-ATB-Version header"
```

---

### Task 8: Startup update check (PersistentPreRun)

**Files:**
- Modify: `cli/cmd/root.go`

**Step 1: Write the failing test**

```go
// Add to an existing cmd test file or create cli/cmd/root_test.go
func TestRootHasPersistentPreRun(t *testing.T) {
	if rootCmd.PersistentPreRun == nil {
		t.Error("expected PersistentPreRun to be set for update check")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./cmd/ -v -run TestRootHasPersistentPreRun`
Expected: FAIL

**Step 3: Write minimal implementation**

Modify `cli/cmd/root.go` init() function to add a PersistentPreRun:

```go
func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default: ~/.agent-to-bricks/config.yaml)")
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentPreRun = func(cmd *cobra.Command, args []string) {
		// Skip update check for these commands
		name := cmd.Name()
		if name == "update" || name == "version" || name == "help" {
			return
		}

		cache := &updater.CheckCache{Path: updater.DefaultCachePath()}
		if !cache.NeedsCheck() {
			// Still show notice if cached version is newer
			data := cache.Load()
			if data != nil && data.LatestVersion != "" {
				cv := strings.TrimPrefix(cliVersion, "v")
				if updater.CompareVersions(cv, data.LatestVersion) < 0 {
					fmt.Fprintf(os.Stderr, "\n  Update available: v%s -> run: bricks update\n\n", data.LatestVersion)
				}
			}
			return
		}

		// Background-safe: don't block on network errors
		u := updater.New(cliVersion, "https://api.github.com/repos/nerveband/agent-to-bricks")
		rel, err := u.GetLatestRelease()
		if err != nil {
			// Silently fail — network might be down
			return
		}

		cache.Save(rel.Version)

		if rel.HasUpdate(cliVersion) {
			fmt.Fprintf(os.Stderr, "\n  Update available: v%s -> run: bricks update\n\n", rel.Version)
		}
	}
}
```

Add imports to root.go: `"strings"`, `"github.com/nerveband/agent-to-bricks/internal/updater"`.

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./cmd/ -v -run TestRootHasPersistentPreRun`
Expected: PASS

**Step 5: Commit**

```bash
git add cli/cmd/root.go
git commit -m "feat(cli): add startup update check with 24h cache"
```

---

### Task 9: Plugin — X-ATB-Version response header

**Files:**
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php`

**Step 1: Add the `rest_post_dispatch` filter**

Add to `agent_bricks_init()` function in `agent-to-bricks.php` (after line 48):

```php
add_filter( 'rest_post_dispatch', 'agent_bricks_add_version_header', 10, 3 );
```

Then add the callback function before the `agent_bricks_init` function:

```php
/**
 * Add X-ATB-Version header to all plugin REST responses.
 */
function agent_bricks_add_version_header( $response, $server, $request ) {
	$route = $request->get_route();
	if ( strpos( $route, '/agent-bricks/' ) === 0 ) {
		$response->header( 'X-ATB-Version', AGENT_BRICKS_VERSION );
	}
	return $response;
}
```

**Step 2: Verify manually**

Run: `curl -s -D - "https://your-site.com/wp-json/agent-bricks/v1/site/info" -H "X-ATB-Key: ..." 2>&1 | grep X-ATB-Version`
Expected: `X-ATB-Version: 1.3.0`

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/agent-to-bricks.php
git commit -m "feat(plugin): add X-ATB-Version header to all REST responses"
```

---

### Task 10: Plugin — update endpoint (POST /site/update)

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-update-api.php`
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php` (require + init)

**Step 1: Write the update API class**

```php
<?php
/**
 * Plugin self-update via REST API.
 *
 * Allows the CLI to trigger plugin updates by downloading from GitHub Releases
 * and using WordPress Plugin_Upgrader.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Update_API {

	const GITHUB_REPO = 'nerveband/agent-to-bricks';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		register_rest_route( 'agent-bricks/v1', '/site/update', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'handle_update' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'version' => array(
					'required' => true,
					'type'     => 'string',
				),
			),
		) );
	}

	public static function check_permission() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * POST /site/update — Download and install plugin update from GitHub.
	 */
	public static function handle_update( $request ) {
		$version          = sanitize_text_field( $request->get_param( 'version' ) );
		$previous_version = AGENT_BRICKS_VERSION;

		// Build download URL
		$download_url = sprintf(
			'https://github.com/%s/releases/download/v%s/agent-to-bricks-plugin-%s.zip',
			self::GITHUB_REPO,
			$version,
			$version
		);

		// Verify the release exists
		$head = wp_remote_head( $download_url, array( 'timeout' => 10 ) );
		if ( is_wp_error( $head ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => 'Cannot reach GitHub: ' . $head->get_error_message(),
			), 502 );
		}

		$status = wp_remote_retrieve_response_code( $head );
		if ( $status !== 200 && $status !== 302 ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => sprintf( 'Plugin zip not found for v%s (HTTP %d)', $version, $status ),
			), 404 );
		}

		// Use WordPress upgrader
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/plugin.php';

		$skin     = new WP_Ajax_Upgrader_Skin();
		$upgrader = new Plugin_Upgrader( $skin );

		// Download and install
		$result = $upgrader->install( $download_url, array(
			'overwrite_package' => true,
		) );

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $result->get_error_message(),
			), 500 );
		}

		if ( $result === false ) {
			$errors = $skin->get_errors();
			$msg    = is_wp_error( $errors ) ? $errors->get_error_message() : 'Unknown install error';
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $msg,
			), 500 );
		}

		// Reactivate plugin
		$plugin_file = 'agent-to-bricks/agent-to-bricks.php';
		if ( ! is_plugin_active( $plugin_file ) ) {
			activate_plugin( $plugin_file );
		}

		return new WP_REST_Response( array(
			'success'         => true,
			'version'         => $version,
			'previousVersion' => $previous_version,
		), 200 );
	}
}
```

**Step 2: Wire it up in agent-to-bricks.php**

Add require after the other requires (after line 33):

```php
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-update-api.php';
```

Add init call inside `agent_bricks_init()` (after line 47):

```php
ATB_Update_API::init();
```

**Step 3: Test manually**

Deploy to staging, then test with CLI:
```bash
bricks update --check
```

**Step 4: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-update-api.php plugin/agent-to-bricks/agent-to-bricks.php
git commit -m "feat(plugin): add POST /site/update endpoint for CLI-triggered self-update"
```

---

### Task 11: Plugin — admin update notice

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-update-checker.php`
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php` (require + init)

**Step 1: Write the update checker class**

```php
<?php
/**
 * Checks GitHub for new releases and shows an admin notice.
 *
 * Based on the tailor-made GitHub Updater pattern. Does NOT hook into
 * WordPress plugin update system — directs users to the CLI instead.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Update_Checker {

	const GITHUB_REPO  = 'nerveband/agent-to-bricks';
	const CACHE_KEY    = 'atb_github_latest_release';
	const CACHE_TTL    = 21600; // 6 hours
	const DISMISS_META = 'atb_update_dismissed_until';

	public static function init() {
		add_action( 'admin_notices', array( __CLASS__, 'maybe_show_notice' ) );
		add_action( 'wp_ajax_atb_dismiss_update_notice', array( __CLASS__, 'dismiss_notice' ) );
	}

	/**
	 * Show update notice if a newer version is available.
	 */
	public static function maybe_show_notice() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Check if dismissed
		$dismissed_until = get_user_meta( get_current_user_id(), self::DISMISS_META, true );
		if ( $dismissed_until && time() < (int) $dismissed_until ) {
			return;
		}

		$release = self::get_latest_release();
		if ( ! $release ) {
			return;
		}

		$remote_version = ltrim( $release['tag_name'], 'v' );
		$local_version  = AGENT_BRICKS_VERSION;

		if ( version_compare( $remote_version, $local_version, '<=' ) ) {
			return;
		}

		$nonce = wp_create_nonce( 'atb_dismiss_update' );
		?>
		<div class="notice notice-info is-dismissible" id="atb-update-notice">
			<p>
				<strong>Agent to Bricks v<?php echo esc_html( $remote_version ); ?></strong> is available
				(you have v<?php echo esc_html( $local_version ); ?>).
				Update from your CLI: <code>bricks update</code>
			</p>
		</div>
		<script>
		jQuery(document).on('click', '#atb-update-notice .notice-dismiss', function() {
			jQuery.post(ajaxurl, {
				action: 'atb_dismiss_update_notice',
				nonce: '<?php echo esc_js( $nonce ); ?>'
			});
		});
		</script>
		<?php
	}

	/**
	 * AJAX handler: dismiss update notice for 7 days.
	 */
	public static function dismiss_notice() {
		check_ajax_referer( 'atb_dismiss_update', 'nonce' );
		$until = time() + ( 7 * DAY_IN_SECONDS );
		update_user_meta( get_current_user_id(), self::DISMISS_META, $until );
		wp_send_json_success();
	}

	/**
	 * Fetch latest release from GitHub (cached 6h).
	 */
	private static function get_latest_release() {
		$cached = get_transient( self::CACHE_KEY );
		if ( $cached !== false ) {
			return $cached;
		}

		$url = 'https://api.github.com/repos/' . self::GITHUB_REPO . '/releases/latest';

		$response = wp_remote_get( $url, array(
			'headers' => array(
				'Accept'     => 'application/vnd.github.v3+json',
				'User-Agent' => 'AgentToBricks-WP/' . AGENT_BRICKS_VERSION,
			),
			'timeout' => 15,
		) );

		if ( is_wp_error( $response ) ) {
			return null;
		}

		if ( wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return null;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $body ) || isset( $body['message'] ) ) {
			return null;
		}

		set_transient( self::CACHE_KEY, $body, self::CACHE_TTL );

		return $body;
	}
}
```

**Step 2: Wire it up in agent-to-bricks.php**

Add require:
```php
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-update-checker.php';
```

Add init call inside `agent_bricks_init()`:
```php
ATB_Update_Checker::init();
```

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-update-checker.php plugin/agent-to-bricks/agent-to-bricks.php
git commit -m "feat(plugin): add admin update notice — checks GitHub every 6h, dismissible for 7 days"
```

---

### Task 12: Build plugin zip script

**Files:**
- Create: `scripts/build-plugin-zip.sh`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Build the plugin zip for release attachment.
# Usage: ./scripts/build-plugin-zip.sh [version]
# If version is omitted, reads from plugin header.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGIN_DIR="$REPO_ROOT/plugin/agent-to-bricks"

# Get version
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    VERSION=$(grep "define( 'AGENT_BRICKS_VERSION'" "$PLUGIN_DIR/agent-to-bricks.php" | grep -oP "'[0-9]+\.[0-9]+\.[0-9]+'" | tr -d "'")
fi

if [ -z "$VERSION" ]; then
    echo "Error: Could not determine version" >&2
    exit 1
fi

OUTPUT="$REPO_ROOT/agent-to-bricks-plugin-${VERSION}.zip"

echo "Building plugin zip v${VERSION}..."

cd "$REPO_ROOT/plugin"
zip -r "$OUTPUT" agent-to-bricks/ \
    -x "agent-to-bricks/.DS_Store" \
    -x "agent-to-bricks/**/.DS_Store"

echo "Created: $OUTPUT"
echo "Upload with: gh release upload v${VERSION} $(basename "$OUTPUT")"
```

**Step 2: Make it executable and test**

```bash
chmod +x scripts/build-plugin-zip.sh
./scripts/build-plugin-zip.sh
```

**Step 3: Commit**

```bash
git add scripts/build-plugin-zip.sh
git commit -m "feat: add build-plugin-zip.sh for release packaging"
```

---

### Task 13: Wire CLI version into client + integration test

**Files:**
- Modify: `cli/cmd/root.go` (pass version to client)
- Modify: various cmd files that create clients

**Step 1: Modify root.go initConfig to set version on clients**

This is a wiring task. After `initConfig` sets the `cfg`, every place that calls `client.New()` should also call `c.SetCLIVersion(cliVersion)`.

Create a helper in root.go:

```go
func newSiteClient() *client.Client {
	c := client.New(cfg.Site.URL, cfg.Site.APIKey)
	c.SetCLIVersion(cliVersion)
	return c
}
```

Then find-and-replace `client.New(cfg.Site.URL, cfg.Site.APIKey)` with `newSiteClient()` in:
- `cli/cmd/site.go`
- `cli/cmd/convert.go`
- `cli/cmd/agent.go`
- `cli/cmd/generate.go`
- `cli/cmd/templates.go`
- `cli/cmd/doctor.go`

**Step 2: Run all tests**

Run: `cd cli && go test ./...`
Expected: PASS

**Step 3: Commit**

```bash
git add cli/cmd/
git commit -m "refactor(cli): wire CLI version into all API clients for mismatch detection"
```

---

### Task 14: Build, test, push

**Step 1: Run all tests**

```bash
cd cli && go test ./...
```

Expected: All packages pass.

**Step 2: Build binary**

```bash
make build
```

**Step 3: Verify**

```bash
bin/bricks version
bin/bricks update --check
```

**Step 4: Deploy plugin to staging**

```bash
make deploy-staging
```

**Step 5: Test end-to-end**

```bash
bin/bricks version          # Should show CLI + plugin versions
bin/bricks update --check   # Should report if up to date
```

**Step 6: Push to git**

```bash
git push origin main
```
