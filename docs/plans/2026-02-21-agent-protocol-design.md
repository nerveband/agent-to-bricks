# Agent Protocol Design — Self-Discovery & ACSS-Aware Conversion

**Date:** 2026-02-21
**Status:** Approved

## Problem

AI agents building Bricks Builder pages today must manually construct Bricks JSON — a format LLMs are poor at generating correctly. The current `convert html` command maps HTML tags to Bricks elements but ignores CSS classes entirely, producing output that doesn't use ACSS or Frames styling. There's no way for an LLM to discover what design tokens, classes, templates, and workflows are available on a given site.

## Solution

Three interconnected features that make the CLI an intelligent bridge between LLMs and Bricks Builder:

1. **Agent Context** — A self-discovery command that dumps structured site design data for LLM consumption
2. **Smart Convert** — An ACSS-aware HTML-to-Bricks converter that maps class names to global class IDs
3. **Template Compose** — Enhanced template composition from the 452-template Frames library

## Design

### 1. Agent Context Command

**Command:** `bricks agent context`

Queries the live site's REST API and combines with local template catalog to produce a comprehensive context document.

**Output Sections:**

| Section | Source | Content |
|---------|--------|---------|
| Site Info | GET /site/info | Bricks version, WP version, breakpoints, element types |
| ACSS Tokens | GET /site/frameworks | Color families (15), spacing scale, typography scale, content width |
| Utility Classes | GET /classes?framework=acss | 2165 classes grouped: backgrounds (210), grids (117), text (81), overlays (162), spacing, flex, sizing, borders |
| Frames Classes | GET /classes (non-ACSS) | 522 component classes: fr-lede, btn--primary, intro-foxtrot, etc. |
| Templates | Local catalog.json | 452 templates grouped by category with type/element count |
| Workflows | Embedded | Instructions for 3 paths: HTML convert, template compose, AI generate |

**Flags:**

```
--format md       Markdown (default) — for LLM context windows
--format json     Structured JSON — for programmatic use
--format prompt   Complete LLM system prompt with instructions + context embedded
--section <name>  Dump one section: tokens, classes, templates, workflows
--compact         Shorter output for smaller context windows
```

**Format: prompt**

Generates a complete system prompt:

```
You are a web designer for a Bricks Builder site using Automatic.css 3.3.6.

When generating page content, write semantic HTML using the ACSS utility classes
and Frames component classes listed below. The HTML will be converted to Bricks
elements by the CLI.

## Rules
- Use ACSS utility classes for layout, spacing, colors, typography
- Use Frames component classes (fr-*, btn--*) for pre-built patterns
- Use CSS variables (--primary, --space-m, etc.) for inline styles
- Wrap page sections in <section> tags
- Use semantic HTML (h1-h6, p, ul, etc.)

## Available Design Tokens
[ACSS tokens inserted here]

## Available Classes
[Categorized class list inserted here]

## Available Templates
[Template catalog inserted here]
```

### 2. Enhanced HTML Converter

**Command:** `bricks convert html <file> [flags]`

**Class Resolution Pipeline:**

```
HTML class="height--full fr-lede my-custom"
         │              │          │
         ▼              ▼          ▼
    ACSS lookup    Frames lookup  Not found
         │              │          │
         ▼              ▼          ▼
  _cssGlobalClasses: [  _cssClasses:
    "acss_import_      "my-custom"
     height--full",
    "kddjfd"
  ]
```

Steps:
1. Parse HTML with golang.org/x/net/html (existing)
2. For each element's `class` attribute, split into individual class names
3. Look up each class name in the site's global class registry
4. ACSS classes (name match with `acss_import_` prefix) → add ID to `_cssGlobalClasses`
5. Frames/custom classes (exact name match) → add ID to `_cssGlobalClasses`
6. Unresolved classes → add to `_cssClasses` string
7. Extract `style` attribute → map CSS properties to Bricks settings:
   - `color: var(--primary)` → `_typography.color.raw: "var(--primary)"`
   - `padding: var(--space-m)` → `_padding` object
   - `background-color: var(--bg)` → `_background.color.raw`
   - `gap: var(--space-s)` → `_gap`
   - `max-width: var(--content-width)` → `_maxWidth`
