# Agent to Bricks v2 — Design Document

**Date:** 2026-02-21
**Status:** Approved
**Counselor Review:** Codex 5.3 XHigh + Gemini 3 Pro (see `agents/counselors/1771636604-agent-to-bricks-design/`)

---

## 1. Vision

An open-source system for programmatically building Bricks Builder pages via AI agents. Two components:

1. **WordPress Plugin** — Lifecycle-aware REST API gateway to Bricks Builder internals
2. **Go CLI (`bricks`)** — Single-binary brain handling LLM orchestration, template management, CSS framework awareness, and learning

The CLI drives everything. The plugin is just a connector that respects Bricks' application lifecycle.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Go CLI ("bricks")                         │
│  Single binary, zero runtime dependencies, cross-platform        │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Template  │ │ Style    │ │ CSS Fwk  │ │ LLM Orchestrator  │  │
│  │ Engine    │ │ Profiles │ │ Registry │ │ (generate/modify)  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Composer  │ │ Validator│ │ Converter│ │ WP-CLI Orchestr.  │  │
│  │ (merge)   │ │ (schema) │ │ HTML→BRX │ │ (media/cache)     │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Embedded Vector DB (SQLite-backed)           │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────────┘
                           │ REST API (Application Password auth)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│         WordPress Plugin ("Agent to Bricks Bridge")              │
│  Lifecycle-aware Bricks CRUD gateway, ~15 REST endpoints         │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Elements  │ │ Classes  │ │ Styles   │ │ Templates         │  │
│  │ CRUD+Δ    │ │ CRUD     │ │ R/W      │ │ CRUD              │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Snapshot  │ │ CSS Vars │ │ Lifecycle│ │ Site Introspect   │  │
│  │ /Rollback │ │ R/W      │ │ (regen)  │ │ (framework detect)│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Key principle:** Plugin exposes Bricks primitives as REST + handles Bricks lifecycle (CSS regen, cache, state sync). CLI composes primitives into intelligent workflows.

---

## 3. WordPress Plugin — "The Connector"

### 3.1 REST Endpoints

**Base:** `/wp-json/agent-bricks/v1/`
**Auth:** WordPress Application Passwords (REST) + nonce (browser panel)
**Capability:** `edit_posts` for read, `edit_post` (specific) for write

#### Elements

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/pages/{id}/elements` | Full element tree. Returns `{ elements, contentHash }` |
| `PATCH` | `/pages/{id}/elements` | Delta patch specific elements by ID. Requires `If-Match: {contentHash}` |
| `POST` | `/pages/{id}/elements` | Append elements (with `parentId`, `insertAfter` targeting) |
| `DELETE` | `/pages/{id}/elements` | Delete elements by ID array |
| `POST` | `/pages/{id}/elements/batch` | Multiple ops in one request |
| `PUT` | `/pages/{id}/elements` | Full content replace |

#### Global Classes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/classes` | All global classes (with `framework` flag: acss/custom/locked) |
| `POST` | `/classes` | Create global class(es) |
| `PATCH` | `/classes/{id}` | Update class settings |
| `DELETE` | `/classes/{id}` | Delete class |

#### Theme & Styles

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/styles` | Theme styles + color palette |
| `PUT` | `/styles` | Update theme styles |
| `GET` | `/variables` | CSS custom properties |
| `PUT` | `/variables` | Update CSS custom properties |

#### Site Introspection

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/site/info` | Bricks version, meta key suffix, element types, breakpoints |
| `GET` | `/site/frameworks` | Detect ACSS + other CSS frameworks, return class inventories + variable values |

#### Snapshots

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/pages/{id}/snapshot` | Save current state (stored in `_agent_bricks_snapshots` post meta) |
| `POST` | `/pages/{id}/rollback` | Revert to last snapshot |
| `GET` | `/pages/{id}/snapshots` | List available snapshots |

#### Templates

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/templates` | List `bricks_template` posts |
| `POST` | `/templates` | Create template from element JSON |
| `GET` | `/templates/{id}` | Get template content |

### 3.2 Delta Patching with Optimistic Locking

Every element read returns a `contentHash` (md5 of serialized content). Write operations require `If-Match` header:

