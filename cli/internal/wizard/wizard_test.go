package wizard

import (
	"testing"
)

func TestMaskKey(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"atb_UcG12V3noyB7MShnTAIDuTuz1dLvtgXJd07ZINIw", "atb_UcG1"},
		{"short", "****"},
		{"12345678", "****"},
		{"123456789", "12345678"},
	}

	for _, tt := range tests {
		result := maskKey(tt.input)
		if result != tt.expected {
			t.Errorf("maskKey(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestInitialModel(t *testing.T) {
	m := initialModel()

	if m.step != stepWelcome {
		t.Errorf("expected initial step to be welcome, got %d", m.step)
	}

	if _, ok := m.inputs[stepSiteURL]; !ok {
		t.Error("expected site URL input to exist")
	}
	if _, ok := m.inputs[stepAPIKey]; !ok {
		t.Error("expected API key input to exist")
	}
}

func TestBuildConfig(t *testing.T) {
	m := initialModel()

	// Set values
	ti := m.inputs[stepSiteURL]
	ti.SetValue("https://example.com")
	m.inputs[stepSiteURL] = ti

	ti = m.inputs[stepAPIKey]
	ti.SetValue("atb_testkey123456789")
	m.inputs[stepAPIKey] = ti

	cfg := m.buildConfig()

	if cfg.Site.URL != "https://example.com" {
		t.Errorf("expected URL 'https://example.com', got %q", cfg.Site.URL)
	}
	if cfg.Site.APIKey != "atb_testkey123456789" {
		t.Errorf("expected API key, got %q", cfg.Site.APIKey)
	}
}

func TestStepIndex(t *testing.T) {
	m := initialModel()

	m.step = stepWelcome
	if m.stepIndex() != 0 {
		t.Error("welcome should be step 0")
	}

	m.step = stepAPIKey
	if m.stepIndex() != 1 {
		t.Error("API key should be step 1")
	}

	m.step = stepDone
	if m.stepIndex() != 2 {
		t.Error("done should be step 2")
	}
}
