package wpcli_test

import (
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/wpcli"
)

func TestNewClient(t *testing.T) {
	cfg := wpcli.Config{
		Mode: wpcli.ModeDisabled,
	}
	c := wpcli.New(cfg)
	if c == nil {
		t.Fatal("expected client")
	}
}

func TestDisabledMode(t *testing.T) {
	c := wpcli.New(wpcli.Config{Mode: wpcli.ModeDisabled})
	_, err := c.Run("plugin", "list")
	if err == nil {
		t.Error("expected error for disabled mode")
	}
}

func TestDetect(t *testing.T) {
	mode := wpcli.Detect()
	// On most dev machines, wp-cli may or may not be installed
	// Just verify it returns a valid mode
	if mode != wpcli.ModeLocal && mode != wpcli.ModeDisabled {
		t.Errorf("unexpected mode: %s", mode)
	}
}
