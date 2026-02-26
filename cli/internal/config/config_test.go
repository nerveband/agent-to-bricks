package config_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/config"
)

func TestLoadConfig(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.yaml")

	os.WriteFile(cfgPath, []byte(`
site:
  url: https://example.com
  api_key: atb_testkey123
`), 0644)

	cfg, err := config.Load(cfgPath)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Site.URL != "https://example.com" {
		t.Errorf("expected URL https://example.com, got %s", cfg.Site.URL)
	}
	if cfg.Site.APIKey != "atb_testkey123" {
		t.Errorf("expected API key atb_testkey123, got %s", cfg.Site.APIKey)
	}
}

func TestSaveAndLoad(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "sub", "config.yaml")

	cfg := &config.Config{
		Site: config.SiteConfig{
			URL:    "https://test.com",
			APIKey: "atb_key456",
		},
	}

	if err := cfg.Save(cfgPath); err != nil {
		t.Fatalf("save error: %v", err)
	}

	loaded, err := config.Load(cfgPath)
	if err != nil {
		t.Fatalf("load error: %v", err)
	}
	if loaded.Site.URL != "https://test.com" {
		t.Errorf("URL mismatch: %s", loaded.Site.URL)
	}
}

func TestLoadMissing(t *testing.T) {
	_, err := config.Load("/nonexistent/path/config.yaml")
	if err == nil {
		t.Error("expected error for missing file")
	}
}