8. Extract `data-*` attributes → `_attributes` array

**New Flags:**

```
--push <pageID>   Convert and push to a page via REST API
--snapshot        Create snapshot before pushing (safety)
--dry-run         Show conversion result without pushing
--stdin           Read HTML from stdin (pipe from LLM)
--class-cache     Cache class registry locally (faster repeated runs)
```

**Class Registry Cache:**

On first run (or with `--class-cache`), fetch all global classes and save to `~/.agent-to-bricks/class-registry.json`. Subsequent conversions use the cache. The cache stores:

```json
{
  "fetchedAt": "2026-02-21T...",
  "siteUrl": "https://ts-staging.wavedepth.com",
  "byName": {
    "height--full": "acss_import_height--full",
    "fr-lede": "kddjfd",
    "btn--primary": "btn--primary",
    ...
  }
}
```

### 3. Template Compose Enhancement

**Commands:**

```bash
# Search templates by keyword
bricks templates search "hero"
# Output: hero-cali (13 el), hero-barcelona (8 el), hero-atlanta (10 el)...

# Show template structure
bricks templates show hero-cali
# Output: element tree with labels, class list, preview URL

# Compose multiple templates into a page
bricks templates compose hero-cali content-section-alpha cta-section-bravo --push 1460
```

**Compose Algorithm:**
1. Load each template's bricksExport (content + globalClasses)
2. Merge content arrays sequentially (each template becomes a root section)
3. Merge globalClasses arrays, deduplicating by name (keep first definition)
4. Regenerate IDs to avoid conflicts between templates
5. Rebuild parent/children references with new IDs
6. Output merged Bricks export or push to page

### 4. Alumni Page Fix (Page 1460)

Update the Draft Alumni Page to use the site's actual design system:
- Replace inline-styled hero with Frames hero pattern (background image + overlay using `_cssGlobalClasses`)
- Use ACSS utility classes: `bg--ultra-dark`, `height--full`, `grid--auto-2`, `gap--m`, etc.
- Use Frames component classes: `fr-lede`, `fr-accent-heading`, `intro-foxtrot__heading`
- Match the About page's hero style with photo background

### 5. README Update

Document:
- Agent context workflow (for LLM integration)
- HTML convert pipeline (for building pages from HTML)
- Template compose (for assembling pages from Frames library)
- ACSS integration details
- Example workflows for Claude, ChatGPT, and other LLMs

## Architecture

```
                    ┌─────────────────┐
                    │   LLM / Agent   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    bricks agent      bricks convert   bricks templates
       context          html              compose
              │              │              │
              │         class registry      │
              │         lookup + map        │
              ▼              │              ▼
    Structured         ┌─────┴─────┐    Merged
    Context Doc        │  Bricks   │    Elements
    (md/json/prompt)   │  Elements │    + Classes
                       └─────┬─────┘
                             │
                      bricks site push
                             │
                             ▼
                    ┌─────────────────┐
                    │  WordPress +    │
                    │  Bricks Builder │
                    └─────────────────┘
```

## Data Sources

| Data | API Endpoint | Cached? |
|------|-------------|---------|
| Site info | GET /site/info | No |
| ACSS tokens | GET /site/frameworks | Per-session |
| Global classes | GET /classes | Yes (class-registry.json) |
| Theme styles | GET /styles | No |
| CSS variables | GET /variables | No |
| Templates | Local catalog.json | Yes (filesystem) |

## Success Criteria

1. `bricks agent context --format prompt` produces a system prompt that enables any LLM to generate ACSS-compliant HTML
2. `bricks convert html --push` correctly maps ACSS and Frames class names to `_cssGlobalClasses` IDs
3. `bricks templates compose` merges multiple templates with proper ID regeneration and class deduplication
4. The alumni page (1460) renders with the site's actual design language
5. An LLM can go from "build me an alumni page" to a live Bricks page using only CLI commands
