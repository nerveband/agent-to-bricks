package updater

import (
	"encoding/json"
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
