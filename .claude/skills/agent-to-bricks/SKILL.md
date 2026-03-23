---
name: agent-to-bricks
description: >
  Builds, converts, and deploys pages to a Bricks Builder WordPress site using
  the agent-to-bricks CLI (`bricks`). Use when the user asks to create a page,
  deploy HTML, build a landing page, update a Bricks site, push content to
  WordPress, convert HTML to Bricks, or manage Bricks Builder elements. Also
  activates when the user mentions Bricks Builder, ACSS, Automatic.css, or
  references their WordPress site in the context of page building.
---

# Agent to Bricks — Build & Deploy Bricks Pages

You have access to the `bricks` CLI which manages a Bricks Builder WordPress site.
It can convert HTML to native Bricks elements, push content to pages, and query
the site's design system — all without leaving the terminal.

## Quick Start Workflow

When the user asks you to build or update a Bricks page, follow these steps:

### Step 1: Discover the site's design system

```bash
bricks discover --json
```

This returns the site's colors, fonts, spacing variables, CSS framework classes,
available element types, and pages. Pay attention to:
- **CSS variables** (`--primary`, `--space-m`) — use these in your HTML
- **Global classes** (ACSS utilities) — add these as CSS classes
- **Breakpoints** — the site's responsive breakpoint widths

### Step 2: Generate HTML using the site's design tokens

Write clean, semantic HTML that uses the site's CSS variables and class names.
Structure your HTML with `<section>` > `<div>` > content elements.

### Step 3: Convert and push to the site

```bash
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
```

### Step 4: Verify

```bash
# Use the REST API to check page elements (the CLI handles auth from config)
curl -s -H "X-ATB-Key: $(grep api_key ~/.agent-to-bricks/config.yaml | awk '{print $2}')" \
  "$(grep url ~/.agent-to-bricks/config.yaml | awk '{print $2}')/wp-json/agent-bricks/v1/pages/PAGE_ID/elements"

# Or just use --dry-run before pushing to preview the conversion
bricks convert html --push PAGE_ID --dry-run --stdin <<'HTML'
<section>...</section>
HTML
```

## Patching Existing Elements (Preferred for Updates)

When you need to **modify** an existing page (change classes, text, styles),
use `bricks patch` instead of regenerating the full page. It's faster and
uses fewer tokens.

```bash
# Step 1: List elements to find IDs
bricks patch PAGE_ID --list
bricks patch PAGE_ID --list --json    # structured output

# Step 2: Patch specific settings by element ID
bricks patch PAGE_ID -e ELEMENT_ID --set '_cssClasses=new-class another'
bricks patch PAGE_ID -e ELEMENT_ID --set 'text=Updated Heading'
bricks patch PAGE_ID -e ELEMENT_ID --set '_display=flex' --set '_gap=var(--space-m)'

# Patch with JSON values (for nested settings like background, typography)
bricks patch PAGE_ID -e ELEMENT_ID --set '_background={"color":{"raw":"var(--primary)"}}'
bricks patch PAGE_ID -e ELEMENT_ID --set '_typography={"font-size":"var(--h2)","font-weight":"700"}'

# Remove a setting
bricks patch PAGE_ID -e ELEMENT_ID --rm '_padding'

# Multi-element patch via JSON stdin
echo '{"patches":[
  {"id":"abc123","settings":{"_cssClasses":"hero-dark"}},
  {"id":"def456","settings":{"text":"New text"}}
]}' | bricks patch PAGE_ID --stdin

# Preview without applying
bricks patch PAGE_ID -e ELEMENT_ID --set 'text=Preview' --dry-run
```

**When to use patch vs convert:**
- **Patch**: changing classes, text, styles, settings on existing elements
- **Convert**: creating new sections/pages from HTML

## Available Commands

| Command | Description |
|---------|-------------|
| `bricks discover --json` | Full site context dump (run first) |
| `bricks convert html [file] --push ID` | Convert HTML and push to page |
| `bricks convert html --stdin` | Read HTML from stdin pipe |
| `bricks patch ID --list` | List elements with IDs on a page |
| `bricks patch ID -e EL --set k=v` | Patch element settings |
| `bricks elements types --json` | List available Bricks element types |
| `bricks site info --json` | Bricks/WP versions, element types |
| `bricks classes --json` | Global CSS classes |
| `bricks frameworks --json` | CSS framework config (ACSS) |
| `bricks schema` | Bricks element JSON schema |

## Key Principles

1. **Always call `bricks discover --json` first** to learn the design system
2. **Prefer `bricks patch` for updates** — don't regenerate what you can patch
3. **Use the site's CSS variables** — not hardcoded values
4. **Use ACSS global classes** when available
5. **Use `--snapshot`** when pushing to important pages
6. **Use `--json`** on any command for structured output
7. **Pipe HTML from stdin** with `--stdin` for seamless workflow
8. **Structure HTML as**: section → div (container) → content elements

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
- 401/403: check API key with `bricks doctor`
- Bad results: use `--dry-run` to inspect before pushing
- Undo: `bricks elements PAGE_ID rollback SNAP_ID`