```
PATCH /agent-bricks/v1/pages/1297/elements
If-Match: "a1b2c3d4e5f6"
Content-Type: application/json

{
  "patches": [
    { "id": "705598", "settings": { "text": "New Heading" } }
  ]
}
```

Server flow:
1. Read `_bricks_page_content_2`
2. Compute current hash, compare to `If-Match`
3. If mismatch → `409 Conflict` with current hash (client must re-fetch)
4. If match → apply patches, write back, regenerate CSS
5. Return new `contentHash`

### 3.3 Bricks Lifecycle Awareness

After ANY write operation, the plugin MUST:

```php
// 1. Update post meta
update_post_meta( $post_id, '_bricks_page_content_2', $elements );

// 2. Regenerate CSS file (/uploads/bricks/css/post-{id}.css)
\Bricks\Assets::generate_css_file( $post_id );

// 3. Clear Bricks internal cache
delete_transient( 'bricks_' . $post_id );

// 4. Fire action for other plugins
do_action( 'agent_bricks_content_updated', $post_id, $elements );
```

If `wp bricks regenerate_assets` WP-CLI command exists, the CLI can also call it after batch operations.

### 3.4 Framework Detection

The `/site/frameworks` endpoint checks for installed CSS frameworks:

```php
// ACSS detection
if ( is_plugin_active( 'flavor-of-acss/automaticcss-plugin.php' ) ||
     is_plugin_active( 'flavor-of-acss-pro/automaticcss-plugin.php' ) ||
     class_exists( '\\Jetonaut\\AutomaticCSS\\Plugin' ) ) {
    // Read ACSS options from wp_options
    // Return variable values, spacing scale, utility classes
}

// Core Framework detection
if ( is_plugin_active( 'flavor-of-core-framework/core-framework.php' ) ||
     class_exists( 'CoreFramework' ) ) {
    // Read Core Framework options
}
```

Returns structured data the CLI uses to populate its framework config.

### 3.5 Validation Rules

The server-side validator enforces:
- Required fields: `name` (element type)
- Valid element types (from `bricksData.elements` registry)
- **Strict nesting hierarchy:** Section > Container > Block/Div > content elements
- Parent-child integrity (bidirectional)
- `_cssGlobalClasses` are valid class IDs (not names)
- **Dynamic data tags whitelisted:** `{post_title}`, `{acf_*}`, `{echo:*}`, `{custom_field:*}` etc.
- Media references use attachment IDs, not raw URLs

### 3.6 Meta Key Version Handling

Plugin detects the correct meta key suffix:

```php
private function get_content_meta_key() {
    // Check which meta key the current Bricks version uses
    if ( defined( 'BRICKS_VERSION' ) && version_compare( BRICKS_VERSION, '1.7.3', '>=' ) ) {
        return '_bricks_page_content_2';
    }
    return '_bricks_page_content';
}
```

Exposed via `/site/info` so the CLI doesn't hardcode it.

---

## 4. Go CLI — "The Brain"

### 4.1 Command Structure

```
bricks
├── config                    # Setup & configuration
│   ├── init                  # Interactive setup wizard (auto-detects frameworks)
│   ├── set <key> <value>     # Set config value
│   ├── get <key>             # Get config value
│   └── list                  # Show all config
│
├── site                      # Site operations (via plugin REST API)
│   ├── info                  # Show connected site info
│   ├── pull <page-id>        # Pull page elements to local JSON
│   ├── push <page-id> <file> # Push elements to page (with snapshot)
│   ├── patch <page-id>       # Apply delta patches from JSON or flags
│   ├── snapshot <page-id>    # Save snapshot before changes
│   ├── rollback <page-id>    # Rollback to snapshot
│   └── frameworks            # List detected CSS frameworks & their classes
│
├── generate                  # LLM-powered generation
│   ├── section <prompt>      # Generate a single section
│   ├── page <prompt>         # Generate full page
│   └── modify <prompt>       # Modify existing elements (accepts element context)
│
├── templates                 # Template management (local)
│   ├── list                  # List templates in local library
│   ├── show <name>           # Show template details
│   ├── search <query>        # Semantic vector search
│   ├── import <dir|url>      # Import templates from directory
│   ├── learn <page-id>       # Extract templates from existing pages
│   └── index                 # Rebuild vector index
│
├── compose                   # Compose templates into pages
│   └── <template...>         # Merge multiple templates (ID remap, class merge)
│
├── classes                   # Global class management
│   ├── list                  # List all classes (grouped by framework)
│   ├── create <name>         # Create new global class
│   ├── find <pattern>        # Find classes matching pattern
│   └── sync                  # Sync classes between CLI and site
│
├── styles                    # Theme style management
│   ├── show                  # Show current theme styles
│   ├── set <path> <value>    # Set a theme style value
│   ├── colors                # Manage color palette
│   └── variables             # Manage CSS custom properties
│
├── validate <file>           # Validate Bricks JSON structure
│
├── convert                   # Conversion tools
│   └── html <file|url>       # HTML → Bricks elements
│
├── media                     # Media management (via WP-CLI)
│   ├── upload <files...>     # Upload images to media library
│   ├── list                  # List available media
│   └── search <query>        # Find media by name
│
└── doctor <page-id>          # Page health check
```

