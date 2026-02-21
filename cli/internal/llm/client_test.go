package llm_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/llm"
)

func TestNewClientDefaults(t *testing.T) {
	c := llm.NewClient("cerebras", "key123", "", "")
	if c.Model() != "llama-4-scout-17b-16e-instruct" {
		t.Errorf("expected cerebras default model, got %s", c.Model())
	}
}

func TestNewClientCustomModel(t *testing.T) {
	c := llm.NewClient("openai", "key123", "gpt-4-turbo", "")
	if c.Model() != "gpt-4-turbo" {
		t.Errorf("expected gpt-4-turbo, got %s", c.Model())
	}
}

func TestChat(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-key" {
			t.Errorf("unexpected auth: %s", auth)
		}

		var req llm.ChatRequest
		json.NewDecoder(r.Body).Decode(&req)
		if req.Model != "test-model" {
			t.Errorf("expected test-model, got %s", req.Model)
		}

		json.NewEncoder(w).Encode(llm.ChatResponse{
			ID: "chatcmpl-123",
			Choices: []struct {
				Index   int        `json:"index"`
				Message llm.Message `json:"message"`
			}{
				{Index: 0, Message: llm.Message{Role: "assistant", Content: `{"elements": [{"id": "abc123", "name": "section"}]}`}},
			},
		})
	}))
	defer srv.Close()

	c := llm.NewClient("custom", "test-key", "test-model", srv.URL)
	messages := []llm.Message{
		{Role: "system", Content: "You are a Bricks generator."},
		{Role: "user", Content: "Generate a hero section."},
	}

	content, resp, err := c.Chat(messages, 0.7)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected response")
	}
	if content == "" {
		t.Error("expected content")
	}

	// Verify content is valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		t.Errorf("response content is not valid JSON: %v", err)
	}
}

func TestChatUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		w.Write([]byte(`{"error": "invalid api key"}`))
	}))
	defer srv.Close()

	c := llm.NewClient("custom", "bad-key", "model", srv.URL)
	_, _, err := c.Chat([]llm.Message{{Role: "user", Content: "hello"}}, 0.7)
	if err == nil {
		t.Error("expected error for 401")
	}
}
