# Agent to Bricks

Build Bricks Builder pages from the command line. Write HTML, convert it to Bricks elements, and push it to any page — no visual editor needed. Works for humans typing commands and for AI agents generating pages programmatically.

## What this is

Bricks Builder stores page content as a JSON tree of elements. Each element has a type (section, heading, image, etc.), settings that control its appearance, and parent/child relationships that define the layout.

This project has two parts:

1. **A WordPress plugin** that adds a REST API to your site for reading, writing, and managing Bricks content
2. **A CLI tool** (written in Go) that talks to that API and adds HTML conversion, AI generation, template composition, cross-site search, and more

The basic workflow: you (or an AI) write HTML using your site's CSS classes. The CLI converts that HTML into Bricks elements and pushes them to a page. Everything happens through the command line.

## Requirements

- WordPress 6.0+
- PHP 8.0+
- Bricks Builder 1.9+
- Go 1.22+ (to build the CLI from source)
- Automatic.css (ACSS) 3.x recommended for design token support
- Frames optional, for component templates

## Quick start

### 1. Install the plugin

Copy the plugin folder to your WordPress site:

```bash
cp -r plugin/agent-to-bricks/ /path/to/wp-content/plugins/
```

Activate it in WP Admin. Go to **Settings > Agent to Bricks** and generate an API key. You'll need this key for the CLI.

### 2. Build the CLI

```bash
make build        # outputs bin/bricks
make install      # copies to /usr/local/bin/bricks
```

Or build directly:

```bash
cd cli && go build -o bricks .
```

### 3. Connect to your site

```bash
bricks config init     # interactive setup wizard
```

Or set values manually:

```bash
bricks config set site.url https://your-site.com
bricks config set site.api_key YOUR_API_KEY
```

Config is stored at `~/.agent-to-bricks/config.yaml`.

### 4. Verify the connection

```bash
bricks site info       # shows Bricks version, PHP, WP info
bricks doctor 1234     # health check any page by its ID
```

---

## CLI commands

### Working with pages

Pull, push, and patch page content. Every page's elements can be downloaded as JSON, edited, and uploaded back.

```bash
bricks site pull <page-id>                # download elements as JSON
bricks site pull <page-id> -o page.json   # save to a file
bricks site push <page-id> page.json      # full replace (needs contentHash)
bricks site patch <page-id> -f patch.json # update specific elements only
```

**Snapshots** let you save a page's state before making changes, so you can roll back if something goes wrong:

```bash
bricks site snapshot <page-id>                  # save current state
bricks site snapshot <page-id> -l "before hero"  # save with a label
bricks site snapshots <page-id>                  # list all snapshots
bricks site rollback <page-id>                   # undo to latest snapshot
bricks site rollback <page-id> <snapshot-id>     # undo to a specific snapshot
```

### Converting HTML to Bricks

The converter turns HTML into Bricks element JSON. If your site uses ACSS or Frames, CSS class names are automatically resolved to their global class IDs.

```bash
# Convert a file
bricks convert html page.html

# Pipe from stdin (useful for AI output)
echo '<section class="section--l bg--primary-dark">...</section>' | bricks convert html --stdin

# Convert and push to a page in one step
bricks convert html page.html --push 1460

# Create a safety snapshot before pushing
bricks convert html page.html --push 1460 --snapshot

# Preview what would happen without actually pushing
bricks convert html page.html --push 1460 --dry-run

# Save converted JSON to a file
bricks convert html page.html -o elements.json

# Use cached class registry (faster, skips an API call)
bricks convert html page.html --class-cache
```

How class resolution works:
1. The CLI fetches all global classes from your site (ACSS utilities + Frames components)
2. Class names like `section--l` and `bg--primary-dark` are matched against the registry
3. Matched classes become `_cssGlobalClasses` entries (Bricks global class IDs)
4. Unmatched classes go to `_cssClasses` (regular CSS classes)
5. Inline styles are parsed into native Bricks settings (typography, padding, background, etc.)

### AI generation

Generate Bricks elements by describing what you want in plain English. Works with any OpenAI-compatible LLM provider.

```bash
# Set up your LLM
bricks config set llm.provider openai
bricks config set llm.api_key sk-...
bricks config set llm.model gpt-4o

# Generate a section
bricks generate section "dark hero with CTA buttons" --page 1460

# Generate a full page
bricks generate page "SaaS landing page with pricing table" --page 1460

# Modify existing content on a page
bricks generate modify "change the hero headline to Welcome" --page 1460

# Preview without pushing
bricks generate section "testimonial grid" --dry-run
bricks generate section "testimonial grid" -o section.json
```