All generation commands support:
- `--dry-run` — validate + show what would change, don't push
- `--framework <name>` — override active CSS framework
- `--page <id>` — target page
- `--output <file>` — save to local file instead of pushing

### 4.2 CSS Framework Registry

Local JSON configs at `~/.agent-to-bricks/frameworks/`:

```json
{
  "name": "Automatic.css",
  "slug": "acss",
  "version": "3.x",
  "detection": {
    "plugin_slugs": [
      "flavor-of-acss/automaticcss-plugin.php",
      "flavor-of-acss-pro/automaticcss-plugin.php"
    ],
    "class_exists": "\\Jetonaut\\AutomaticCSS\\Plugin"
  },
  "spacing": {
    "scale": ["xs", "s", "m", "l", "xl", "xxl"],
    "variable_pattern": "--space-{size}",
    "section_variable_pattern": "--section-space-{size}",
    "gutter_variable": "--gutter"
  },
  "typography": {
    "heading_variables": "--h{1-6}",
    "text_scale": ["s", "m", "l", "xl"],
    "text_variable_pattern": "--text-{size}",
    "font_variables": ["--heading-font-family", "--body-font-family"]
  },
  "colors": {
    "semantic": ["primary", "secondary", "accent", "base", "neutral"],
    "variable_pattern": "--{name}",
    "shade_pattern": "--{name}-{shade}",
    "shades": ["ultra-light", "light", "medium", "dark", "ultra-dark", "hover"],
    "transparency_pattern": "--{name}-trans-{percent}"
  },
  "utility_classes": {
    "buttons": {
      "pattern": "btn--{variant}",
      "variants": ["primary", "secondary", "accent", "base", "neutral", "outline", "white"],
      "modifiers": ["-light", "-dark"],
      "sizes": ["s", "m", "l"]
    },
    "backgrounds": {
      "pattern": "bg--{variant}",
      "variants": ["light", "dark", "ultra-light", "ultra-dark"]
    },
    "text_colors": {
      "pattern": "text--{variant}",
      "variants": ["light", "dark", "light-muted", "dark-muted"]
    },
    "layout": ["content-grid", "breakout--full", "content--feature-max"],
    "interactive": ["clickable-parent", "focus-parent"],
    "icons": {
      "pattern": "icon--{size}",
      "sizes": ["s", "m", "l"]
    }
  },
  "class_prefix_in_bricks": "acss_import_",
  "reverse_mapping": {
    "var(--primary)": "Primary Color",
    "var(--space-m)": "Medium Spacing",
    "var(--h1)": "Heading 1 Size"
  }
}
```

**Auto-population:** On `bricks config init`, the CLI calls `/site/frameworks` to get the active framework's actual values from the server, then merges with the framework config template. This means the config reflects the user's actual ACSS settings, not defaults.

### 4.3 LLM Orchestrator

Supports any OpenAI-compatible API. System prompt construction:

```
1. Base element schema reference (valid types, nesting rules, settings keys)
2. Active CSS framework reference (from registry — classes, variables, patterns)
3. Available global classes from connected site (from /classes endpoint)
4. Style profile (from style-guide.json or learning DB)
5. Template examples from vector index (RAG — similar templates to the request)
6. Available media on site (attachment IDs + descriptions for image-aware generation)
```

