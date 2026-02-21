package updater

import (
	"encoding/json"
	"os"
	"path/filepath"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Release struct {
	Version     string  `json:"version"`
	TagName     string  `json:"tagName"`
	PublishedAt string  `json:"publishedAt"`
	Body        string  `json:"body"`
	Assets      []Asset `json:"assets"`
}

type Asset struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type Updater struct {
	currentVersion string
	apiBase        string
	httpClient     *http.Client
}

func New(currentVersion, apiBase string) *Updater {
	return &Updater{
		currentVersion: strings.TrimPrefix(currentVersion, "v"),
		apiBase:        strings.TrimRight(apiBase, "/"),
		httpClient:     &http.Client{Timeout: 15 * time.Second},
	}
}

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

func (r *Release) HasUpdate(currentVersion string) bool {
	return CompareVersions(strings.TrimPrefix(currentVersion, "v"), r.Version) < 0
}

func (r *Release) FindCLIAsset(goos, goarch string) *Asset {
	pattern := fmt.Sprintf("agent-to-bricks_%s_%s_%s", r.Version, goos, goarch)
	for i := range r.Assets {
		if strings.HasPrefix(r.Assets[i].Name, pattern) {
			return &r.Assets[i]
		}
	}
	return nil
}

func (r *Release) FindPluginAsset() *Asset {
	for i := range r.Assets {
		if strings.HasPrefix(r.Assets[i].Name, "agent-to-bricks-plugin-") && strings.HasSuffix(r.Assets[i].Name, ".zip") {
			return &r.Assets[i]
		}
	}
	return nil
}

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
