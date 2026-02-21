package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/nerveband/agent-to-bricks/internal/validator"
	"github.com/spf13/cobra"
)

var validateCmd = &cobra.Command{
	Use:   "validate <file.json>",
	Short: "Validate Bricks element JSON",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		data, err := os.ReadFile(args[0])
		if err != nil {
			return fmt.Errorf("failed to read file: %w", err)
		}

		var parsed map[string]interface{}
		if err := json.Unmarshal(data, &parsed); err != nil {
			return fmt.Errorf("invalid JSON: %w", err)
		}

		result := validator.ValidateFile(parsed)

		if len(result.Errors) > 0 {
			fmt.Println("Errors:")
			for _, e := range result.Errors {
				fmt.Printf("  x %s\n", e)
			}
		}

		if len(result.Warnings) > 0 {
			fmt.Println("Warnings:")
			for _, w := range result.Warnings {
				fmt.Printf("  ! %s\n", w)
			}
		}

		if result.Valid {
			fmt.Printf("Valid (%d errors, %d warnings)\n", len(result.Errors), len(result.Warnings))
			return nil
		}

		return fmt.Errorf("validation failed with %d errors", len(result.Errors))
	},
}

func init() {
	rootCmd.AddCommand(validateCmd)
}