### Searching across your site

Find elements across every page, template, and component on your site. Useful for auditing content, finding where a class is used, or locating specific elements.

```bash
# Find all headings
bricks search elements --type heading

# Find elements using a specific global class
bricks search elements --class fr-hero

# Find elements with a specific setting value
bricks search elements --setting tag=h1

# Filter by post type
bricks search elements --type button --post-type page

# Limit results
bricks search elements --type heading --limit 10

# Get raw JSON output
bricks search elements --type heading --json
```

### Components

Components are reusable section templates in Bricks. These commands let you browse and inspect them.

```bash
# List all components
bricks components list

# Get JSON output
bricks components list --json

# View a specific component with its full element tree
bricks components show <id>
bricks components show <id> --json
```

### Element types

See what element types are available in your Bricks installation, and inspect their controls (the settings each element type supports).

```bash
# List all available element types
bricks elements types

# Filter by category
bricks elements types --category media

# Show a specific element type with its full controls schema
bricks elements types heading

# Get JSON output
bricks elements types --json

# Include controls for all types
bricks elements types --controls --json
```

### Templates

A local template library with import, search, and composition. Templates are stored on your machine and can be combined to build full pages.

```bash
# List all local templates
bricks templates list

# Show template details
bricks templates show hero-cali

# Import from a file or directory
bricks templates import ./my-templates/
bricks templates import hero-section.json

# Learn templates from an existing page (splits it into sections)
bricks templates learn <page-id>

# Search templates by description
bricks templates search "dark hero with gradient"

# Compose multiple templates into a single page
bricks compose hero-cali feature-havana footer-amsterdam -o page.json

# Compose and push directly
bricks compose hero-cali pricing-alpha --push 1460
```

### Global classes

Manage Bricks global CSS classes — list, create, find, and delete.

```bash
bricks classes list                       # all global classes
bricks classes list --framework acss      # just ACSS utilities
bricks classes list --json                # raw JSON output
bricks classes create my-class            # create a new class
bricks classes create my-class --settings '{"color":"red"}'
bricks classes find "hero"                # find classes by name pattern
bricks classes delete <class-id>          # delete a class
```

### Styles and design tokens

Analyze your site's design system — colors, CSS variables, theme styles.

```bash
bricks styles learn <page-id>            # build a style profile from a page
bricks styles show                       # display the current style profile
bricks styles reset                      # clear the style profile
bricks styles colors                     # show color palette from your site
bricks styles colors --json
bricks styles variables                  # show CSS custom properties
bricks styles variables --json
bricks styles theme                      # show theme styles
bricks styles theme --json
```

### Frameworks

Detect and inspect CSS frameworks installed on your site (like ACSS).

```bash
bricks frameworks list                    # list detected frameworks
bricks frameworks show acss              # show detailed framework config
```

### Media library

Upload files and browse the WordPress media library.

```bash
bricks media upload photo.jpg             # upload a file
bricks media list                         # list media items
bricks media list --search "logo"         # search media by name
```

### Site info

```bash
bricks site info                          # Bricks version, PHP, WP, element types
bricks site frameworks                    # detected CSS frameworks + design tokens
```

### Agent context (for AI workflows)

This is the command an AI agent should run first. It dumps your site's full design context — classes, tokens, templates, workflows — in a format LLMs can read.

```bash
bricks agent context                             # full markdown context
bricks agent context --format prompt             # ready-to-use system prompt
bricks agent context --format json               # structured JSON
bricks agent context --section classes           # just one section
bricks agent context --compact                   # shorter output
bricks agent context --format prompt -o ctx.md   # save to file
```

### Health checks and validation

```bash
bricks doctor <page-id>                   # check for broken elements, orphans, etc.
bricks validate page.json                 # validate element JSON structure
```

### Version and updates

```bash
bricks version                            # show CLI and plugin versions
bricks version --changelog                # show what changed
bricks update                             # update CLI and plugin
bricks update --check                     # check for updates without installing
bricks update --cli-only                  # only update the CLI
```

### Configuration

```bash
bricks config init                        # interactive setup wizard
bricks config set <key> <value>           # set a config value
bricks config list                        # show current config
```

---

## For AI agents

If you're an LLM reading this, here's how to use this tool.

### The workflow

```
1. Discover    →  bricks agent context --format prompt
2. Generate    →  Write HTML using your site's CSS classes
3. Convert     →  bricks convert html --stdin --push <page-id> --snapshot
4. Verify      →  bricks doctor <page-id>
```