**Structured output:** Forces JSON schema response for reliable parsing. Falls back to JSON extraction from text if provider doesn't support structured output.

**Multi-pass for complex pages:**
1. Outline pass: determine section structure (hero, features, pricing, etc.)
2. Per-section pass: generate each section with full detail
3. Composition: merge sections with ID dedup

### 4.4 Template BYOT (Bring Your Own Templates)

Users don't get shipped templates. Instead:

1. **Import from directory:** `bricks templates import ./my-templates/` — reads JSON files matching Bricks export format
2. **Learn from existing pages:** `bricks templates learn 1297` — pulls page, splits into sections, stores as reusable templates
3. **Import from site:** `bricks templates import --from-site` — pulls all `bricks_template` posts
4. **Semantic search:** Embeddings generated via OpenAI/Ollama, stored in SQLite with HNSW index
5. **RAG during generation:** When generating, the CLI finds similar templates from the user's library and includes them as examples in the LLM prompt

### 4.5 Style Profiles

Instead of a complex learning engine (cut per counselor feedback), ship with explicit style profiles:

```json
// ~/.agent-to-bricks/style-profile.json
{
  "name": "My Agency Style",
  "spacing": {
    "section_padding": "var(--section-space-l)",
    "content_gap": "var(--space-m)",
    "element_gap": "var(--space-s)"
  },
  "typography": {
    "prefer_tags": { "hero_heading": "h1", "section_heading": "h2" }
  },
  "patterns": {
    "buttons": {
      "primary": "btn--primary",
      "secondary": "btn--outline"
    },
    "sections": {
      "default_background": "bg--light",
      "alternate_background": "bg--ultra-light"
    }
  },
  "preferences": {
    "max_nesting_depth": 4,
    "prefer_global_classes_over_inline": true,
    "use_css_variables_for_spacing": true
  }
}
```

The `bricks templates learn` command can auto-generate/update this profile by analyzing existing pages — frequency-counting classes, spacing values, and patterns. But it's always an explicit file the user can edit, not a black-box inference engine.

### 4.6 HTML to Bricks Converter

Parses HTML/CSS and maps to Bricks elements:

- HTML tags → Bricks element types (`<section>` → section, `<h1>` → heading, `<p>` → text-basic, `<button>` → button, `<img>` → image, `<div>` → div/block/container)
- CSS properties → Bricks settings (inline styles → settings, class references → `_cssGlobalClasses`)
- Extract colors → map to framework variables where possible
- Extract spacing → map to framework variables
- Image URLs → upload via WP-CLI → replace with attachment IDs

### 4.7 Page Doctor

```
bricks doctor 1297

Checking page 1297...
✓ 744 elements found
✗ 3 orphaned elements (parent references non-existent ID)
  - Element "abc123" references parent "deleted1" (not found)
  - Element "def456" references parent "deleted1" (not found)
  - Element "ghi789" references parent "deleted2" (not found)
✗ 2 broken class references
  - Element "jkl012" references class "custom-xyz" (not in global classes)
  - Element "mno345" references class "old-style" (not in global classes)
✗ 1 nesting violation
  - Section "pqr678" is nested inside Container "stu901" (sections must be root or inside sections)
✓ No duplicate element IDs
✓ All parent-child relationships bidirectional
✓ Dynamic data tags valid

3 issues found. Run 'bricks doctor 1297 --fix' to auto-repair.
```

### 4.8 Validator

JSON schema validation covering:
- Required fields (`name` for all elements)
- Valid element types (synced from `/site/info`)
- Nesting hierarchy: Section > Container > Block/Div > content
- Parent-child bidirectional integrity
- `_cssGlobalClasses` reference valid IDs
- Dynamic data tags whitelisted (`{post_title}`, `{acf_*}`, `{echo:*}`, etc.)
- Media references use attachment IDs (not bare URLs)
- Settings keys are valid for element type
- Responsive breakpoint suffixes are valid

---

## 5. WP-CLI Integration

### 5.1 Configuration

```yaml
# ~/.agent-to-bricks/config.yaml
wpcli:
  mode: ssh              # "local" | "ssh" | "disabled"
  ssh: user@mysite.com
  path: /var/www/html
```

