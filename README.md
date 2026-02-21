# Agent to Bricks

A Go CLI and WordPress plugin for building Bricks Builder pages from the command line. Write HTML with ACSS utility classes, convert it to Bricks element JSON, push it to any page. Works for humans typing commands and for LLMs generating pages programmatically.

## What this does

Bricks Builder stores page content as a JSON tree of elements. Each element has an ID, a type (section, div, heading, text, image, etc.), parent/child relationships, and a settings object that controls everything from typography to padding to background images.

This project gives you:

1. **A WordPress plugin** (`plugin/agent-to-bricks/`) that exposes a REST API for reading, writing, patching, and snapshotting Bricks page content
2. **A Go CLI** (`cli/`) that talks to that API and adds HTML-to-Bricks conversion, template composition, AI generation, health checks, and full LLM self-discovery

The idea is simple: show an LLM your site's design tokens, utility classes, and templates. It writes HTML. The CLI converts that HTML to Bricks elements and pushes it to a page. No visual editor involved.

## Quick start

### 1. Install the WordPress plugin

Copy `plugin/agent-to-bricks/` to your WordPress plugins directory:

```bash
cp -r plugin/agent-to-bricks/ /path/to/wp-content/plugins/
```

Activate it in WP Admin. Go to **Settings > Agent to Bricks** to generate an API key.

### 2. Build and install the CLI

```bash
make build        # Outputs bin/bricks
make install      # Copies to /usr/local/bin/bricks
```

Or build directly:

```bash
cd cli && go build -o bricks .
```

### 3. Connect to your site

```bash
bricks config init              # Interactive TUI setup
# or manually:
bricks config set site.url https://your-site.com
bricks config set site.api_key YOUR_API_KEY
```

Config lives at `~/.agent-to-bricks/config.yaml`.

### 4. Verify the connection

```bash
bricks site info
bricks doctor 1234    # Health check any page by ID
```

## Command reference

### Site operations

```bash
bricks site info                          # Bricks version, PHP, WP, element types
bricks site frameworks                    # Detect ACSS, show design tokens
bricks site pull <page-id>               # Pull elements as JSON
bricks site pull <page-id> -o page.json  # Save to file
bricks site push <page-id> page.json     # Full replace (requires contentHash)
bricks site patch <page-id> -f patch.json # Patch specific elements
bricks site snapshot <page-id>           # Create a snapshot (rollback point)
bricks site snapshots <page-id>          # List all snapshots
bricks site rollback <page-id>           # Rollback to latest snapshot
bricks site rollback <page-id> <snap-id> # Rollback to specific snapshot
```

### HTML to Bricks conversion

Converts HTML to Bricks element JSON. When connected to a site with ACSS + Frames, CSS classes are resolved to their global class IDs automatically.

```bash
# Convert a file
bricks convert html page.html

# Pipe from stdin (great for LLM output)
echo '<section class="section--l bg--primary-dark">...</section>' | bricks convert html --stdin

# Convert and push directly to a page
bricks convert html page.html --push 1460

# Use cached class registry (faster, skips API call)
bricks convert html page.html --class-cache

# Create safety snapshot before pushing
bricks convert html page.html --push 1460 --snapshot

# Preview without pushing
bricks convert html page.html --push 1460 --dry-run

# Save to file
bricks convert html page.html -o elements.json
```

**How class resolution works:**

1. The CLI fetches all global classes from your site (ACSS utilities + Frames components)
2. HTML class names like `section--l`, `bg--primary-dark`, `fr-hero` are matched against the registry
3. Matched classes become `_cssGlobalClasses` entries (array of Bricks class IDs)
4. Unmatched classes go to `_cssClasses` (inline custom classes)
5. Inline styles are parsed into native Bricks settings (`_typography`, `_padding`, `_background`, etc.)

### AI generation

Generate Bricks elements using any OpenAI-compatible LLM:

