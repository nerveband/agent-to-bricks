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
available element types, Bricks Style Manager settings, global query presets,
and pages. Pay attention to:
- **CSS variables** (`--primary`, `--space-m`) — use these in your HTML
- **Global classes** (ACSS utilities) — add these as CSS classes
- **Breakpoints** — the site's responsive breakpoint widths
- **summary** — stable top-level versions, content meta key, and element count
- **globalQueries** — query presets/categories to reuse instead of inventing filters

### Step 2: Find the page to work on

```bash
# Search for pages by title
bricks search pages "Home"
bricks search pages "Contact" --json

# List all pages with Bricks content
bricks search pages
```

### Step 3: Generate HTML using the site's design tokens

Write clean, semantic HTML that uses the site's CSS variables and class names.
Structure your HTML with `<section>` > `<div>` > content elements.

### Step 4: Convert and push to the site

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

### Step 5: Verify

```bash
# Preview the conversion without pushing
bricks convert html --push PAGE_ID --dry-run --stdin <<'HTML'
<section>...</section>
HTML
```

## Patching Existing Elements (Preferred for Updates)

When you need to **modify** an existing page (change classes, text, styles),
use `bricks patch` instead of regenerating the full page. It's faster and
uses fewer tokens. A snapshot is automatically created before each patch.

### Find elements to patch

```bash
# List all elements on a page
bricks patch PAGE_ID --list

# Filter by element type (server-side)
bricks patch PAGE_ID --list --type section
bricks patch PAGE_ID --list --type heading --json

# Filter by label (case-insensitive substring, server-side)
bricks patch PAGE_ID --list --name "Call to Action"
bricks patch PAGE_ID --list --name "Hero" --json
```

### Patch specific settings by element ID

```bash
bricks patch PAGE_ID -e ELEMENT_ID --set '_cssClasses=new-class another'
bricks patch PAGE_ID -e ELEMENT_ID --set 'text=Updated Heading'
bricks patch PAGE_ID -e ELEMENT_ID --set '_display=flex' --set '_gap=var(--space-m)'

# JSON values for nested settings (background, typography, gradient)
bricks patch PAGE_ID -e ELEMENT_ID --set '_background={"color":{"raw":"var(--primary)"}}'
bricks patch PAGE_ID -e ELEMENT_ID --set '_typography={"font-size":"var(--h2)","font-weight":"700"}'

# Remove a setting
bricks patch PAGE_ID -e ELEMENT_ID --rm '_padding'
```

### Multi-element patch via file (preferred) or stdin

Write patches to a JSON file to avoid shell escaping issues:

```bash
# From a file (preferred)
bricks patch PAGE_ID --file patch.json

# From stdin
cat patch.json | bricks patch PAGE_ID --stdin
```

Patch JSON format:
```json
{
  "patches": [
    {"id": "abc123", "settings": {"_cssClasses": "hero-dark"}},
    {"id": "def456", "settings": {"text": "New text", "_display": "flex"}}
  ]
}
```

### Undo a patch

```bash
bricks patch PAGE_ID --undo
```

This rolls back to the most recent pre-patch snapshot. Skip auto-snapshot
with `--no-snapshot` when you don't need rollback safety.

### Preview without applying

```bash
bricks patch PAGE_ID -e ELEMENT_ID --set 'text=Preview' --dry-run
bricks patch PAGE_ID --file patch.json --dry-run
```

### When to use patch vs convert

- **Patch**: changing classes, text, styles, settings on existing elements
- **Convert**: creating new sections/pages from HTML
- **Global classes**: when the same style applies across multiple pages, update
  the global class instead of patching each page individually

## Available Commands

| Command | Description |
|---------|-------------|
| `bricks discover --json` | Full site context dump (run first) |
| `bricks search pages [term]` | Find pages with Bricks content by title |
| `bricks convert html [file] --push ID` | Convert HTML and push to page |
| `bricks convert html --stdin` | Read HTML from stdin pipe |
| `bricks patch ID --list` | List elements with IDs on a page |
| `bricks patch ID --list --type T` | Filter elements by type (server-side) |
| `bricks patch ID --list --name N` | Filter elements by label (server-side) |
| `bricks patch ID -e EL --set k=v` | Patch element settings |
| `bricks patch ID --file F` | Patch from a JSON file |
| `bricks patch ID --undo` | Rollback to pre-patch snapshot |
| `bricks elements types --json` | List available Bricks element types |
| `bricks site info --json` | Bricks/WP versions, element types |
| `bricks classes list --json` | Global CSS classes |
| `bricks frameworks --json` | CSS framework config (ACSS) |
| `bricks schema` | Bricks element JSON schema |

## Key Principles

1. **Always call `bricks discover --json` first** to learn the design system
2. **Use `bricks search pages` to find page IDs** — don't guess
3. **Prefer `bricks patch` for updates** — don't regenerate what you can patch
4. **Use `--list --type/--name` to filter** — don't eyeball 200 elements
5. **Use `--file` for multi-element patches** — avoids shell escaping issues
6. **Use the site's CSS variables** — not hardcoded values
7. **Use ACSS global classes** when available — one change updates all pages
8. **Use `--snapshot`** when pushing to important pages
9. **Use `--json`** on any command for structured output
10. **Use `--fields`, `--limit`, `--page`, or `--ndjson`** before asking for large payloads
11. **Use `--dry-run`** before mutating commands when risk is non-trivial
12. **Structure HTML as**: section > div (container) > content elements

## Agent DX Controls

Use these shared flags on large reads:

```bash
bricks discover --json --fields summary,features.globalQueries
bricks patch PAGE_ID --list --json --fields id,name,label --limit 20
bricks search elements --has-query --ndjson --fields postId,elementId,elementType
bricks classes list --json --fields id,name,framework --limit 50 --page 2
```

Use `--dry-run` on mutating commands before applying changes:

```bash
bricks site push PAGE_ID page.json --dry-run
bricks site patch PAGE_ID --file patch.json --dry-run
bricks classes create new-class --settings '{}' --dry-run
bricks media upload hero.jpg --dry-run
bricks compose hero faq --push PAGE_ID --dry-run
```

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
- Undo: `bricks patch PAGE_ID --undo`
