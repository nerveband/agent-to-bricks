package cmd

import "testing"

func TestRootHasPersistentPreRun(t *testing.T) {
	if rootCmd.PersistentPreRun == nil {
		t.Error("expected PersistentPreRun to be set for update check")
	}
}
