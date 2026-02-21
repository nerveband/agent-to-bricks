package cmd

import (
	"testing"
)

func TestAgentCmd_Exists(t *testing.T) {
	if agentCmd == nil {
		t.Fatal("agentCmd should not be nil")
	}
	if agentCmd.Use != "agent" {
		t.Errorf("expected Use 'agent', got %q", agentCmd.Use)
	}
}

func TestAgentContextCmd_Exists(t *testing.T) {
	if agentContextCmd == nil {
		t.Fatal("agentContextCmd should not be nil")
	}
	if agentContextCmd.Use != "context" {
		t.Errorf("expected Use 'context', got %q", agentContextCmd.Use)
	}
}

func TestAgentContextCmd_Flags(t *testing.T) {
	flags := []struct {
		name      string
		shorthand string
	}{
		{"format", "f"},
		{"section", "s"},
		{"compact", ""},
		{"output", "o"},
	}
	for _, f := range flags {
		flag := agentContextCmd.Flags().Lookup(f.name)
		if flag == nil {
			t.Errorf("flag --%s not registered", f.name)
			continue
		}
		if f.shorthand != "" && flag.Shorthand != f.shorthand {
			t.Errorf("flag --%s expected shorthand -%s, got -%s", f.name, f.shorthand, flag.Shorthand)
		}
	}
}

func TestAgentContextCmd_FormatDefault(t *testing.T) {
	flag := agentContextCmd.Flags().Lookup("format")
	if flag == nil {
		t.Fatal("format flag not found")
	}
	if flag.DefValue != "md" {
		t.Errorf("expected default 'md', got %q", flag.DefValue)
	}
}

func TestAgentCmd_HasContextSubcommand(t *testing.T) {
	found := false
	for _, sub := range agentCmd.Commands() {
		if sub.Use == "context" {
			found = true
			break
		}
	}
	if !found {
		t.Error("agentCmd should have 'context' subcommand")
	}
}