```bash
bricks config set llm.provider openai
bricks config set llm.api_key sk-...
bricks config set llm.model gpt-4o

# Generate a single section
bricks generate section "dark hero with CTA buttons" --page 1460

# Generate a full page
bricks generate page "SaaS landing page with pricing" --page 1460

# Modify existing content
bricks generate modify "change the hero headline to Welcome" --page 1460

# Preview without pushing
bricks generate section "testimonial grid" --dry-run
bricks generate section "testimonial grid" -o section.json
```

### Templates

Local template library with import, search, and composition:

```bash
# List all templates
bricks templates list

# Show template details
bricks templates show hero-cali

# Import from file or directory (supports Frames export format)
bricks templates import ./my-templates/
bricks templates import hero-section.json

# Learn from an existing page (splits into section templates)
bricks templates learn <page-id>

# Search templates by description
bricks templates search "dark hero with gradient"

# Compose multiple templates into a single page
bricks compose hero-cali feature-havana footer-amsterdam -o page.json

# Compose and push directly
bricks compose hero-cali pricing-alpha --push 1460
```

Frames library templates include both elements and global classes. When composing, the engine merges classes across templates, deduplicates by name, and remaps IDs to prevent collisions.

### Agent context (LLM self-discovery)

This is the command LLMs should run first. It dumps your site's full design context in a format they can read:

```bash
# Full markdown context — paste into any LLM chat
bricks agent context

# Ready-to-use system prompt with design rules + class registry
bricks agent context --format prompt

# Structured JSON for programmatic tool use
bricks agent context --format json

# Just one section
bricks agent context --section classes
bricks agent context --section tokens
bricks agent context --section templates
bricks agent context --section workflows

# Shorter output for small context windows
bricks agent context --compact

# Save to file
bricks agent context --format prompt -o system-prompt.md
```

The context output includes: site environment info, ACSS design tokens (spacing scale, typography scale, color variables, breakpoints), all global classes grouped by source and category, the local template catalog, and step-by-step workflow instructions.

### Health checks

```bash
bricks doctor <page-id>
```

Checks for orphaned elements, broken parent/child references, missing IDs, and unknown element types.

### Global classes

```bash
bricks classes list                    # All global classes
bricks classes list --source acss     # Just ACSS utilities
bricks classes list --source frames   # Just Frames components
bricks classes show <class-name>      # Full class definition
```

### Validation

```bash
bricks validate page.json             # Check structure before pushing
```

## For LLMs: how to use this tool

If you're an AI agent reading this, here's the exact workflow.

### The workflow

```
1. Discover    →  bricks agent context --format prompt
2. Generate    →  Write ACSS-compliant HTML
3. Convert     →  bricks convert html --stdin --push <page-id> --snapshot
4. Verify      →  bricks doctor <page-id>
```

### Step 1: get your design context

Run `bricks agent context --format prompt` to get a complete system prompt. It has every class on the site, the design token scale, and rules for writing compliant HTML. Load this into your context window before generating any HTML.

If your context window is small, use `--compact` or `--section classes` to get just what you need.

### Step 2: write ACSS-compliant HTML

Use the classes and tokens from the context. The rules:

- ACSS utility classes handle spacing, backgrounds, typography: `section--l`, `bg--primary-dark`, `text--primary`, `grid--auto-3`, `gap--m`
- Frames component classes give you pre-built patterns: `fr-hero`, `fr-lede`, `fr-accent-heading`, `btn--primary`, `btn--outline`
- CSS custom properties go in inline styles: `var(--space-m)`, `var(--h2)`, `var(--content-width)`, `var(--primary)`, `var(--white)`
- Nest properly: `<section>` as top-level, `<div>` for wrappers and grids, semantic elements for content
- Every ACSS class maps to a global class ID. The converter handles resolution automatically.

### Step 3: convert and push

```bash
# Pipe your HTML directly
echo '<section class="section--l">...</section>' | bricks convert html --stdin --push 1460 --snapshot

# Or save to file first
bricks convert html output.html --push 1460 --snapshot
```

