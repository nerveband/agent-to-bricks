package cmd

import (
	"fmt"
	"strconv"

	"github.com/nerveband/agent-to-bricks/internal/doctor"
	"github.com/spf13/cobra"
)

var doctorCmd = &cobra.Command{
	Use:   "doctor <page-id>",
	Short: "Run health checks on a Bricks page",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid page ID: %s", args[0])
		}

		c := newSiteClient()
		resp, err := c.GetElements(pageID)
		if err != nil {
			return fmt.Errorf("failed to pull elements: %w", err)
		}

		fmt.Printf("Checking page %d (%d elements)...\n\n", pageID, resp.Count)

		report := doctor.Check(resp.Elements)

		if len(report.Issues) == 0 {
			fmt.Println("No issues found. Page is healthy!")
			return nil
		}

		for _, issue := range report.Issues {
			icon := "?"
			switch issue.Severity {
			case "error":
				icon = "x"
			case "warning":
				icon = "!"
			case "info":
				icon = "i"
			}
			elInfo := ""
			if issue.ElementID != "" {
				elInfo = fmt.Sprintf(" [%s]", issue.ElementID)
			}
			fmt.Printf("  %s [%s]%s %s\n", icon, issue.Check, elInfo, issue.Message)
		}

		fmt.Printf("\nSummary: %d errors, %d warnings, %d info\n",
			report.Summary["error"], report.Summary["warning"], report.Summary["info"])

		if report.Summary["error"] > 0 {
			return fmt.Errorf("page has %d errors", report.Summary["error"])
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(doctorCmd)
}
