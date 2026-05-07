---
title: Discover & Patch commands
description: Discover site context for AI agents and patch existing elements in place.
---

## bricks discover

Dumps the full site context in a single call — site info, CSS frameworks, global classes, Bricks Style Manager data, global queries, and CSS variables. Designed for AI agents that need to understand the design system before generating content.

### Basic usage

```bash
bricks discover --json
```

### What it returns

```json
{
  "summary": {
    "siteURL": "https://your-site.com",
    "bricksVersion": "2.3.4",
    "pluginVersion": "2.3.0",
    "wpVersion": "6.9.4",
    "contentMetaKey": "_bricks_page_content_2",
    "elementTypeCount": 85,
    "breakpointCount": 4
  },
  "site": {
    "url": "https://your-site.com",
    "bricksVersion": "2.3.4",
    "wpVersion": "6.9.4",
    "pluginVersion": "2.3.0",
    "elementTypes": ["section", "container", "heading", "..."],
    "breakpoints": [...]
  },
  "features": {
    "frameworks": ["acss"],
    "queryElements": ["posts", "products"],
    "globalQueries": {"count": 2, "categoryCount": 1},
    "woocommerce": true,
    "abilities": true
  },
  "styles": {
    "themeStyleCount": 1,
    "styleManager": {"...": "..."},
    "colorPalette": [],
    "cssColorCount": 24
  },
  "globalQueries": {
    "queries": [],
    "categories": [],
    "count": 0
  },
  "frameworks": {
    "acss": { "name": "Automatic.css", "active": true, "..." }
  },
  "classes": {
    "total": 2701,
    "grouped": {
      "acss": ["grid--3", "btn--primary", "text--primary", "..."],
      "frames": ["fr-card", "fr-hero", "..."],
      "custom": ["my-custom-class"]
    }
  },
  "variables": ["--primary", "--secondary", "--space-m", "--h1", "..."]
}
```

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as structured JSON (recommended) |
| `--format` | Output format: `json` or `table` |

### Use with AI agents

This is the recommended first call in any AI workflow. The output gives the agent everything it needs to generate HTML that matches the site's design system:

```bash
# AI agent workflow
bricks discover --json          # Learn the design system
# Generate HTML using the CSS variables and classes from discover
bricks convert html --push 42 --stdin <<'HTML'
<section style="padding: var(--section-space-m)">...</section>
HTML
```

---

## bricks patch

Update specific elements on a page without regenerating the full page. Sends only the changed settings — faster and cheaper than a full replace.

### List elements (find IDs)

```bash
bricks patch 1297 --list
```

```
ID      TYPE        LABEL           PARENT  CLASSES
dbd436  section     Hero Section    0       section--dark
80b319  div         Container       dbd436
1b0af8  heading     Main Heading    80b319
ec76d6  text-basic  Subtitle        80b319

4 elements (hash: 4a6a8c942434934acc820ef08c67ca86)
```

Filter by element type or label (server-side):

```bash
bricks patch 1297 --list --type section
bricks patch 1297 --list --name "Call to Action"
bricks patch 1297 --list --type heading --json
```

Use `--json` for structured output:

```bash
bricks patch 1297 --list --json
```

### Patch settings by element ID

```bash
# Change classes
bricks patch 1297 -e abc123 --set '_cssClasses=btn--primary hero-btn'

# Change text content
bricks patch 1297 -e abc123 --set 'text=Updated Heading'

# Change multiple settings at once
bricks patch 1297 -e abc123 --set '_display=flex' --set '_gap=var(--space-m)'

# Set complex/nested values with JSON
bricks patch 1297 -e abc123 --set '_background={"color":{"raw":"var(--primary)"}}'
bricks patch 1297 -e abc123 --set '_typography={"font-size":"var(--h2)","font-weight":"700"}'

# Remove a setting
bricks patch 1297 -e abc123 --rm '_padding'
```

### Multi-element patch via file or stdin

