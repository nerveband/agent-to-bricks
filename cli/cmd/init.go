package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var initSkipTest bool

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Set up Agent to Bricks for AI agent discovery",
	Long: `Initialize Agent to Bricks for use with Claude Code, Gemini CLI, and other
AI agents. This command:

  1. Tests the connection to your Bricks site
  2. Installs a Claude Code skill file (.claude/skills/agent-to-bricks/)
  3. Optionally adds a pointer to CLAUDE.md

After running this, AI agents will automatically discover how to use the
bricks CLI to build and manage your Bricks pages.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)

		// Step 1: Test connection (unless skipped).
		if !initSkipTest {
			if err := requireConfig(); err != nil {
				fmt.Fprintf(os.Stderr, "No site configured. Run 'bricks config init' first.\n")
				return err
			}

			fmt.Fprintf(os.Stderr, "Testing connection to %s...\n", cfg.Site.URL)
			c := newSiteClient()
			info, err := c.GetSiteInfo()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Connection failed: %v\n", err)
				fmt.Fprintf(os.Stderr, "Fix your config with: bricks config init\n")
				return err
			}
			fmt.Fprintf(os.Stderr, "Connected: Bricks %s, WordPress %s, Plugin %s\n",
				info.BricksVersion, info.WPVersion, info.PluginVersion)
		}

		// Step 2: Install skill file.
		cwd, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("cannot determine working directory: %w", err)
		}

		skillDir := filepath.Join(cwd, ".claude", "skills", "agent-to-bricks")
		skillFile := filepath.Join(skillDir, "SKILL.md")
		refDir := filepath.Join(skillDir, "references")

		if err := os.MkdirAll(refDir, 0755); err != nil {
			return fmt.Errorf("cannot create skill directory: %w", err)
		}

		// Write SKILL.md
		if err := os.WriteFile(skillFile, []byte(skillContent()), 0644); err != nil {
			return fmt.Errorf("cannot write SKILL.md: %w", err)
		}
		fmt.Fprintf(os.Stderr, "Installed skill: %s\n", skillFile)

		// Write reference file.
		refFile := filepath.Join(refDir, "bricks-elements.md")
		if err := os.WriteFile(refFile, []byte(elementsReference()), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: could not write reference file: %v\n", err)
		}

		// Step 3: Add pointer to CLAUDE.md if it exists and doesn't already mention ATB.
		claudeFile := filepath.Join(cwd, "CLAUDE.md")
		if data, err := os.ReadFile(claudeFile); err == nil {
			content := string(data)
			if !containsATBPointer(content) {
				pointer := "\n\n## Agent to Bricks\n\nThis project can deploy pages to a Bricks Builder site. Run `/agent-to-bricks` or use the `bricks` CLI. See `.claude/skills/agent-to-bricks/` for details.\n"
				f, err := os.OpenFile(claudeFile, os.O_APPEND|os.O_WRONLY, 0644)
				if err == nil {
					f.WriteString(pointer)
					f.Close()
					fmt.Fprintf(os.Stderr, "Added ATB section to CLAUDE.md\n")
				}
			}
		}

		fmt.Fprintf(os.Stderr, "\nReady. AI agents can now build Bricks pages.\n")
		fmt.Fprintf(os.Stderr, "Try: \"Build me a hero section for page 42\"\n")

		if output.IsJSON() {
			return output.JSON(map[string]interface{}{
				"success":   true,
				"skillDir":  skillDir,
				"skillFile": skillFile,
			})
		}

		return nil
	},
}

func containsATBPointer(content string) bool {
	return len(content) > 0 && (
		contains(content, "agent-to-bricks") ||
		contains(content, "Agent to Bricks") ||
		contains(content, "/agent-to-bricks"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func init() {
	initCmd.Flags().BoolVar(&initSkipTest, "skip-test", false, "skip connection test")
	output.AddFormatFlags(initCmd)
	rootCmd.AddCommand(initCmd)
}

func skillContent() string {
	return `---
name: agent-to-bricks
description: >
  Builds, converts, and deploys pages to a Bricks Builder WordPress site using
  the agent-to-bricks CLI (` + "`bricks`" + `). Use when the user asks to create a page,
  deploy HTML, build a landing page, update a Bricks site, push content to
  WordPress, convert HTML to Bricks, or manage Bricks Builder elements. Also
  activates when the user mentions Bricks Builder, ACSS, Automatic.css, or
  references their WordPress site in the context of page building.
---

# Agent to Bricks — Build & Deploy Bricks Pages

You have access to the ` + "`bricks`" + ` CLI which manages a Bricks Builder WordPress site.
It can convert HTML to native Bricks elements, push content to pages, and query
the site's design system — all without leaving the terminal.

## Quick Start Workflow

