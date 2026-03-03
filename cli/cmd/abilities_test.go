package cmd

import (
	"testing"

	"github.com/spf13/cobra"
)

func TestAbilitiesCmd_Exists(t *testing.T) {
	cmd := rootCmd
	found := false
	for _, c := range cmd.Commands() {
		if c.Use == "abilities" {
			found = true
			break
		}
	}
	if !found {
		t.Error("abilities command not registered on root")
	}
}

func TestAbilitiesListCmd_Exists(t *testing.T) {
	var abilitiesFound *cobra.Command
	for _, c := range rootCmd.Commands() {
		if c.Use == "abilities" {
			abilitiesFound = c
			break
		}
	}
	if abilitiesFound == nil {
		t.Fatal("abilities command not found")
	}

	found := false
	for _, c := range abilitiesFound.Commands() {
		if c.Use == "list" {
			found = true
		}
	}
	if !found {
		t.Error("abilities list subcommand not found")
	}
}
