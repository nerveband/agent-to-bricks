package errors

import (
	"encoding/json"
	"testing"
)

func TestCLIErrorImplementsError(t *testing.T) {
	err := ConfigError("CONFIG_MISSING_URL", "site URL not configured", "Run: bricks config init")
	if err.Error() != "site URL not configured. Run: bricks config init" {
		t.Errorf("expected 'site URL not configured. Run: bricks config init', got %q", err.Error())
	}
}

func TestConfigErrorExitCode(t *testing.T) {
	err := ConfigError("CONFIG_MISSING_URL", "site URL not configured", "Run: bricks config init")
	if err.Exit != 2 {
		t.Errorf("expected exit code 2, got %d", err.Exit)
	}
	if err.Code != "CONFIG_MISSING_URL" {
		t.Errorf("expected code CONFIG_MISSING_URL, got %q", err.Code)
	}
}

func TestAPIErrorExitCode(t *testing.T) {
	err := APIError("API_UNAUTHORIZED", "HTTP 401: Unauthorized")
	if err.Exit != 3 {
		t.Errorf("expected exit code 3, got %d", err.Exit)
	}
}

func TestValidationErrorExitCode(t *testing.T) {
	err := ValidationError("INVALID_PAGE_ID", "invalid page ID: abc")
	if err.Exit != 4 {
		t.Errorf("expected exit code 4, got %d", err.Exit)
	}
}

func TestConflictErrorExitCode(t *testing.T) {
	err := ConflictError("content hash mismatch")
	if err.Exit != 5 {
		t.Errorf("expected exit code 5, got %d", err.Exit)
	}
	if err.Code != "CONTENT_CONFLICT" {
		t.Errorf("expected code CONTENT_CONFLICT, got %q", err.Code)
	}
}

func TestCLIErrorJSONMarshal(t *testing.T) {
	err := ConfigError("CONFIG_NOT_FOUND", "no config file", "Run: bricks config init")
	data, jsonErr := json.Marshal(err)
	if jsonErr != nil {
		t.Fatalf("marshal failed: %v", jsonErr)
	}
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	if m["code"] != "CONFIG_NOT_FOUND" {
		t.Errorf("expected code CONFIG_NOT_FOUND in JSON, got %v", m["code"])
	}
	if m["message"] != "no config file" {
		t.Errorf("expected message in JSON, got %v", m["message"])
	}
	if m["hint"] != "Run: bricks config init" {
		t.Errorf("expected hint in JSON, got %v", m["hint"])
	}
	// Exit should NOT be in JSON (json:"-")
	if _, ok := m["exit"]; ok {
		t.Error("exit code should not appear in JSON output")
	}
}

func TestCLIErrorJSONOmitsEmptyHint(t *testing.T) {
	err := APIError("API_NOT_FOUND", "HTTP 404: not found")
	data, _ := json.Marshal(err)
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	if _, ok := m["hint"]; ok {
		t.Error("empty hint should be omitted from JSON")
	}
}

func TestFromHTTPStatus(t *testing.T) {
	tests := []struct {
		status int
		code   string
	}{
		{401, "API_UNAUTHORIZED"},
		{403, "API_FORBIDDEN"},
		{404, "API_NOT_FOUND"},
		{409, "CONTENT_CONFLICT"},
		{500, "API_SERVER_ERROR"},
		{502, "API_SERVER_ERROR"},
	}
	for _, tt := range tests {
		err := FromHTTPStatus(tt.status, "test body")
		if err.Code != tt.code {
			t.Errorf("HTTP %d: expected code %s, got %s", tt.status, tt.code, err.Code)
		}
	}
}