When the user asks you to build or update a Bricks page, follow these steps:

### Step 1: Discover the site's design system

` + "```bash" + `
bricks discover --json
` + "```" + `

This returns the site's colors, fonts, spacing variables, CSS framework classes,
available element types, and pages. Pay attention to:
- **CSS variables** (` + "`--primary`" + `, ` + "`--space-m`" + `) — use these in your HTML
- **Global classes** (ACSS utilities) — add these as CSS classes
- **Breakpoints** — the site's responsive breakpoint widths

### Step 2: Generate HTML using the site's design tokens

Write clean, semantic HTML that uses the site's CSS variables and class names.
Structure your HTML with ` + "`<section>`" + ` > ` + "`<div>`" + ` > content elements.

### Step 3: Convert and push to the site

` + "```bash" + `
# Convert HTML and push directly to a page
bricks convert html --push PAGE_ID --stdin <<'HTML'
<section>...</section>
HTML

# Or from a file
bricks convert html page.html --push PAGE_ID

# Preview without pushing (dry run)
bricks convert html --push PAGE_ID --dry-run --stdin <<'HTML'
<section>...</section>
HTML

# Snapshot before pushing (for rollback)
bricks convert html --push PAGE_ID --snapshot --stdin <<'HTML'
<section>...</section>
HTML
` + "```" + `

### Step 4: Verify

` + "```bash" + `
# Use --dry-run before pushing to preview the conversion
bricks convert html --push PAGE_ID --dry-run --stdin <<'HTML'
<section>...</section>
HTML
` + "```" + `

## Patching Existing Elements (Preferred for Updates)

Use ` + "`bricks patch`" + ` to modify existing elements without regenerating the page:

` + "```bash" + `
bricks patch PAGE_ID --list                           # find element IDs
bricks patch PAGE_ID -e ID --set '_cssClasses=new'    # change classes
bricks patch PAGE_ID -e ID --set 'text=New Heading'   # change text
bricks patch PAGE_ID -e ID --rm '_padding'             # remove setting
` + "```" + `

**Patch for updates, convert for new content.**

## Available Commands

| Command | Description |
|---------|-------------|
| ` + "`bricks discover --json`" + ` | Full site context dump (run first) |
| ` + "`bricks convert html [file] --push ID`" + ` | Convert HTML and push to page |
| ` + "`bricks convert html --stdin`" + ` | Read HTML from stdin pipe |
| ` + "`bricks patch ID --list`" + ` | List elements with IDs on a page |
| ` + "`bricks patch ID -e EL --set k=v`" + ` | Patch element settings |
| ` + "`bricks elements types --json`" + ` | List available Bricks element types |
| ` + "`bricks classes --json`" + ` | Global CSS classes |
| ` + "`bricks frameworks --json`" + ` | CSS framework config (ACSS) |
| ` + "`bricks schema`" + ` | Bricks element JSON schema |

## Key Principles

1. **Always call ` + "`bricks discover --json`" + ` first** to learn the design system
2. **Prefer ` + "`bricks patch`" + ` for updates** — don't regenerate what you can patch
3. **Use the site's CSS variables** — not hardcoded values
4. **Use ACSS global classes** when available
5. **Use ` + "`--snapshot`" + `** when pushing to important pages
6. **Use ` + "`--json`" + `** on any command for structured output
7. **Structure HTML as**: section → div (container) → content elements

## Element Mapping

| HTML Tag | Bricks Element |
|----------|---------------|
| section, header, footer, main, article | section |
| div, aside, nav | div |
| h1-h6 | heading |
| p, span, blockquote | text-basic |
| a | text-link |
| button | button |
| img | image |
| video | video |
| ul, ol | list |
| form | form |
| code, pre | code |

## Error Recovery

- 409 conflict: re-fetch elements and retry
- 401/403: check API key with ` + "`bricks doctor`" + `
- Bad results: use ` + "`--dry-run`" + ` to inspect before pushing
- Undo: ` + "`bricks elements PAGE_ID rollback SNAP_ID`" + `
`
}

func elementsReference() string {
	return `# Bricks Element JSON Reference

## Flat Format (database storage)

Each element has: id, name, label, parent, children[], settings{}

## Key Settings

- _padding, _margin: { top, right, bottom, left }
- _typography: { font-size, font-weight, color: { raw }, text-align }
- _background: { color: { raw } }
- _display, _direction, _justifyContent, _alignItems
- _gap, _gridTemplateColumns
- _width, _maxWidth, _height, _minHeight
- _borderRadius, _overflow, _position, _zIndex, _opacity
- _cssGlobalClasses: [class IDs], _cssClasses: "space separated"
- text: content string, tag: HTML tag, link: { type, url, newTab }
`
}
