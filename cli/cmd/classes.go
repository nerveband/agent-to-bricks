package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

var classesCmd = &cobra.Command{
	Use:   "classes",
	Short: "Manage Bricks global CSS classes",
}

var classesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all global classes",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		framework, _ := cmd.Flags().GetString("framework")
		resp, err := c.ListClasses(framework)
		if err != nil {
			return fmt.Errorf("failed to list classes: %w", err)
		}

		jsonOut, _ := cmd.Flags().GetBool("json")
		if jsonOut {
			data, _ := json.MarshalIndent(resp, "", "  ")
			fmt.Println(string(data))
			return nil
		}

		fmt.Printf("Global Classes (%d of %d total)\n\n", resp.Count, resp.Total)
		for _, cls := range resp.Classes {
			name, _ := cls["name"].(string)
			id, _ := cls["id"].(string)
			fw, _ := cls["framework"].(string)
			tag := ""
			if fw == "acss" {
				tag = " [ACSS]"
			}
			fmt.Printf("  %s (%s)%s\n", name, id, tag)
		}
		return nil
	},
}

var classesCreateCmd = &cobra.Command{
	Use:   "create <name>",
	Short: "Create a new global class",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		var settings map[string]interface{}
		settingsStr, _ := cmd.Flags().GetString("settings")
		if settingsStr != "" {
			if err := json.Unmarshal([]byte(settingsStr), &settings); err != nil {
				return fmt.Errorf("invalid settings JSON: %w", err)
			}
		}

		result, err := c.CreateClass(args[0], settings)
		if err != nil {
			return fmt.Errorf("failed to create class: %w", err)
		}

		data, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(data))
		return nil
	},
}

var classesFindCmd = &cobra.Command{
	Use:   "find <pattern>",
	Short: "Find classes matching a pattern (supports * wildcards)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		resp, err := c.ListClasses("")
		if err != nil {
			return fmt.Errorf("failed to list classes: %w", err)
		}

		pattern := args[0]
		var matches []map[string]interface{}

		for _, cls := range resp.Classes {
			name, _ := cls["name"].(string)
			if matchWildcard(pattern, name) {
				matches = append(matches, cls)
			}
		}

		if len(matches) == 0 {
			fmt.Printf("No classes matching '%s'\n", pattern)
			return nil
		}

		fmt.Printf("Found %d classes matching '%s':\n\n", len(matches), pattern)
		for _, cls := range matches {
			name, _ := cls["name"].(string)
			id, _ := cls["id"].(string)
			fw, _ := cls["framework"].(string)
			tag := ""
			if fw == "acss" {
				tag = " [ACSS]"
			}
			fmt.Printf("  %s (%s)%s\n", name, id, tag)
		}
		return nil
	},
}

var classesDeleteCmd = &cobra.Command{
	Use:   "delete <class-id>",
	Short: "Delete a global class by ID",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		if err := c.DeleteClass(args[0]); err != nil {
			return fmt.Errorf("failed to delete class: %w", err)
		}

		fmt.Printf("Deleted class %s\n", args[0])
		return nil
	},
}

// matchWildcard does simple wildcard matching with * support.
func matchWildcard(pattern, s string) bool {
	pattern = strings.ToLower(pattern)
	s = strings.ToLower(s)

	if !strings.Contains(pattern, "*") {
		return strings.Contains(s, pattern)
	}

	parts := strings.Split(pattern, "*")
	pos := 0
	for i, part := range parts {
		if part == "" {
			continue
		}
		idx := strings.Index(s[pos:], part)
		if idx < 0 {
			return false
		}
		if i == 0 && idx != 0 {
			return false
		}
		pos += idx + len(part)
	}
	if parts[len(parts)-1] != "" && pos != len(s) {
		return false
	}
	return true
}

func init() {
	classesListCmd.Flags().String("framework", "", "filter by framework (acss, custom)")
	classesListCmd.Flags().Bool("json", false, "output as JSON")
	classesCreateCmd.Flags().String("settings", "", "class settings as JSON")

	classesCmd.AddCommand(classesListCmd)
	classesCmd.AddCommand(classesCreateCmd)
	classesCmd.AddCommand(classesFindCmd)
	classesCmd.AddCommand(classesDeleteCmd)
	rootCmd.AddCommand(classesCmd)
}