The `--snapshot` flag creates a rollback point before pushing. Always use it.

### Step 4: verify

```bash
bricks doctor 1460
```

If the doctor finds issues, pull the page, fix the elements, and push again:

```bash
bricks site pull 1460 -o current.json
# Fix the JSON
bricks site push 1460 current.json
```

### Template-based workflow (no LLM needed)

For standard layouts, compose from templates without any AI:

```bash
bricks templates search "hero"
bricks compose hero-cali feature-havana pricing-alpha footer-amsterdam --push 1460
```

### Common patterns

```bash
# Full page from scratch via AI
bricks agent context --format prompt -o ctx.md
# Feed ctx.md to your LLM, get HTML back, then:
bricks convert html ai-output.html --push 1460 --snapshot

# Iterate on a section
bricks site pull 1460 -o current.json   # See what's there
bricks generate modify "make the hero headline bigger" --page 1460

# Safe experimentation
bricks site snapshot 1460 -l "before experiment"
bricks convert html experiment.html --push 1460
bricks doctor 1460                       # Check it
bricks site rollback 1460               # Undo if needed
```

## Architecture

```
agent-to-bricks/
├── plugin/agent-to-bricks/     WordPress plugin (PHP)
│   ├── agent-to-bricks.php     Plugin bootstrap
│   └── includes/
│       ├── class-rest-api.php          Route registration
│       ├── class-elements-api.php      GET/PUT/PATCH/DELETE elements
│       ├── class-classes-api.php       Global class CRUD
│       ├── class-snapshots-api.php     Snapshot/rollback
│       ├── class-site-api.php          Site info + frameworks
│       ├── class-templates-api.php     Server-side templates
│       ├── class-styles-api.php        Style profiles
│       ├── class-element-validator.php Element structure validation
│       ├── class-api-auth.php          API key auth
│       ├── class-settings.php          Admin settings page
│       └── class-llm-providers.php     LLM provider configs
│
├── cli/                        Go CLI
│   ├── main.go                 Entry point
│   ├── go.mod                  Dependencies
│   ├── cmd/                    Cobra commands
│   │   ├── root.go             Root command + config loading
│   │   ├── config.go           config init/set/list
│   │   ├── site.go             pull/push/patch/snapshot/rollback
│   │   ├── convert.go          HTML-to-Bricks converter command
│   │   ├── agent.go            LLM self-discovery context
│   │   ├── templates.go        Template list/show/import/learn/search/compose
│   │   ├── generate.go         AI generation (section/page/modify)
│   │   ├── doctor.go           Page health checks
│   │   ├── validate.go         JSON structure validation
│   │   ├── classes.go          Global class operations
│   │   ├── frameworks.go       Framework detection
│   │   ├── media.go            Media library operations
│   │   └── styles.go           Style profile management
│   │
│   └── internal/               Core libraries
│       ├── client/client.go    REST API client (all endpoints)
│       ├── config/config.go    YAML config management
│       ├── convert/
│       │   ├── html.go             HTML → Bricks element tree
│       │   ├── classregistry.go    ACSS/Frames class name → ID mapping
│       │   └── styles.go           Inline CSS → Bricks settings parser
│       ├── agent/context.go    LLM context builder (md/json/prompt)
│       ├── templates/
│       │   ├── catalog.go          Template catalog + Frames format loader
│       │   └── composer.go         Multi-template composition + class merge
│       ├── doctor/doctor.go    Element tree health checks
│       ├── validator/          JSON structure validation
│       ├── embeddings/search.go TF-IDF template search
│       ├── framework/registry.go CSS framework detection
│       ├── llm/                LLM client + prompt engineering
│       ├── styles/profile.go   Style profile management
│       ├── wizard/wizard.go    TUI setup wizard (Bubble Tea)
│       └── updater/            CLI self-update logic
│
├── Makefile                    build/test/install/deploy
├── docs/plans/                 Design docs and implementation plans
├── test-data/                  Template library (452 Frames templates)
└── scripts/                    Deployment scripts
```

