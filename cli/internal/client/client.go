package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// Client talks to the Agent to Bricks REST API.
type Client struct {
	baseURL           string
	apiKey            string
	httpClient        *http.Client
	cliVersion        string
	lastPluginVersion string
	versionWarned     bool
}

// New creates a client using X-ATB-Key authentication.
func New(baseURL, apiKey string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

// ElementsResponse from GET /pages/{id}/elements.
type ElementsResponse struct {
	Elements    []map[string]interface{} `json:"elements"`
	ContentHash string                   `json:"contentHash"`
	Count       int                      `json:"count"`
}

// SiteInfoResponse from GET /site/info.
type SiteInfoResponse struct {
	BricksVersion  string                   `json:"bricksVersion"`
	ContentMetaKey string                   `json:"contentMetaKey"`
	ElementTypes   []string                 `json:"elementTypes"`
	Breakpoints    []map[string]interface{} `json:"breakpoints"`
	PluginVersion  string                   `json:"pluginVersion"`
	PHPVersion     string                   `json:"phpVersion"`
	WPVersion      string                   `json:"wpVersion"`
}

// FrameworksResponse from GET /site/frameworks.
type FrameworksResponse struct {
	Frameworks map[string]interface{} `json:"frameworks"`
}

// SetCLIVersion sets the CLI version for mismatch detection.
func (c *Client) SetCLIVersion(v string) {
	c.cliVersion = strings.TrimPrefix(v, "v")
}

// LastPluginVersion returns the plugin version from the most recent API response.
func (c *Client) LastPluginVersion() string {
	return c.lastPluginVersion
}

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

func (c *Client) do(method, path string, body io.Reader) (*http.Response, error) {
	return c.doWithHeaders(method, path, body, nil)
}

func (c *Client) doWithHeaders(method, path string, body io.Reader, headers map[string]string) (*http.Response, error) {
	url := c.baseURL + "/wp-json/agent-bricks/v1" + path
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-ATB-Key", c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	// Read plugin version header for mismatch detection
	if pv := resp.Header.Get("X-ATB-Version"); pv != "" {
		c.lastPluginVersion = strings.TrimPrefix(pv, "v")
		c.checkVersionMismatch()
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(data))
	}
	return resp, nil
}

// MutationResponse from PUT/POST/DELETE/PATCH element operations.
type MutationResponse struct {
	Success     bool   `json:"success"`
	ContentHash string `json:"contentHash"`
	Count       int    `json:"count"`
}

// SnapshotResponse from POST /pages/{id}/snapshots.
type SnapshotResponse struct {
	SnapshotID  string `json:"snapshotId"`
	ContentHash string `json:"contentHash"`
	Label       string `json:"label"`
}

// SnapshotsListResponse from GET /pages/{id}/snapshots.
type SnapshotsListResponse struct {
	Snapshots []Snapshot `json:"snapshots"`
}

// Snapshot represents a single snapshot entry.
type Snapshot struct {
	ID          string `json:"id"`
	ContentHash string `json:"contentHash"`
	Label       string `json:"label"`
	CreatedAt   string `json:"createdAt"`
	Count       int    `json:"count"`
}

// RollbackResponse from POST /pages/{id}/snapshots/{snapshot_id}/rollback.
type RollbackResponse struct {
	Success     bool   `json:"success"`
	ContentHash string `json:"contentHash"`
	Restored    string `json:"restored"`
}

