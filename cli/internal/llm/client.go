package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Provider endpoints for known providers.
var ProviderBaseURLs = map[string]string{
	"cerebras":   "https://api.cerebras.ai/v1",
	"openrouter": "https://openrouter.ai/api/v1",
	"openai":     "https://api.openai.com/v1",
	"ollama":     "http://localhost:11434/v1",
}

// DefaultModels for known providers.
var DefaultModels = map[string]string{
	"cerebras":   "llama-4-scout-17b-16e-instruct",
	"openrouter": "anthropic/claude-sonnet-4-20250514",
	"openai":     "gpt-4o",
	"ollama":     "llama3.2",
}

// Client is an OpenAI-compatible LLM client.
type Client struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

// Message represents a chat message.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest is the request body for chat completions.
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
}

// ChatResponse is the response from chat completions.
type ChatResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Index   int     `json:"index"`
		Message Message `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// NewClient creates an LLM client for the given provider.
func NewClient(provider, apiKey, model, baseURL string) *Client {
	if baseURL == "" {
		baseURL = ProviderBaseURLs[provider]
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	if model == "" {
		model = DefaultModels[provider]
	}
	if model == "" {
		model = "gpt-4o"
	}

	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		model:      model,
		httpClient: &http.Client{},
	}
}

// Chat sends a chat completion request and returns the assistant's message.
func (c *Client) Chat(messages []Message, temperature float64) (string, *ChatResponse, error) {
	req := ChatRequest{
		Model:       c.model,
		Messages:    messages,
		Temperature: temperature,
		MaxTokens:   4096,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", nil, err
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", nil, fmt.Errorf("LLM request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return "", nil, fmt.Errorf("LLM HTTP %d: %s", resp.StatusCode, string(data))
	}

	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", nil, err
	}

	if len(chatResp.Choices) == 0 {
		return "", &chatResp, fmt.Errorf("no choices in LLM response")
	}

	return chatResp.Choices[0].Message.Content, &chatResp, nil
}

// Model returns the model name.
func (c *Client) Model() string {
	return c.model
}
