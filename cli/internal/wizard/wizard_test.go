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

	if len(m.llmOptions) != 5 {
		t.Errorf("expected 5 LLM options, got %d", len(m.llmOptions))
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

	m.llmChoice = 0 // cerebras

	ti = m.inputs[stepLLMKey]
	ti.SetValue("sk-cerebras-key")
	m.inputs[stepLLMKey] = ti

	ti = m.inputs[stepWPCLISSH]
	ti.SetValue("user@host.com")
	m.inputs[stepWPCLISSH] = ti

	ti = m.inputs[stepWPCLIPath]
	ti.SetValue("/var/www/html")
	m.inputs[stepWPCLIPath] = ti

	cfg := m.buildConfig()

	if cfg.Site.URL != "https://example.com" {
		t.Errorf("expected URL 'https://example.com', got %q", cfg.Site.URL)
	}
	if cfg.Site.APIKey != "atb_testkey123456789" {
		t.Errorf("expected API key, got %q", cfg.Site.APIKey)
	}
	if cfg.LLM.Provider != "cerebras" {
		t.Errorf("expected provider 'cerebras', got %q", cfg.LLM.Provider)
	}
	if cfg.LLM.APIKey != "sk-cerebras-key" {
		t.Errorf("expected LLM key, got %q", cfg.LLM.APIKey)
	}
	if cfg.WPCLI.SSHHost != "user@host.com" {
		t.Errorf("expected SSH host, got %q", cfg.WPCLI.SSHHost)
	}
	if cfg.WPCLI.WPPath != "/var/www/html" {
		t.Errorf("expected WP path, got %q", cfg.WPCLI.WPPath)
	}
}

func TestBuildConfigNoWPCLI(t *testing.T) {
	m := initialModel()

	ti := m.inputs[stepSiteURL]
	ti.SetValue("https://test.com")
	m.inputs[stepSiteURL] = ti

	ti = m.inputs[stepAPIKey]
	ti.SetValue("atb_key")
	m.inputs[stepAPIKey] = ti

	m.llmChoice = 4 // skip

	cfg := m.buildConfig()

	if cfg.WPCLI.SSHHost != "" {
		t.Error("expected empty SSH host when skipped")
	}
	if cfg.LLM.Provider != "" {
		t.Errorf("expected empty provider when skipped, got %q", cfg.LLM.Provider)
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

	m.step = stepLLMProvider
	if m.stepIndex() != 2 {
		t.Error("LLM should be step 2")
	}

	m.step = stepWPCLISSH
	if m.stepIndex() != 3 {
		t.Error("WP-CLI should be step 3")
	}

	m.step = stepDone
	if m.stepIndex() != 4 {
		t.Error("done should be step 4")
	}
}