## REST API reference

All endpoints require the `X-Agent-Bricks-Key` header with your API key.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent-bricks/v1/site/info` | GET | Bricks version, WP version, element types, breakpoints |
| `/agent-bricks/v1/site/frameworks` | GET | Detected CSS frameworks + ACSS tokens |
| `/agent-bricks/v1/classes` | GET | List all global classes (ACSS + Frames) |
| `/agent-bricks/v1/classes/<id>` | GET | Single class definition |
| `/agent-bricks/v1/pages/<id>/elements` | GET | Page elements + contentHash |
| `/agent-bricks/v1/pages/<id>/elements` | PUT | Full replace (requires `If-Match: <contentHash>`) |
| `/agent-bricks/v1/pages/<id>/elements` | PATCH | Patch specific elements |
| `/agent-bricks/v1/pages/<id>/elements` | POST | Append elements |
| `/agent-bricks/v1/pages/<id>/snapshots` | GET | List snapshots |
| `/agent-bricks/v1/pages/<id>/snapshots` | POST | Create snapshot |
| `/agent-bricks/v1/pages/<id>/rollback` | POST | Rollback to snapshot |

**Important:** PUT (full replace) requires an `If-Match` header containing the current `contentHash`. GET the elements first to obtain it. This prevents accidental overwrites.

## Bricks element format

A Bricks element looks like this:

```json
{
  "id": "abc123",
  "name": "section",
  "parent": 0,
  "children": ["def456", "ghi789"],
  "settings": {
    "_cssGlobalClasses": ["acss_import_section__l", "acss_import_bg__primary_dark"],
    "_cssClasses": ["my-custom-class"],
    "_typography": {
      "font-size": "var(--h2)",
      "color": "var(--white)"
    },
    "_padding": {
      "top": "var(--space-xl)",
      "bottom": "var(--space-xl)"
    },
    "_background": {
      "color": "var(--primary-dark)"
    },
    "tag": "section"
  }
}
```

Settings fields you'll use most:

- `_cssGlobalClasses` -- array of global class IDs (ACSS IDs start with `acss_import_`)
- `_cssClasses` -- custom CSS class names not in the global registry
- `_typography` -- font size, weight, color, line-height, letter-spacing
- `_padding` / `_margin` -- box model with top/right/bottom/left
- `_background` -- color, image, gradient, overlay
- `_attributes` -- custom data attributes
- `tag` -- HTML tag override (section, div, span, etc.)

## Development

### Prerequisites

- Go 1.21+
- WordPress with Bricks Builder 1.9+
- ACSS (Automatic.css) 3.x (optional but recommended)
- Frames (optional, for component templates)

### Build

```bash
make build          # Build CLI binary → bin/bricks
make test           # Run all tests
make test-verbose   # Run tests with verbose output
make lint           # Run go vet
make clean          # Remove bin/
```

### Run tests

```bash
cd cli && go test ./...                           # All tests
cd cli && go test -v ./internal/convert/...       # Just converter tests
cd cli && go test -v ./internal/templates/...     # Just template tests
cd cli && go test -v ./internal/agent/...         # Just agent context tests
```

### Deploy plugin to staging

```bash
make deploy-staging
```

## Configuration reference

Config file: `~/.agent-to-bricks/config.yaml`

```yaml
site:
  url: https://your-site.com
  api_key: your-api-key-here

llm:
  provider: openai          # openai, anthropic, or any OpenAI-compatible
  api_key: sk-...
  model: gpt-4o
  base_url: ""              # Custom endpoint for local models
  temperature: 0.3

```

Available config keys for `bricks config set`:

| Key | Description |
|-----|-------------|
| `site.url` | WordPress site URL |
| `site.api_key` | Plugin API key |
| `llm.provider` | LLM provider name |
| `llm.api_key` | LLM API key |
| `llm.model` | Model name |
| `llm.base_url` | Custom API endpoint |

## License

MIT
