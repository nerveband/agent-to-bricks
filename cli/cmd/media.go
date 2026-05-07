package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var mediaCmd = &cobra.Command{
	Use:   "media",
	Short: "Media library management",
}

var mediaUploadCmd = &cobra.Command{
	Use:   "upload <file>",
	Short: "Upload a file to the WordPress media library",
	Example: `  bricks media upload hero.jpg
  bricks media upload ./assets/banner.png --format json`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		if getDX(cmd).DryRun {
			return dryRun(cmd, "POST", "/media/upload", map[string]interface{}{"file": args[0]})
		}
		c := newSiteClient()
		resp, err := c.UploadMedia(args[0])
		if err != nil {
			return fmt.Errorf("upload failed: %w", err)
		}
		if output.IsJSON() {
			return output.JSON(resp)
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
	Example: `  bricks media list
  bricks media list --search "hero" --format json`,
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()
		resp, err := c.ListMedia(mediaListSearch)
		if err != nil {
			return fmt.Errorf("list failed: %w", err)
		}
		if output.IsJSON() || getDX(cmd).NDJSON {
			return writeDXCollection(cmd, resp.Media, map[string]interface{}{}, "media")
		}
		if resp.Count == 0 {
			fmt.Println("No media items found.")
			return nil
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTITLE\tTYPE\tSIZE\tURL")
		rows := paginate(normalizeSlice(resp.Media), getDX(cmd).Limit, getDX(cmd).Page)
		for _, item := range rows {
			m, _ := item.(map[string]interface{})
			fmt.Fprintf(w, "%.0f\t%s\t%s\t%.0f\t%s\n", m["id"], m["title"], m["mimeType"], m["filesize"], m["url"])
		}
		w.Flush()
		fmt.Printf("\n%d items\n", resp.Count)
		return nil
	},
}

func init() {
	mediaListCmd.Flags().StringVarP(&mediaListSearch, "search", "s", "", "search term")
	output.AddFormatFlags(mediaUploadCmd)
	addDryRunFlag(mediaUploadCmd)
	output.AddFormatFlags(mediaListCmd)
	addReadDXFlags(mediaListCmd, 0)

	mediaCmd.AddCommand(mediaUploadCmd)
	mediaCmd.AddCommand(mediaListCmd)
	rootCmd.AddCommand(mediaCmd)
}
