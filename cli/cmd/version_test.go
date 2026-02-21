package cmd

import "testing"

func TestVersionCommandExists(t *testing.T) {
	found := false
	for _, c := range rootCmd.Commands() {
		if c.Use == "version" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'version' subcommand on root")
	}
}
