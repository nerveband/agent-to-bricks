package wpcli

import (
	"fmt"
	"os/exec"
	"strings"
)

// Mode represents how WP-CLI is accessed.
type Mode string

const (
	ModeLocal    Mode = "local"
	ModeSSH      Mode = "ssh"
	ModeDisabled Mode = "disabled"
)

// Config holds WP-CLI connection settings.
type Config struct {
	Mode Mode
	SSH  string // user@host for SSH mode
	Path string // WordPress path on server
	PHP  string // PHP binary path (optional)
}

// Client wraps WP-CLI command execution.
type Client struct {
	config Config
}

// New creates a WP-CLI client.
func New(cfg Config) *Client {
	return &Client{config: cfg}
}

// Run executes a WP-CLI command and returns the output.
func (c *Client) Run(args ...string) (string, error) {
	if c.config.Mode == ModeDisabled {
		return "", fmt.Errorf("WP-CLI is disabled")
	}

	var cmd *exec.Cmd

	if c.config.Mode == ModeSSH {
		// Build remote command
		wpCmd := "wp"
		if c.config.PHP != "" {
			wpCmd = c.config.PHP + " /usr/local/bin/wp"
		}
		remoteArgs := append([]string{wpCmd}, args...)
		if c.config.Path != "" {
			remoteArgs = append(remoteArgs, "--path="+c.config.Path)
		}
		sshArgs := []string{c.config.SSH, strings.Join(remoteArgs, " ")}
		cmd = exec.Command("ssh", sshArgs...)
	} else {
		// Local mode
		wpArgs := args
		if c.config.Path != "" {
			wpArgs = append(wpArgs, "--path="+c.config.Path)
		}
		cmd = exec.Command("wp", wpArgs...)
	}

	out, err := cmd.CombinedOutput()
	output := strings.TrimSpace(string(out))
	if err != nil {
		return output, fmt.Errorf("WP-CLI error: %s (output: %s)", err, output)
	}
	return output, nil
}

// MediaImport imports a file into the WordPress media library.
// Returns the attachment ID.
func (c *Client) MediaImport(filePath string) (string, error) {
	out, err := c.Run("media", "import", filePath, "--porcelain")
	if err != nil {
		return "", err
	}
	// --porcelain returns just the ID
	return strings.TrimSpace(out), nil
}

// MediaList lists media items matching optional search.
func (c *Client) MediaList(search string) (string, error) {
	args := []string{"post", "list", "--post_type=attachment", "--format=table", "--fields=ID,post_title,post_mime_type"}
	if search != "" {
		args = append(args, "--s="+search)
	}
	return c.Run(args...)
}

// Detect returns the detected WP-CLI mode.
func Detect() Mode {
	// Check if wp command is available locally
	_, err := exec.LookPath("wp")
	if err == nil {
		return ModeLocal
	}
	return ModeDisabled
}
