package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/nerveband/agent-to-bricks/internal/convert"
	"github.com/spf13/cobra"
)

var convertOutput string

var convertCmd = &cobra.Command{
	Use:   "convert",
	Short: "Convert between formats",
}

var convertHTMLCmd = &cobra.Command{
	Use:   "html <file.html>",
	Short: "Convert HTML to Bricks element JSON",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		data, err := os.ReadFile(args[0])
		if err != nil {
			return fmt.Errorf("failed to read file: %w", err)
		}

		elements, err := convert.HTMLToBricks(string(data))
		if err != nil {
			return fmt.Errorf("conversion failed: %w", err)
		}

		output := map[string]interface{}{
			"elements": elements,
			"count":    len(elements),
		}

		jsonData, err := json.MarshalIndent(output, "", "  ")
		if err != nil {
			return err
		}

		if convertOutput != "" {
			if err := os.WriteFile(convertOutput, jsonData, 0644); err != nil {
				return err
			}
			fmt.Printf("Converted %d elements → %s\n", len(elements), convertOutput)
		} else {
			fmt.Println(string(jsonData))
		}

		return nil
	},
}

func init() {
	convertHTMLCmd.Flags().StringVarP(&convertOutput, "output", "o", "", "output file path")

	convertCmd.AddCommand(convertHTMLCmd)
	rootCmd.AddCommand(convertCmd)
}