### Step 1: get your design context

Run `bricks agent context --format prompt`. This gives you a complete system prompt with every CSS class on the site, the design token scale, and rules for writing valid HTML. Load this into your context before generating anything.

For smaller context windows, use `--compact` or `--section classes`.

### Step 2: write HTML

Use the classes and tokens from the context output:

- ACSS utility classes for spacing, backgrounds, typography: `section--l`, `bg--primary-dark`, `text--primary`, `grid--auto-3`
- Frames component classes for pre-built patterns: `fr-hero`, `fr-lede`, `btn--primary`
- CSS custom properties in inline styles: `var(--space-m)`, `var(--h2)`, `var(--primary)`
- Nest properly: `<section>` as top-level, `<div>` for wrappers, semantic elements for content

### Step 3: convert and push

```bash
echo '<section class="section--l">...</section>' | bricks convert html --stdin --push 1460 --snapshot
```

Always use `--snapshot` so you can roll back.

### Step 4: verify

```bash
bricks doctor 1460
```

### Useful commands for agents

```bash
# Search for elements across the site
bricks search elements --type heading --json

# Inspect what element types are available and what settings they take
bricks elements types heading

# Browse reusable components
bricks components list --json

# Compose from templates (no AI needed)
bricks compose hero-cali feature-havana --push 1460
```

---

## REST API reference

All endpoints are at `/wp-json/agent-bricks/v1/`. Authentication is via the `X-ATB-Key` header with your API key.

### Site

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/site/info` | GET | Bricks version, WP version, PHP, element types, breakpoints |
| `/site/frameworks` | GET | Detected CSS frameworks and design tokens |
| `/site/element-types` | GET | Element type metadata (params: `include_controls`, `category`) |
| `/site/update` | POST | Trigger plugin self-update |

### Pages and elements

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pages/{id}/elements` | GET | Get all elements for a page (includes `contentHash`) |
| `/pages/{id}/elements` | POST | Append elements to a page |
| `/pages/{id}/elements` | PUT | Full replace (requires `If-Match: <contentHash>` header) |
| `/pages/{id}/elements` | PATCH | Patch specific elements (requires `If-Match`) |
| `/pages/{id}/elements` | DELETE | Remove elements by ID (requires `If-Match`) |
| `/pages/{id}/elements/batch` | POST | Multiple operations atomically (requires `If-Match`) |

### Snapshots

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pages/{id}/snapshots` | GET | List snapshots for a page |
| `/pages/{id}/snapshots` | POST | Create a snapshot |
| `/pages/{id}/snapshots/{sid}/rollback` | POST | Rollback to a snapshot |

### Global classes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/classes` | GET | List all global classes (param: `framework`) |
| `/classes/{id}` | GET | Get single class |
| `/classes` | POST | Create a new class |
| `/classes/{id}` | PATCH | Update a class |
| `/classes/{id}` | DELETE | Delete a class |

### Templates

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/templates` | GET | List all Bricks templates (param: `type`) |
| `/templates/{id}` | GET | Get template with elements |
| `/templates` | POST | Create a template |
| `/templates/{id}` | PATCH | Update a template |
| `/templates/{id}` | DELETE | Delete a template |

### Components

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/components` | GET | List reusable components (section-type templates) |
| `/components/{id}` | GET | Get component with full element tree |

### Search

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search/elements` | GET | Search elements across all content (params: `element_type`, `setting_key`, `setting_value`, `global_class`, `post_type`, `per_page`, `page`) |

### Media

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/media` | GET | List media items (param: `search`) |
| `/media/upload` | POST | Upload a file (multipart form-data) |

### Styles

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/styles` | GET | Theme styles and color palette |
| `/variables` | GET | CSS custom properties |

### AI generation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generate` | POST | Generate elements via LLM |
| `/modify` | POST | Modify existing elements via LLM |
| `/providers` | GET | List available LLM providers |

**Concurrency control:** All write operations on elements (PUT, PATCH, DELETE, batch) require an `If-Match` header with the current `contentHash`. Get the elements first to obtain it. This prevents two people (or agents) from accidentally overwriting each other's changes.

---

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

Key settings fields:

- `_cssGlobalClasses` — array of global class IDs (ACSS IDs start with `acss_import_`)
- `_cssClasses` — custom CSS class names not in the global registry
- `_typography` — font size, weight, color, line-height, letter-spacing
- `_padding` / `_margin` — box model (top, right, bottom, left)
- `_background` — color, image, gradient, overlay
- `_attributes` — custom data attributes
- `tag` — HTML tag override (section, div, span, etc.)