For patching multiple elements at once, use a JSON file or pipe:

```bash
# From a file (preferred — avoids shell escaping issues)
bricks patch 1297 --file patch.json

# From stdin
cat patch.json | bricks patch 1297 --stdin
```

### Auto-snapshot and undo

A snapshot is automatically created before each patch. To undo:

```bash
bricks patch 1297 --undo
```

Skip the auto-snapshot with `--no-snapshot` for faster operations when you don't need rollback safety.

### Find pages by title

```bash
bricks search pages "Home"
bricks search pages --json
```

### Flags

| Flag | Description |
|------|-------------|
| `--list` | List elements with IDs (discover what to patch) |
| `--type` | Filter `--list` by element type (e.g. section, heading) |
| `--name` | Filter `--list` by label (case-insensitive substring) |
| `-e`, `--element` | Element ID to patch |
| `--set` | Set a setting: `key=value` (repeatable) |
| `--rm` | Remove a setting key (repeatable) |
| `--stdin` | Read JSON patches from stdin |
| `-f`, `--file` | Read JSON patches from a file |
| `--dry-run` | Show patch payload without sending |
| `--no-snapshot` | Skip automatic pre-patch snapshot |
| `--undo` | Rollback to the most recent pre-patch snapshot |
| `--json` | Structured JSON output |
| `--fields` | Limit JSON fields, including dotted paths like `summary.bricksVersion` |
| `--limit` | Limit row-oriented output |
| `--page` | Return a specific page of row-oriented output |
| `--page-all` | Emit all rows where pagination is local/client-side |
| `--ndjson` | Emit one JSON object per row for streaming agents |

### Agent DX controls

Most large read commands now share the same context-window controls:

```bash
bricks discover --json --fields summary,features.globalQueries
bricks patch 1297 --list --json --fields id,name,label --limit 20
bricks search elements --has-query --ndjson --fields postId,elementId,elementType
bricks classes list --json --fields id,name,framework --limit 50 --page 2
bricks elements types --json --fields name,label,category
bricks abilities list --ndjson --fields name,category,annotations.readonly
```

Mutating commands expose `--dry-run` where practical, including `site push`,
`site patch`, `site snapshot`, `site rollback`, `patch`, `classes create/delete`,
`media upload`, `templates import`, `compose --push`, `styles learn/reset`, and
`update`. Dry-run output includes the method, target endpoint or local action,
and payload without applying side effects.

### When to use patch vs convert

| Scenario | Command |
|----------|---------|
| Change classes on existing elements | `bricks patch` |
| Update text content | `bricks patch` |
| Tweak styles (colors, spacing, typography) | `bricks patch` |
| Build a new section from HTML | `bricks convert html` |
| Replace an entire page | `bricks convert html --push ID` |
| Add a section to an existing page | `bricks convert html` + REST API append |

---

## bricks init

Set up the project for AI agent discovery. Installs a Claude Code skill file and tests the site connection.

### Basic usage

```bash
bricks init
```

```
Testing connection to https://your-site.com...
Connected: Bricks 2.3, WordPress 6.9.4, Plugin 2.3.0
Installed skill: .claude/skills/agent-to-bricks/SKILL.md

Ready. AI agents can now build Bricks pages.
Try: "Build me a hero section for page 42"
```

### What it does

1. **Tests the connection** to your Bricks site (using config from `~/.agent-to-bricks/config.yaml`)
2. **Installs a skill file** at `.claude/skills/agent-to-bricks/SKILL.md` that teaches Claude Code (and other AI agents) how to use the `bricks` CLI
3. **Adds a pointer** to your project's `CLAUDE.md` if it exists

After running `bricks init`, AI agents will automatically discover the skill and know how to build Bricks pages without any user explanation.

### Flags

| Flag | Description |
|------|-------------|
| `--skip-test` | Skip the connection test (useful in CI or when config isn't set up yet) |
| `--json` | Output result as JSON |