func (c *Client) GetElements(pageID int) (*ElementsResponse, error) {
	resp, err := c.do("GET", fmt.Sprintf("/pages/%d/elements", pageID), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result ElementsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) GetSiteInfo() (*SiteInfoResponse, error) {
	resp, err := c.do("GET", "/site/info", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result SiteInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) GetFrameworks() (*FrameworksResponse, error) {
	resp, err := c.do("GET", "/site/frameworks", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result FrameworksResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ReplaceElements does a full PUT replace of all elements on a page.
func (c *Client) ReplaceElements(pageID int, elements []map[string]interface{}, ifMatch string) (*MutationResponse, error) {
	payload, _ := json.Marshal(map[string]interface{}{"elements": elements})
	headers := map[string]string{}
	if ifMatch != "" {
		headers["If-Match"] = ifMatch
	}
	resp, err := c.doWithHeaders("PUT", fmt.Sprintf("/pages/%d/elements", pageID), strings.NewReader(string(payload)), headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result MutationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// PatchElements updates specific elements by ID.
func (c *Client) PatchElements(pageID int, patches []map[string]interface{}, ifMatch string) (*MutationResponse, error) {
	payload, _ := json.Marshal(map[string]interface{}{"elements": patches})
	headers := map[string]string{}
	if ifMatch != "" {
		headers["If-Match"] = ifMatch
	}
	resp, err := c.doWithHeaders("PATCH", fmt.Sprintf("/pages/%d/elements", pageID), strings.NewReader(string(payload)), headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result MutationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// AppendElements adds new elements to a page.
func (c *Client) AppendElements(pageID int, elements []map[string]interface{}, ifMatch string) (*MutationResponse, error) {
	payload, _ := json.Marshal(map[string]interface{}{"elements": elements})
	headers := map[string]string{}
	if ifMatch != "" {
		headers["If-Match"] = ifMatch
	}
	resp, err := c.doWithHeaders("POST", fmt.Sprintf("/pages/%d/elements", pageID), strings.NewReader(string(payload)), headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result MutationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// DeleteElements removes elements by ID.
func (c *Client) DeleteElements(pageID int, ids []string, ifMatch string) (*MutationResponse, error) {
	payload, _ := json.Marshal(map[string]interface{}{"ids": ids})
	headers := map[string]string{}
	if ifMatch != "" {
		headers["If-Match"] = ifMatch
	}
	resp, err := c.doWithHeaders("DELETE", fmt.Sprintf("/pages/%d/elements", pageID), strings.NewReader(string(payload)), headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result MutationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CreateSnapshot creates a snapshot of the current page state.
func (c *Client) CreateSnapshot(pageID int, label string) (*SnapshotResponse, error) {
	payload, _ := json.Marshal(map[string]string{"label": label})
	resp, err := c.do("POST", fmt.Sprintf("/pages/%d/snapshots", pageID), strings.NewReader(string(payload)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result SnapshotResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListSnapshots lists all snapshots for a page.
func (c *Client) ListSnapshots(pageID int) (*SnapshotsListResponse, error) {
	resp, err := c.do("GET", fmt.Sprintf("/pages/%d/snapshots", pageID), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result SnapshotsListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ClassesResponse from GET /classes.
type ClassesResponse struct {
	Classes []map[string]interface{} `json:"classes"`
	Count   int                      `json:"count"`
	Total   int                      `json:"total"`
}

// StylesResponse from GET /styles.
type StylesResponse struct {
	ThemeStyles    []map[string]interface{} `json:"themeStyles"`
	ColorPalette   interface{}              `json:"colorPalette"`
	GlobalSettings map[string]interface{}   `json:"globalSettings"`
}

// VariablesResponse from GET /variables.
type VariablesResponse struct {
	Variables        []map[string]interface{} `json:"variables"`
	ExtractedFromCSS []map[string]interface{} `json:"extractedFromCSS"`
}

// ListClasses returns all global classes, optionally filtered by framework.
func (c *Client) ListClasses(framework string) (*ClassesResponse, error) {
	path := "/classes"
	if framework != "" {
		path += "?framework=" + framework
	}
	resp, err := c.do("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result ClassesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CreateClass creates a new global class.
func (c *Client) CreateClass(name string, settings map[string]interface{}) (map[string]interface{}, error) {
	payload := map[string]interface{}{"name": name}
	if settings != nil {
		payload["settings"] = settings
	}
	data, _ := json.Marshal(payload)
	resp, err := c.do("POST", "/classes", strings.NewReader(string(data)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// DeleteClass removes a global class by ID.
func (c *Client) DeleteClass(classID string) error {
	resp, err := c.do("DELETE", "/classes/"+classID, nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// GetStyles returns theme styles and color palette.
func (c *Client) GetStyles() (*StylesResponse, error) {
	resp, err := c.do("GET", "/styles", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result StylesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetVariables returns CSS custom properties.
func (c *Client) GetVariables() (*VariablesResponse, error) {
	resp, err := c.do("GET", "/variables", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result VariablesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Rollback restores a snapshot.
func (c *Client) Rollback(pageID int, snapshotID string) (*RollbackResponse, error) {
	resp, err := c.do("POST", fmt.Sprintf("/pages/%d/snapshots/%s/rollback", pageID, snapshotID), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result RollbackResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

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