---

## Project structure

```
agent-to-bricks/
├── plugin/agent-to-bricks/        WordPress plugin (PHP 8.0+)
│   ├── agent-to-bricks.php        Plugin bootstrap
│   └── includes/
│       ├── class-api-auth.php          API key authentication
│       ├── class-bricks-lifecycle.php  Bricks content meta helpers
│       ├── class-classes-api.php       Global class CRUD
│       ├── class-components-api.php    Reusable components (section templates)
│       ├── class-element-validator.php Element structure validation
│       ├── class-elements-api.php      Page element CRUD + batch ops
│       ├── class-llm-client.php        LLM HTTP client
│       ├── class-llm-providers.php     LLM provider configs
│       ├── class-media-api.php         Media library upload + list
│       ├── class-rest-api.php          Route registration
│       ├── class-search-api.php        Cross-site element search
│       ├── class-settings.php          Admin settings page
│       ├── class-site-api.php          Site info, frameworks, element types
│       ├── class-snapshots-api.php     Snapshot + rollback
│       ├── class-styles-api.php        Theme styles + CSS variables
│       ├── class-templates-api.php     Template CRUD
│       ├── class-update-api.php        Plugin self-update endpoint
│       └── class-update-checker.php    Background update checks
│
├── cli/                               Go CLI
│   ├── main.go
│   ├── cmd/                           Commands
│   │   ├── root.go                    Root command + config loading
│   │   ├── config.go                  config init/set/list
│   │   ├── site.go                    pull/push/patch/snapshot/rollback
│   │   ├── convert.go                 HTML-to-Bricks converter
│   │   ├── agent.go                   LLM context builder
│   │   ├── generate.go                AI generation (section/page/modify)
│   │   ├── templates.go               Template list/show/import/learn/search
│   │   ├── search.go                  Cross-site element search
│   │   ├── components.go              Reusable components list/show
│   │   ├── elements.go                Element type metadata
│   │   ├── classes.go                 Global class operations
│   │   ├── styles.go                  Style profile + design tokens
│   │   ├── frameworks.go              CSS framework detection
│   │   ├── media.go                   Media library operations
│   │   ├── doctor.go                  Page health checks
│   │   ├── validate.go                JSON structure validation
│   │   ├── version.go                 Version info
│   │   └── update.go                  CLI + plugin updates
│   │
│   └── internal/                      Core libraries
│       ├── client/       REST API client
│       ├── config/       YAML config management
│       ├── convert/      HTML-to-Bricks converter + class registry
│       ├── agent/        LLM context builder
│       ├── templates/    Template catalog + multi-template composer
│       ├── doctor/       Element tree health checks
│       ├── validator/    JSON structure validation
│       ├── embeddings/   TF-IDF template search
│       ├── framework/    CSS framework detection
│       ├── llm/          LLM client + prompt engineering
│       ├── styles/       Style profile management
│       ├── wizard/       TUI setup wizard (Bubble Tea)
│       └── updater/      CLI self-update
│
├── tests/
│   ├── plugin/            PHP test runners (wp eval-file)
│   └── e2e/               End-to-end shell tests
│
├── Makefile
└── docs/plans/            Design docs and implementation plans
```

## Configuration reference

Config file: `~/.agent-to-bricks/config.yaml`

```yaml
site:
  url: https://your-site.com
  api_key: your-api-key-here

llm:
  provider: openai          # openai, anthropic, cerebras, or any OpenAI-compatible
  api_key: sk-...
  model: gpt-4o
  base_url: ""              # custom endpoint for local/self-hosted models
  temperature: 0.3
```

Available keys for `bricks config set`:

| Key | Description |
|-----|-------------|
| `site.url` | Your WordPress site URL |
| `site.api_key` | API key from the plugin settings page |
| `llm.provider` | LLM provider (openai, anthropic, cerebras, etc.) |
| `llm.api_key` | Your LLM API key |
| `llm.model` | Model name (gpt-4o, claude-sonnet-4-20250514, etc.) |
| `llm.base_url` | Custom API endpoint for local models |

## Development

### Build and test

```bash
make build          # build CLI → bin/bricks
make test           # run all Go tests
make test-verbose   # verbose test output
make lint           # go vet
make clean          # remove bin/
```

### Run tests

```bash
cd cli && go test ./...                      # all tests
cd cli && go test ./internal/client/...      # API client tests
cd cli && go test ./internal/convert/...     # converter tests
cd cli && go test ./cmd/...                  # command tests
```

## License

GPL-2.0-or-later
