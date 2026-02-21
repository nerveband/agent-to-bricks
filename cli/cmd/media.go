package cmd

import (
	"fmt"

	"github.com/nerveband/agent-to-bricks/internal/wpcli"
	"github.com/spf13/cobra"
)

func newWPCLI() *wpcli.Client {
	// For now, only SSH mode supported (based on config)
	// Future: support local mode detection
	return wpcli.New(wpcli.Config{
		Mode: wpcli.ModeDisabled,
	})
}

var mediaCmd = &cobra.Command{
	Use:   "media",
	Short: "Media library management (requires WP-CLI)",
}

var mediaUploadCmd = &cobra.Command{
	Use:   "upload <file>",
	Short: "Upload a file to the WordPress media library",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c := newWPCLI()
		id, err := c.MediaImport(args[0])
		if err != nil {
			return fmt.Errorf("upload failed: %w", err)
		}
		fmt.Printf("Uploaded: attachment ID %s\n", id)
		return nil
	},
}

var mediaListSearch string

var mediaListCmd = &cobra.Command{
	Use:   "list",
	Short: "List media library items",
	RunE: func(cmd *cobra.Command, args []string) error {
		c := newWPCLI()
		out, err := c.MediaList(mediaListSearch)
		if err != nil {
			return fmt.Errorf("list failed: %w", err)
		}
		fmt.Println(out)
		return nil
	},
}

func init() {
	mediaListCmd.Flags().StringVarP(&mediaListSearch, "search", "s", "", "search term")

	mediaCmd.AddCommand(mediaUploadCmd)
	mediaCmd.AddCommand(mediaListCmd)
	rootCmd.AddCommand(mediaCmd)
}
