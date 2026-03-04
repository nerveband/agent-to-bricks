package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

var schemaValidate bool

var schemaCmd = &cobra.Command{
	Use:   "schema",
	Short: "Output or validate the CLI schema manifest",
	Long: `Outputs the CLI capability manifest as JSON.

LLMs and tools can use this to discover all available commands,
flags, input/output formats, and error codes without parsing --help text.

Use --validate to check that schema.json matches the live command tree.`,
	Example: `  bricks schema                # Print full CLI manifest
  bricks schema --validate     # Verify schema.json is in sync (used in CI)`,
	RunE: func(cmd *cobra.Command, args []string) error {
		schemaPath := findSchemaPath()
		if schemaValidate {
			return validateSchema(schemaPath)
		}
		data, err := os.ReadFile(schemaPath)
		if err != nil {
			return fmt.Errorf("failed to read schema.json: %w", err)
		}
		fmt.Print(string(data))
		return nil
	},
}

func findSchemaPath() string {
	candidates := []string{
		"schema.json",
		"cli/schema.json",
	}
	if _, filename, _, ok := runtime.Caller(0); ok {
		candidates = append(candidates, filepath.Join(filepath.Dir(filename), "..", "schema.json"))
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "schema.json"
}

func validateSchema(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", path, err)
	}
	var schema struct {
		Commands map[string]struct {
			Description string `json:"description"`
		} `json:"commands"`
	}
	if err := json.Unmarshal(data, &schema); err != nil {
		return fmt.Errorf("invalid JSON in %s: %w", path, err)
	}

	// Walk the live Cobra command tree
	liveCommands := map[string]bool{}
	walkCommands(rootCmd, "", liveCommands)

	// Compare
	var missing, extra []string
	for name := range liveCommands {
		if _, ok := schema.Commands[name]; !ok {
			missing = append(missing, name)
		}
	}
	for name := range schema.Commands {
		if !liveCommands[name] {
			extra = append(extra, name)
		}
	}

	sort.Strings(missing)
	sort.Strings(extra)

	if len(missing) > 0 || len(extra) > 0 {
		msg := "schema.json is out of sync:\n"
		for _, m := range missing {
			msg += fmt.Sprintf("  missing from schema: %s\n", m)
		}
		for _, e := range extra {
			msg += fmt.Sprintf("  extra in schema (not in CLI): %s\n", e)
		}
		return fmt.Errorf("%s", msg)
	}

	fmt.Println("schema.json is in sync with the CLI command tree.")
	return nil
}

func walkCommands(cmd *cobra.Command, prefix string, result map[string]bool) {
	for _, sub := range cmd.Commands() {
		if sub.Hidden || !sub.IsAvailableCommand() {
			continue
		}
		name := strings.TrimSpace(prefix + " " + sub.Name())
		if sub.HasSubCommands() {
			walkCommands(sub, name, result)
		} else {
			result[name] = true
		}
	}
}

func init() {
	schemaCmd.Flags().BoolVar(&schemaValidate, "validate", false, "Validate schema.json against live command tree")
	rootCmd.AddCommand(schemaCmd)
}
