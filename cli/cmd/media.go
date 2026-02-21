package cmd

import (
	"fmt"
	"text/tabwriter"
	"os"

	"github.com/spf13/cobra"
)

var mediaCmd = &cobra.Command{
	Use:   "media",
	Short: "Media library management",
}

var mediaUploadCmd = &cobra.Command{
	Use:   "upload <file>",
	Short: "Upload a file to the WordPress media library",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()
		resp, err := c.UploadMedia(args[0])
		if err != nil {
			return fmt.Errorf("upload failed: %w", err)
		}
		fmt.Printf("ID:       %d\n", resp.ID)
		fmt.Printf("URL:      %s\n", resp.URL)
		fmt.Printf("Type:     %s\n", resp.MimeType)
		fmt.Printf("Filename: %s\n", resp.Filename)
		fmt.Printf("Size:     %d bytes\n", resp.Filesize)
		return nil
	},
}

var mediaListSearch string

var mediaListCmd = &cobra.Command{
	Use:   "list",
	Short: "List media library items",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()
		resp, err := c.ListMedia(mediaListSearch)
		if err != nil {
			return fmt.Errorf("list failed: %w", err)
		}
		if resp.Count == 0 {
			fmt.Println("No media items found.")
			return nil
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTITLE\tTYPE\tSIZE\tURL")
		for _, m := range resp.Media {
			fmt.Fprintf(w, "%d\t%s\t%s\t%d\t%s\n", m.ID, m.Title, m.MimeType, m.Filesize, m.URL)
		}
		w.Flush()
		fmt.Printf("\n%d items\n", resp.Count)
		return nil
	},
}

func init() {
	mediaListCmd.Flags().StringVarP(&mediaListSearch, "search", "s", "", "search term")

	mediaCmd.AddCommand(mediaUploadCmd)
	mediaCmd.AddCommand(mediaListCmd)
	rootCmd.AddCommand(mediaCmd)
}
