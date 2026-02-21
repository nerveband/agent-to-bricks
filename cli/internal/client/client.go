package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Client talks to the Agent to Bricks REST API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
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

func (c *Client) do(method, path string, body io.Reader) (*http.Response, error) {
	url := c.baseURL + "/wp-json/agent-bricks/v1" + path
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-ATB-Key", c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(data))
	}
	return resp, nil
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
