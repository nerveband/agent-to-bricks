# Agent to Bricks

Build and manage [Bricks Builder](https://bricksbuilder.io/) pages from the command line. Write HTML, convert it to Bricks elements, and push it to any page — no visual editor needed.

Designed for both humans and AI agents. Give an LLM the `bricks` CLI and it can read your site's design system, generate pages, search across all your content, and push changes — all through simple shell commands.

## How it works

Bricks Builder stores page content as a JSON tree of elements. Each element has a type (section, heading, image, etc.), settings that control its appearance, and parent/child relationships that define the layout.

This project has two parts:

1. **A WordPress plugin** that adds a REST API to your site for reading, writing, and managing Bricks content
2. **A CLI tool** called `bricks` that talks to that API — it handles HTML conversion, AI generation, template composition, cross-site search, and more

You write HTML using your site's CSS classes. The CLI converts that HTML into Bricks elements and pushes them to a page. Everything happens through the command line.

## Requirements

- WordPress 6.0+
- PHP 8.0+
- Bricks Builder 1.9+
- Automatic.css (ACSS) 3.x recommended for design token support
- Frames optional, for component templates

---

## Install

### 1. Install the plugin

Download `agent-to-bricks-plugin-X.X.X.zip` from the [latest release](https://github.com/nerveband/agent-to-bricks/releases/latest).

In your WordPress admin, go to **Plugins > Add New > Upload Plugin**, upload the zip, and activate.

Then go to **Settings > Agent to Bricks** and click **Generate API Key**. Copy the key — you'll need it for the CLI.

### 2. Install the CLI

Download the right binary for your system from the [latest release](https://github.com/nerveband/agent-to-bricks/releases/latest):

| Platform | File |
|----------|------|
| Mac (Apple Silicon) | `agent-to-bricks_X.X.X_darwin_arm64.tar.gz` |
| Mac (Intel) | `agent-to-bricks_X.X.X_darwin_amd64.tar.gz` |
| Linux | `agent-to-bricks_X.X.X_linux_amd64.tar.gz` |
| Windows | `agent-to-bricks_X.X.X_windows_amd64.zip` |

**Mac / Linux:** extract and move it somewhere in your PATH:

```bash
tar xzf agent-to-bricks_*.tar.gz
sudo mv bricks /usr/local/bin/
```

**Windows:** unzip, then move `bricks.exe` to a directory in your PATH (e.g., `C:\Users\<you>\bin\`), or add the extracted folder to your PATH environment variable.

### 3. Connect to your site

```bash
bricks config init     # interactive setup wizard
```

It will ask for your site URL and API key. Or set them manually:

```bash
bricks config set site.url https://your-site.com
bricks config set site.api_key YOUR_API_KEY
```

### 4. Verify the connection

```bash
bricks site info
```

You should see your Bricks version, WordPress version, and PHP version.

### Updating

The CLI can update itself and the plugin in one command:

```bash
bricks update              # update both CLI and plugin
bricks update --check      # just check, don't install
bricks update --cli-only   # only update the CLI
```

---

## What you can do

### Read and write pages

Pull a page's elements as JSON, edit them, push them back.

```bash
bricks site pull <page-id>                # download elements as JSON
bricks site pull <page-id> -o page.json   # save to a file
bricks site push <page-id> page.json      # full replace (needs contentHash)
bricks site patch <page-id> -f patch.json # update specific elements only
```

### Snapshots and rollback

Save a page's state before making changes. If something goes wrong, roll back.

```bash
bricks site snapshot <page-id>                   # save current state
bricks site snapshot <page-id> -l "before hero"  # save with a label
bricks site snapshots <page-id>                  # list all snapshots
bricks site rollback <page-id>                   # undo to latest snapshot
bricks site rollback <page-id> <snapshot-id>     # undo to a specific one
```

### Convert HTML to Bricks

Turn HTML into Bricks element JSON. If your site uses ACSS or Frames, class names are automatically resolved to global class IDs.

```bash
bricks convert html page.html                        # convert a file
bricks convert html page.html --push 1460             # convert and push to page
bricks convert html page.html --push 1460 --snapshot  # snapshot first, then push
bricks convert html page.html --push 1460 --dry-run   # preview without pushing
bricks convert html page.html -o elements.json        # save to file
echo '<section class="section--l">...</section>' | bricks convert html --stdin  # pipe from stdin
```

### Generate with AI

Describe what you want in plain English. Works with OpenAI, Anthropic, Cerebras, or any OpenAI-compatible provider.

```bash
# Set up your LLM first
bricks config set llm.provider openai
bricks config set llm.api_key sk-...
bricks config set llm.model gpt-4o

# Generate
bricks generate section "dark hero with CTA buttons" --page 1460
bricks generate page "SaaS landing page with pricing table" --page 1460
bricks generate modify "change the hero headline to Welcome" --page 1460

# Preview without pushing
bricks generate section "testimonial grid" --dry-run
```

### Search across your site

Find elements across every page, template, and component on your site.

```bash
bricks search elements --type heading                     # find all headings
bricks search elements --class fr-hero                    # find by global class
bricks search elements --setting tag=h1                   # find by setting value
bricks search elements --type button --post-type page     # filter by post type
bricks search elements --type heading --limit 10 --json   # limit + JSON output
```

### Browse components

Components are reusable section templates in Bricks.

```bash
bricks components list                # list all components
bricks components list --json         # JSON output
bricks components show <id>           # view with full element tree
bricks components show <id> --json    # JSON output
```

### Inspect element types

See what element types are available and what settings they support.

```bash
bricks elements types                        # list all types
bricks elements types --category media       # filter by category
bricks elements types heading                # show one type with full controls
bricks elements types --controls --json      # all types with controls as JSON
```

### Work with templates

A local template library. Import templates, search by description, compose multiple into a page. See the [Templates guide](docs/templates.md) for the full reference on template formats, CSS class naming, and composition.

```bash
bricks templates list                                              # list templates
bricks templates show hero-cali                                    # show details
bricks templates import ./my-templates/                            # import from directory
bricks templates learn <page-id>                                   # learn from existing page
bricks templates search "dark hero with gradient"                  # search by description
bricks compose hero-cali feature-havana footer-amsterdam -o page.json  # compose
bricks compose hero-cali pricing-alpha --push 1460                 # compose and push
```

### Manage global classes

```bash
bricks classes list                       # all global classes
bricks classes list --framework acss      # just ACSS utilities
bricks classes list --json                # JSON output
bricks classes create my-class            # create new
bricks classes find "hero"                # find by name
bricks classes delete <class-id>          # delete
```

### Design tokens and styles

```bash
bricks styles colors                      # color palette from your site
bricks styles variables                   # CSS custom properties
bricks styles theme                       # theme styles
bricks styles learn <page-id>            # build a style profile from a page
bricks styles show                       # display current style profile
```

### Media library

```bash
bricks media upload photo.jpg             # upload a file
bricks media list                         # list media items
bricks media list --search "logo"         # search by name
```

### Site info and frameworks

```bash
bricks site info                          # Bricks version, PHP, WP, etc.
bricks site frameworks                    # detected CSS frameworks + design tokens
bricks frameworks list                    # list framework configs
bricks frameworks show acss              # show detailed ACSS config
```

### Health checks

```bash
bricks doctor <page-id>                   # check for broken elements, orphans
bricks validate page.json                 # validate element JSON structure
```

### Version info

```bash
bricks version                            # CLI + plugin versions, sync status
bricks version --changelog                # show release notes
```

---

## For AI agents

> If you are an LLM or AI agent, this section is for you. It tells you everything you need to use this tool effectively.

### Quick reference: the workflow

```
1. Discover    bricks agent context --format prompt
2. Search      bricks search elements --type heading --json
3. Inspect     bricks elements types heading
4. Generate    Write HTML using the site's CSS classes
5. Push        bricks convert html --stdin --push <page-id> --snapshot
6. Verify      bricks doctor <page-id>
```

### Step 1: understand the site

Run this first. It gives you the site's full design context — every CSS class, design token, template, and the rules for writing valid HTML.

```bash
bricks agent context --format prompt           # full system prompt (recommended)
bricks agent context --format json             # structured JSON
bricks agent context --compact                 # shorter version
bricks agent context --section classes         # just CSS classes
bricks agent context --section tokens          # just design tokens
bricks agent context --format prompt -o ctx.md # save to file
```

### Step 2: explore what exists

Before building anything, understand what's already on the site.

```bash
# What pages have Bricks content?
bricks search elements --json | head

# What element types are available? What settings do they take?
bricks elements types --json
bricks elements types heading    # shows all controls for heading elements

# What reusable components exist?
bricks components list --json

# What's on a specific page?
bricks site pull <page-id> -o page.json

# What global classes are available?
bricks classes list --json

# What CSS variables and design tokens exist?
bricks styles variables --json
bricks styles colors --json
```

### Step 3: write HTML

Use the classes and tokens from the context output.

**CSS classes map to Bricks global class IDs automatically:**
- ACSS utilities: `section--l`, `bg--primary-dark`, `text--primary`, `grid--auto-3`, `gap--m`
- Frames components: `fr-hero`, `fr-lede`, `fr-accent-heading`, `btn--primary`, `btn--outline`

**CSS custom properties go in inline styles:**
- Spacing: `var(--space-s)`, `var(--space-m)`, `var(--space-l)`, `var(--space-xl)`
- Typography: `var(--h1)`, `var(--h2)`, `var(--body)`
- Colors: `var(--primary)`, `var(--white)`, `var(--shade-dark)`
- Layout: `var(--content-width)`, `var(--narrow-width)`

**Nesting rules:**
- `<section>` as top-level containers
- `<div>` for wrappers, grids, and layout groups
- Semantic elements for content (`<h1>`-`<h6>`, `<p>`, `<a>`, `<img>`, etc.)

### Step 4: convert and push

```bash
# Pipe HTML directly
echo '<section class="section--l bg--primary-dark">
  <div class="container" style="max-width: var(--content-width)">
    <h1 class="text--white">Welcome</h1>
  </div>
</section>' | bricks convert html --stdin --push <page-id> --snapshot

# Or from a file
bricks convert html output.html --push <page-id> --snapshot
```

**Always use `--snapshot`** so you can roll back if something goes wrong.

**Use `--dry-run`** to preview what would be pushed without actually changing anything.

### Step 5: verify and iterate

```bash
# Check for structural issues
bricks doctor <page-id>

# Pull what's there now
bricks site pull <page-id> -o current.json

# Roll back if needed
bricks site rollback <page-id>
```

### Template-based workflow (no AI generation needed)

For standard layouts, compose from existing templates (see [Templates guide](docs/templates.md) for details):

```bash
bricks templates search "hero"
bricks compose hero-cali feature-havana pricing-alpha footer-amsterdam --push <page-id>
```

### How Bricks elements work

Each element is a JSON object with these fields:

```json
{
  "id": "abc123",
  "name": "heading",
  "parent": "def456",
  "children": [],
  "settings": {
    "text": "Welcome to our site",
    "tag": "h1",
    "_cssGlobalClasses": ["acss_import_text__white", "acss_import_fw__700"],
    "_cssClasses": ["my-custom-class"],
    "_typography": {
      "font-size": "var(--h1)",
      "color": "var(--white)"
    },
    "_padding": {
      "top": "var(--space-m)",
      "bottom": "var(--space-m)"
    }
  }
}
```

**Key settings:**
- `_cssGlobalClasses` — array of global class IDs (the converter resolves class names to these)
- `_cssClasses` — plain CSS class names not in the global registry
- `_typography` — font-size, font-weight, color, line-height, letter-spacing
- `_padding` / `_margin` — top, right, bottom, left
- `_background` — color, image, gradient, overlay
- `tag` — the HTML tag (section, div, h1, p, a, img, etc.)
- `text` — text content for heading, text, and button elements
- `link` — URL for links and buttons
- `image` — image source for image elements

### Concurrency safety

All write operations (push, patch, delete) use optimistic locking via `contentHash`. The CLI handles this automatically — it pulls the current hash before pushing. If someone else changed the page between your pull and push, it will fail safely rather than overwrite their work.

### Available element types

Run `bricks elements types --json` to get the full list. Common ones:

| Type | What it is |
|------|-----------|
| `section` | Top-level page section |
| `container` | Flex/grid container |
| `div` | Generic wrapper |
| `heading` | h1-h6 heading |
| `text` | Rich text block |
| `text-basic` | Plain text (no editor) |
| `image` | Image |
| `button` | Button/link |
| `icon` | Icon element |
| `video` | Video embed |
| `list` | Ordered/unordered list |
| `accordion` | Collapsible sections |
| `tabs` | Tabbed content |
| `slider` | Image/content slider |

Run `bricks elements types <name>` to see the full controls schema for any element type.

---

## REST API reference

All endpoints live at `/wp-json/agent-bricks/v1/`. Authenticate with the `X-ATB-Key` header.

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
| `/pages/{id}/elements` | POST | Append elements |
| `/pages/{id}/elements` | PUT | Full replace (requires `If-Match: <contentHash>`) |
| `/pages/{id}/elements` | PATCH | Patch specific elements (requires `If-Match`) |
| `/pages/{id}/elements` | DELETE | Remove elements by ID (requires `If-Match`) |
| `/pages/{id}/elements/batch` | POST | Multiple operations atomically (requires `If-Match`) |

### Snapshots

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pages/{id}/snapshots` | GET | List snapshots |
| `/pages/{id}/snapshots` | POST | Create snapshot |
| `/pages/{id}/snapshots/{sid}/rollback` | POST | Rollback to snapshot |

### Global classes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/classes` | GET | List all global classes (param: `framework`) |
| `/classes/{id}` | GET | Get single class |
| `/classes` | POST | Create new class |
| `/classes/{id}` | PATCH | Update class |
| `/classes/{id}` | DELETE | Delete class |

### Templates

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/templates` | GET | List Bricks templates (param: `type`) |
| `/templates/{id}` | GET | Get template with elements |
| `/templates` | POST | Create template |
| `/templates/{id}` | PATCH | Update template |
| `/templates/{id}` | DELETE | Delete template |

### Components

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/components` | GET | List reusable components (section-type templates) |
| `/components/{id}` | GET | Get component with full element tree |

### Search

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search/elements` | GET | Search all content (params: `element_type`, `setting_key`, `setting_value`, `global_class`, `post_type`, `per_page`, `page`) |

### Media

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/media` | GET | List media items (param: `search`) |
| `/media/upload` | POST | Upload file (multipart form-data) |

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

---

## Configuration

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

| Key | What it does |
|-----|-------------|
| `site.url` | Your WordPress site URL |
| `site.api_key` | API key from plugin settings |
| `llm.provider` | LLM provider (openai, anthropic, cerebras, etc.) |
| `llm.api_key` | Your LLM API key |
| `llm.model` | Model name (gpt-4o, claude-sonnet-4-20250514, etc.) |
| `llm.base_url` | Custom API endpoint for local models |

---

## For contributors

If you want to build from source or run the test suite:

```bash
# Build from source (requires Go 1.22+)
cd cli && go build -o bricks .

# Or use the Makefile
make build          # build CLI → bin/bricks
make test           # run all tests (97 tests across 14 packages)
make install        # copy to /usr/local/bin

# Run specific test suites
cd cli && go test ./internal/client/...      # API client tests
cd cli && go test ./internal/convert/...     # converter tests
cd cli && go test ./cmd/...                  # command tests
```

## License

GPL-3.0
