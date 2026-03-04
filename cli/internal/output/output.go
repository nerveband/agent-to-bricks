package output

import (
	"encoding/json"
	"os"

	clierrors "github.com/nerveband/agent-to-bricks/internal/errors"
	"github.com/spf13/cobra"
)

var format string

// AddFormatFlags registers --format and --json flags on a command.
func AddFormatFlags(cmd *cobra.Command) {
	cmd.Flags().StringVar(&format, "format", "", "Output format: json, table")
	cmd.Flags().Bool("json", false, "Shorthand for --format json")
}

// ResolveFormat resolves --json alias to format=json. Call in PreRunE or at start of RunE.
func ResolveFormat(cmd *cobra.Command) {
	if j, _ := cmd.Flags().GetBool("json"); j && format == "" {
		format = "json"
	}
}

// GetFormat returns the current output format.
func GetFormat() string { return format }

// IsJSON returns true if the output format is JSON.
func IsJSON() bool { return format == "json" }

// Reset clears the format (for testing).
func Reset() { format = "" }

// JSON writes a value as indented JSON to stdout.
func JSON(v interface{}) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// JSONError writes a structured error as JSON to stderr.
func JSONError(err *clierrors.CLIError) {
	enc := json.NewEncoder(os.Stderr)
	enc.SetIndent("", "  ")
	enc.Encode(map[string]interface{}{"error": err})
}
