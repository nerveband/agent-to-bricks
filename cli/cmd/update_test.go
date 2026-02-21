package cmd

import "testing"

func TestUpdateCommandExists(t *testing.T) {
	found := false
	for _, c := range rootCmd.Commands() {
		if c.Use == "update" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'update' subcommand on root")
	}
}

func TestUpdateCommandFlags(t *testing.T) {
	for _, c := range rootCmd.Commands() {
		if c.Use == "update" {
			if c.Flags().Lookup("cli-only") == nil {
				t.Error("expected --cli-only flag")
			}
			if c.Flags().Lookup("check") == nil {
				t.Error("expected --check flag")
			}
			if c.Flags().Lookup("force") == nil {
				t.Error("expected --force flag")
			}
			return
		}
	}
	t.Error("update command not found")
}