### 5.2 Operations

| Go CLI Command | WP-CLI Underneath | Purpose |
|----------------|-------------------|---------|
| `bricks media upload <files>` | `wp media import <file> --porcelain` | Upload → get attachment ID |
| `bricks media list` | `wp post list --post_type=attachment --format=json` | List media |
| `bricks media search <q>` | `wp post list --post_type=attachment --s=<q>` | Find media |
| `bricks site flush` | `wp cache flush && wp bricks regenerate_assets` | Clear caches |
| `bricks site create-page <title>` | `wp post create --post_type=page --porcelain` | Create page |
| `bricks site plugins` | `wp plugin list --status=active --format=json` | Detect plugins |

### 5.3 Media-Aware Generation

When the CLI knows available media, it includes them in LLM context:

```
Available images:
- ID 2847: "mountain-sunset.jpg" (1920x1080)
- ID 2848: "team-photo.jpg" (800x600)

Use attachment ID format: { "id": 2847, "url": "...", "full": "..." }
Do NOT use placeholder or external URLs.
```

### 5.4 Graceful Degradation

If WP-CLI unavailable:
- Media uploads → REST API `/wp/v2/media` (multipart)
- Cache flush → custom plugin endpoint
- Asset regen → plugin handles automatically after writes
- Warning printed once per session

---

## 6. Auth Matrix

| Client | Auth Method | Capability |
|--------|-------------|------------|
| Go CLI (REST) | Application Password (Basic Auth header) | `edit_posts` (read), `edit_post` per-post (write) |
| Browser Panel | WordPress nonce (`wp_create_nonce('wp_rest')`) | `edit_posts` (read), `edit_post` per-post (write) |
| WP-CLI | SSH session (inherits WP user) | Full WordPress capabilities |

---

## 7. Implementation Scope

### Must Have (v1.0)

| Feature | Component |
|---------|-----------|
| Full REST endpoint set (~15 endpoints) | Plugin |
| Delta patching with optimistic locking | Plugin |
| Batch operations | Plugin |
| Snapshot/rollback | Plugin |
| Bricks lifecycle awareness (CSS regen, cache) | Plugin |
| Framework detection (ACSS first) | Plugin |
| Meta key version handling | Plugin |
| Strict validation (nesting, dynamic data, media refs) | Plugin + CLI |
| Go CLI with all command groups | CLI |
| LLM orchestration with framework-aware prompts | CLI |
| CSS Framework Registry (ACSS config) | CLI |
| Style profiles (explicit JSON) | CLI |
| Template BYOT + vector indexing + semantic search | CLI |
| Template learning from existing pages | CLI |
| HTML → Bricks converter | CLI |
| Page doctor / health check | CLI |
| WP-CLI media upload integration | CLI |
| WP-CLI cache/asset management | CLI |
| Dry run mode for all generation | CLI |
| Config init with auto-detection | CLI |

### Cut (not in v1.0)

| Feature | Reason |
|---------|--------|
| GSAP animation presets | Nice to have, not core |
| Diff tool | Nice to have |
| Export to HTML | Nice to have |
| Concurrent editing detection | Complex, optimistic locking covers most cases |
| Webhook support | Low value |
| Chrome extension | CLI-first, extension is future UX layer |
| Inference-based learning engine | Replaced by explicit style profiles + simple frequency analysis |

---

## 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Bricks meta key changes (`_2` → `_3`) | High | Version detection via BRICKS_VERSION constant, exposed via `/site/info` |
| `builderTest` API removed | Medium | Plugin doesn't depend on it; only browser panel does. Panel has fallback to Vue store |
| Direct meta write misses Bricks side effects | Critical | Call `\Bricks\Assets::generate_css_file()` + cache clear after every write |
| Race condition: builder open + CLI writes | High | Optimistic locking with content hash + `If-Match` header + 409 rejection |
| LLM generates invalid elements | Medium | Server-side validation gate + dry run mode + snapshot/rollback |
| ACSS option keys change between versions | Medium | Framework config is auto-populated from server, not hardcoded |
| Element ID collisions during compose | Medium | Deterministic ID remapping in composer (ported from Python CLI) |

---

## 9. ACSS Integration Specifics

### Discovery
Plugin endpoint `/site/frameworks` detects ACSS and reads its configuration from `wp_options`. The exact option keys need to be mapped by inspecting the ACSS plugin on the staging server.

### What we know already (from project research)
- ACSS classes imported into Bricks as locked global classes with `acss_import_` prefix
- 58+ utility classes documented across templates (buttons, backgrounds, text, layout, icons)
- CSS variables: `--space-{size}`, `--section-space-{size}`, `--h{1-6}`, `--text-{size}`, `--primary`, `--secondary`, etc.
- Class structure: `{ id: "acss_import_btn--primary", name: "btn--primary", settings: [], locked: true }`

### What we need to discover (from server inspection)
- Exact `wp_options` keys ACSS uses for its settings
- How ACSS stores its compiled CSS
- Full list of generated CSS custom properties
- Any ACSS PHP classes/functions we can call
- ACSS version detection method

### How it flows
1. `bricks config init` → calls `/site/frameworks` → detects ACSS → returns config
2. CLI merges server response with `acss.json` framework template
3. During generation, CLI tells LLM: "Use these ACSS classes and variables, not inline styles"
4. Generated elements reference `acss_import_*` class IDs in `_cssGlobalClasses`
5. Validator confirms referenced classes exist on the site

---

## 10. Data Flow: End-to-End Example

### "Build me a pricing page"

```
1. User: bricks generate page "SaaS pricing page with 3 tiers" \
         --page 1297 --framework acss \
         --images ~/assets/check-icon.svg

2. CLI: Upload image
   → wp media import ~/assets/check-icon.svg --porcelain --ssh=user@site.com
   → Returns attachment ID 2950

3. CLI: Fetch site context
   → GET /agent-bricks/v1/site/frameworks → ACSS active, returns class inventory
   → GET /agent-bricks/v1/classes → 120 global classes available
   → GET /agent-bricks/v1/pages/1297/elements → current page content + contentHash

4. CLI: Build LLM context
   → Load acss.json framework config
   → Load style-profile.json (user's preferred patterns)
   → Search template library: "pricing" → 3 similar templates found (RAG)
   → Compose system prompt with all context

5. CLI: Generate
   → LLM returns element JSON using ACSS classes + attachment ID 2950
   → Validate against schema (nesting, class refs, media refs)
   → Show dry-run preview if --dry-run flag

6. CLI: Push
   → POST /agent-bricks/v1/pages/1297/snapshot (save current state)
   → PUT /agent-bricks/v1/pages/1297/elements
     If-Match: "{contentHash}"
     Body: { elements: [...] }
   → Plugin: write meta, generate CSS, clear cache
   → Returns: { success, newContentHash }

7. CLI: Post-push
   → wp cache flush --ssh=user@site.com
   → Store generation in learning DB for future style profile updates
   → "Page 1297 updated. 47 elements, 3 sections. Snapshot saved."
```

---

## 11. Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Plugin | PHP 7.4+ | WordPress requirement |
| CLI | Go 1.22+ | Single binary, cross-platform, fast startup, excellent HTTP/JSON stdlib |
| Vector DB | SQLite + go-vector-lib | Embedded, zero deps, portable |
| Config | YAML (config) + JSON (frameworks, style profiles) | YAML for human editing, JSON for structured data |
| Schema validation | JSON Schema (Go lib) | Same schema used by plugin and CLI |
| LLM client | OpenAI-compatible HTTP | Works with Cerebras, OpenRouter, Ollama, any OpenAI-compat API |
| Embedding | OpenAI API or local (Ollama) | For template indexing |

---

## 12. Open Questions

1. **ACSS `wp_options` keys** — Need to inspect plugin on staging server to map exact option names
2. **Bricks `\Bricks\Assets::generate_css_file()` signature** — Need to verify exact function call and parameters
3. **Bricks nesting rules by version** — Need compatibility matrix (1.9 vs 1.10+ vs 2.x)
4. **Go vector DB library selection** — Evaluate go-faiss, sqlite-vec, or custom HNSW
5. **CLI distribution** — GitHub Releases with goreleaser, Homebrew tap, or both
