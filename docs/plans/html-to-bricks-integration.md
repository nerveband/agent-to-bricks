# HTML to Bricks Integration Plan

**Date:** 2026-03-23
**Bricks Version:** 2.3 (released March 18, 2026)
**ATB Version:** 2.1.0
**Status:** Draft

---

## Executive Summary

Bricks 2.3 introduced a native "HTML & CSS to Bricks" feature — a **client-side, paste-based converter** that transforms HTML/CSS into native Bricks elements, global classes, and global variables. However, this feature has **no API** and **no programmatic interface** — it only works through manual clipboard paste in the visual builder.

This creates a major opportunity for Agent to Bricks: **server-side, API-driven HTML-to-Bricks conversion** that agents, CLI tools, and automation workflows can use programmatically. Combined with our existing LLM pipeline, we can build an **AI-enhanced HTML converter** that goes far beyond Bricks' native 1:1 tag mapping.

### Competitive Landscape

| Tool | Type | API? | AI? | Price |
|------|------|------|-----|-------|
| **Bricks 2.3 Native** | Client-side paste | No | No | Included |
| **Code2Bricks** | Web tool + WP plugin | Limited | No | Free/Paid |
| **Bricks Pilot** | WP plugin | No | Yes (Claude) | $5-50/mo |
| **Bricks AI Converter** | Web tool | No | Yes (BYO key) | Free |
| **Brickify** | Web tool | No | No | Free |
| **html2bricks (Shyft)** | AI prompt/skill | No | Yes | Free |
| **Agent to Bricks (proposed)** | WP plugin + CLI + GUI | **Yes** | **Yes** | Included |

**Our unique advantage:** Full programmatic API + existing agent infrastructure + framework-aware context + LLM enhancement + CLI/GUI integration.

---

## What Bricks 2.3 Does (and Doesn't Do)

### What It Does
- Paste HTML/CSS into the builder canvas → auto-converts to native elements
- Maps standard tags: `<section>` → Section, `<div>` → Div, `<h1-h6>` → Heading, `<img>` → Image, `<a>` → Link
- CSS classes → Bricks Global Classes
- `:root` variables → Bricks Global Variables
- Mappable CSS properties (margin, padding, width, typography) → native Bricks UI controls
- Unmappable CSS → element's Custom CSS area
- JS/external resources → quarantined Code elements requiring approval
- Settings: confirm on paste, no confirm, or disabled

### What It Doesn't Do
- No API or programmatic interface
- No batch/bulk conversion
- No AI enhancement (purely deterministic tag mapping)
- No framework detection (doesn't map to ACSS classes)
- No `::before`/`::after` pseudo-element support
- No `@keyframes` animation conversion
- No semantic restructuring (blindly maps tag-for-tag)
- No responsive breakpoint inference
- No Bricks query loop detection from repeated HTML patterns
- No WooCommerce-aware conversion
- No existing page context awareness

---

## Proposed Architecture

### Overview

```
                    ┌─────────────────────────────────────────────┐
                    │           HTML TO BRICKS PIPELINE           │
                    │                                             │
  HTML/CSS Input ──►│  1. Parse & Analyze                        │
                    │  2. Structural Mapping (deterministic)      │
                    │  3. CSS Property Extraction                 │
                    │  4. Framework Detection & Class Mapping     │
                    │  5. LLM Enhancement (optional)              │
                    │  6. Element Validation (existing)           │
                    │  7. Bricks Lifecycle (existing)             │
                    │                                             │
                    │  Output: Validated Bricks element JSON      │
                    └─────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
              REST API           CLI Command         GUI Feature
          POST /convert      `atb convert`       "Import HTML" tab
```

### Phase Breakdown

---

## Phase 1: Server-Side HTML Parser & Deterministic Converter

**Goal:** Match Bricks 2.3's native conversion capability, but server-side via REST API.

### 1.1 HTML Parser (PHP)

Create `class-html-parser.php` in `plugin/agent-to-bricks/includes/`:

```php
class ATB_HTML_Parser {
    /**
     * Parse HTML string into a DOM tree, extract:
     * - Element hierarchy (tags, attributes, text content)
     * - Inline styles
     * - Class names
     * - IDs
     * - Data attributes
     * - Image sources
     * - Link hrefs
     * - Script/style blocks
     */
    public function parse(string $html): array;

    /**
     * Extract <style> blocks and inline styles into
     * a structured CSS representation
     */
    public function extract_css(string $html): array;

    /**
     * Extract :root CSS variables
     */
    public function extract_variables(string $css): array;

    /**
     * Extract @media queries and map to Bricks breakpoints
     */
    public function extract_breakpoints(string $css): array;
}
```

**Implementation notes:**
- Use PHP's `DOMDocument` + `DOMXPath` for parsing (no external deps)
- Handle malformed HTML gracefully (WordPress's `wp_kses` for sanitization)
- Extract embedded `<style>` and `<link>` references
- Parse inline `style=""` attributes into structured properties
- Preserve document hierarchy for parent/child mapping

### 1.2 Tag-to-Element Mapper

Create `class-element-mapper.php`:

```php
class ATB_Element_Mapper {
    /**
     * Core tag mapping (matching Bricks 2.3 native behavior)
     */
    const TAG_MAP = [
        'section'    => 'section',
        'div'        => 'div',
        'h1'         => 'heading',
        'h2'         => 'heading',
        'h3'         => 'heading',
        'h4'         => 'heading',
        'h5'         => 'heading',
        'h6'         => 'heading',
        'p'          => 'text-basic',
        'span'       => 'div',         // inline → div with display:inline
        'img'        => 'image',
        'a'          => 'div',         // with link settings
        'ul'         => 'list',
        'ol'         => 'list',
        'li'         => 'div',
        'button'     => 'button',
        'form'       => 'form',
        'input'      => 'form',        // within form context
        'textarea'   => 'form',
        'select'     => 'form',
        'video'      => 'video',
        'audio'      => 'audio',
        'iframe'     => 'code',        // embed as code element
        'svg'        => 'svg',
        'nav'        => 'nav-menu',    // or div with nav role
        'header'     => 'section',
        'footer'     => 'section',
        'main'       => 'section',
        'article'    => 'section',
        'aside'      => 'div',
        'figure'     => 'div',
        'figcaption' => 'text-basic',
        'blockquote' => 'text-basic',  // with blockquote tag
        'pre'        => 'code',
        'code'       => 'code',
        'table'      => 'code',        // complex tables → code element
        'hr'         => 'divider',
        'br'         => null,          // absorbed into parent text
    ];

    /**
     * Extended mapping for semantic awareness
     * (goes beyond Bricks 2.3 native)
     */
    const PATTERN_MAP = [
        // Common UI patterns detected by class/structure
        'card'       => ['section', 'container', 'content'],
        'hero'       => ['section', 'container', 'heading', 'text', 'button'],
        'navbar'     => ['section', 'nav-menu'],
        'footer'     => ['section', 'container', 'columns'],
        'grid'       => ['div' /* with CSS Grid settings */],
        'slider'     => ['slider-nested'],
        'accordion'  => ['accordion-nested'],
        'tabs'       => ['tabs-nested'],
    ];
}
```

### 1.3 CSS-to-Bricks Property Mapper

Create `class-css-mapper.php`:

```php
class ATB_CSS_Mapper {
    /**
     * CSS properties that map directly to Bricks UI controls
     */
    const DIRECT_MAP = [
        // Layout
        'display'         => '_display',
        'flex-direction'  => '_direction',
        'justify-content' => '_justifyContent',
        'align-items'     => '_alignItems',
        'flex-wrap'       => '_flexWrap',
        'gap'             => '_gap',
        'grid-template-columns' => '_gridTemplateColumns',
        'grid-template-rows'    => '_gridTemplateRows',

        // Spacing
        'margin-top'      => ['_margin', 'top'],
        'margin-right'    => ['_margin', 'right'],
        'margin-bottom'   => ['_margin', 'bottom'],
        'margin-left'     => ['_margin', 'left'],
        'padding-top'     => ['_padding', 'top'],
        'padding-right'   => ['_padding', 'right'],
        'padding-bottom'  => ['_padding', 'bottom'],
        'padding-left'    => ['_padding', 'left'],

        // Sizing
        'width'           => '_width',
        'min-width'       => '_widthMin',
        'max-width'       => '_widthMax',
        'height'          => '_height',
        'min-height'      => '_heightMin',
        'max-height'      => '_heightMax',

        // Typography
        'font-size'       => ['_typography', 'font-size'],
        'font-weight'     => ['_typography', 'font-weight'],
        'font-family'     => ['_typography', 'font-family'],
        'line-height'     => ['_typography', 'line-height'],
        'letter-spacing'  => ['_typography', 'letter-spacing'],
        'text-align'      => ['_typography', 'text-align'],
        'text-transform'  => ['_typography', 'text-transform'],
        'text-decoration' => ['_typography', 'text-decoration'],
        'color'           => ['_typography', 'color'],

        // Background
        'background-color'  => ['_background', 'color'],
        'background-image'  => ['_background', 'image'],
        'background-size'   => ['_background', 'size'],
        'background-position' => ['_background', 'position'],
        'background-repeat' => ['_background', 'repeat'],

        // Border
        'border-width'    => ['_border', 'width'],
        'border-style'    => ['_border', 'style'],
        'border-color'    => ['_border', 'color'],
        'border-radius'   => ['_border', 'radius'],

        // Effects
        'opacity'         => '_opacity',
        'box-shadow'      => ['_boxShadow', 0],
        'overflow'        => '_overflow',
        'z-index'         => '_zIndex',
        'position'        => '_position',
        'top'             => '_top',
        'right'           => '_right',
        'bottom'          => '_bottom',
        'left'            => '_left',

        // Transform (new in Bricks 2.3)
        'transform'       => '_transform',
        'perspective'     => '_perspective',
    ];

    /**
     * Map CSS property+value to Bricks setting
     */
    public function map_property(string $property, string $value): ?array;

    /**
     * Map shorthand CSS (margin, padding, border, background) to expanded Bricks settings
     */
    public function expand_shorthand(string $property, string $value): array;

    /**
     * Properties that have no Bricks UI equivalent → _cssCustom
     */
    public function get_custom_css(array $unmapped_properties): string;
}
```

### 1.4 REST API Endpoint

Add to `class-rest-api.php`:

```
POST /agent-bricks/v1/convert
```

**Request:**
```json
{
  "html": "<section class='hero'>...</section>",
  "css": ".hero { background: #000; ... }",
  "postId": 42,
  "options": {
    "mode": "append|replace|template",
    "enhanceWithLlm": false,
    "detectPatterns": true,
    "mapToFramework": true,
    "createGlobalClasses": true,
    "createGlobalVariables": true,
    "parentId": null,
    "insertAfter": null
  }
}
```

**Response:**
```json
{
  "success": true,
  "elements": [...validated Bricks elements...],
  "globalClasses": [...created global classes...],
  "globalVariables": [...created global variables...],
  "warnings": ["2 CSS properties mapped to Custom CSS", "1 <script> tag quarantined"],
  "stats": {
    "htmlTags": 47,
    "bricksElements": 32,
    "cssProperties": 156,
    "nativeMapped": 128,
    "customCss": 28,
    "classesCreated": 12,
    "variablesCreated": 4
  }
}
```

### 1.5 Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `includes/class-html-parser.php` | HTML DOM parsing and structure extraction |
| Create | `includes/class-element-mapper.php` | HTML tag → Bricks element mapping |
| Create | `includes/class-css-mapper.php` | CSS property → Bricks setting mapping |
| Create | `includes/class-html-converter.php` | Orchestrator combining parser + mappers |
| Create | `includes/class-convert-api.php` | REST endpoint registration and handling |
| Create | `includes/class-global-class-builder.php` | CSS classes → Bricks global classes |
| Create | `includes/class-global-variable-builder.php` | CSS variables → Bricks global variables |
| Modify | `agent-to-bricks.php` | Register new includes and API routes |
| Modify | `class-rest-api.php` | Add convert endpoint registration |
| Create | `tests/test-html-parser.php` | Unit tests for HTML parsing |
| Create | `tests/test-element-mapper.php` | Unit tests for tag mapping |
| Create | `tests/test-css-mapper.php` | Unit tests for CSS property mapping |
| Create | `tests/test-html-converter.php` | Integration tests for full conversion |

### Estimated Effort: 2-3 days

---

## Phase 2: Framework-Aware Conversion

**Goal:** Leverage existing ACSS/framework detection to map CSS to framework classes instead of inline styles.

### 2.1 ACSS Class Matcher

When converting CSS properties, check if they match ACSS utility classes:

```php
class ATB_Framework_Matcher {
    /**
     * Given a CSS property+value, find matching ACSS/framework class
     *
     * Example: padding: var(--space-m) → class "p--m"
     * Example: color: var(--primary) → class "text--primary"
     * Example: font-size: var(--step-2) → class "fs--2"
     */
    public function find_matching_class(string $property, string $value): ?string;

    /**
     * Detect if input HTML/CSS was generated by a known framework
     * (Tailwind, Bootstrap, etc.) and map classes accordingly
     */
    public function detect_source_framework(array $classes): ?string;

    /**
     * Map Tailwind classes to ACSS equivalents
     * e.g., "flex items-center gap-4" → ACSS classes
     */
    public function translate_framework_classes(array $source_classes, string $source_framework): array;
}
```

### 2.2 Smart Class Resolution

When input HTML uses classes from known frameworks (Tailwind, Bootstrap):

1. Parse the class names to understand intent (e.g., `flex`, `items-center`, `gap-4`)
2. Map to equivalent ACSS classes if available
3. Fall back to creating custom global classes with the extracted CSS values
4. Report the mapping in the response for transparency

### 2.3 Variable Substitution

When CSS values match ACSS CSS variable values:

```
color: #ff6b35  →  detected as --accent  →  use var(--accent)
padding: 1.5rem →  detected as --space-m →  use var(--space-m)
```

### 2.4 Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `includes/class-framework-matcher.php` | CSS-to-framework class matching |
| Modify | `includes/class-html-converter.php` | Integrate framework matching into pipeline |
| Modify | `includes/class-css-mapper.php` | Add framework-aware property mapping |
| Create | `tests/test-framework-matcher.php` | Unit tests |

### Estimated Effort: 1-2 days

---

## Phase 3: LLM-Enhanced Conversion

**Goal:** Use the existing LLM pipeline to intelligently enhance converted elements beyond 1:1 mapping.

### 3.1 Enhancement Modes

Add an `enhanceWithLlm` option that triggers a post-processing pass:

**Structural Enhancement:**
- Detect repeated HTML patterns → suggest Bricks Query Loops
- Recognize common UI patterns (card grids, hero sections, testimonials) → use optimal Bricks element combinations
- Suggest Bricks-native alternatives (e.g., `<nav>` with links → Nav Menu element with actual WP menu integration)
- Identify form structures → generate proper Bricks Form elements with field mapping

**Semantic Enhancement:**
- Analyze content to suggest better element labels for the structure panel
- Detect accessibility issues and fix them (missing alt text, ARIA labels, heading hierarchy)
- Suggest dynamic data tags where appropriate (e.g., `{post_title}`, `{post_excerpt}`)

**Responsive Enhancement:**
- Analyze `@media` queries and map to Bricks breakpoints (tablet, mobile_landscape, mobile)
- Infer responsive behavior from CSS patterns (e.g., flex-wrap → stack on mobile)
- Suggest responsive adjustments the HTML doesn't specify

### 3.2 LLM Prompt Template

Create `templates/convert-enhance-prompt.php`:

```
You are enhancing a Bricks Builder element tree that was mechanically converted from HTML/CSS.

CURRENT ELEMENTS (from deterministic conversion):
{elements_json}

ORIGINAL HTML:
{original_html}

SITE CONTEXT:
- Framework: {framework_name}
- Available Classes: {global_classes}
- Available Variables: {global_variables}

TASKS:
1. Improve element structure (use optimal Bricks elements for each UI pattern)
2. Apply framework classes where appropriate
3. Set proper responsive breakpoint overrides
4. Add meaningful labels to elements
5. Flag any accessibility issues

Return the enhanced elements array with explanations for changes made.
```

### 3.3 Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `templates/convert-enhance-prompt.php` | LLM enhancement system prompt |
| Modify | `includes/class-html-converter.php` | Add LLM enhancement pass |
| Modify | `includes/class-llm-client.php` | Add convert-enhance request type |
| Create | `tests/test-llm-enhancement.php` | Tests for enhanced conversion |

### Estimated Effort: 1-2 days

---

## Phase 4: CLI Integration

**Goal:** Add HTML conversion commands to the Go CLI.

### 4.1 New CLI Command

```bash
# Convert HTML file to Bricks elements on a page
atb convert --file index.html --page 42

# Convert with CSS file
atb convert --file index.html --css styles.css --page 42

# Convert from stdin (pipe from curl, AI output, etc.)
curl https://example.com | atb convert --page 42

# Convert with LLM enhancement
atb convert --file index.html --page 42 --enhance

# Convert to template instead of page
atb convert --file index.html --template "Hero Section"

# Preview conversion without applying (dry run)
atb convert --file index.html --page 42 --dry-run

# Convert and map to ACSS framework
atb convert --file index.html --page 42 --framework acss

# Convert from URL (fetch + convert)
atb convert --url https://example.com/landing --page 42
```

### 4.2 Go Implementation

```go
// cli/internal/commands/convert.go
type ConvertOptions struct {
    File       string   // HTML file path
    CSSFile    string   // Optional CSS file path
    URL        string   // URL to fetch and convert
    PageID     int      // Target page ID
    Template   string   // Create as template instead
    Enhance    bool     // LLM enhancement pass
    DryRun     bool     // Preview without applying
    Framework  string   // Target framework (acss, none)
    Mode       string   // append, replace
    ParentID   string   // Parent element ID for insertion
}
```

### 4.3 TUI Interactive Mode

In the TUI (`bubbletea`), add a conversion workflow:

1. User selects "Import HTML" from action menu
2. File picker or paste area for HTML input
3. Preview of conversion result (element tree visualization)
4. Option to enhance with LLM
5. Confirm and apply to page

### 4.4 Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `cli/internal/commands/convert.go` | Convert command implementation |
| Create | `cli/internal/client/convert.go` | API client for /convert endpoint |
| Modify | `cli/cmd/root.go` | Register convert command |
| Create | `cli/internal/commands/convert_test.go` | CLI tests |

### Estimated Effort: 1-2 days

---

## Phase 5: GUI Integration

**Goal:** Add HTML import UI to the Tauri/React desktop app.

### 5.1 GUI Features

- **Import HTML Tab** in the main interface
- **Drag-and-drop** HTML files onto the app
- **Paste HTML** from clipboard (like Bricks 2.3, but with API backing)
- **URL Import** — enter URL, app fetches and converts
- **Side-by-side preview** — original HTML (rendered) vs Bricks element tree
- **Enhancement toggle** — enable/disable LLM post-processing
- **Framework selector** — choose target framework for class mapping
- **Conversion log** — show what was mapped, what went to custom CSS, warnings

### 5.2 Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `gui/src/components/HtmlImport.tsx` | HTML import UI component |
| Create | `gui/src/components/ConversionPreview.tsx` | Preview/diff component |
| Modify | `gui/src/App.tsx` | Add import tab/route |
| Modify | `gui/src-tauri/src/lib.rs` | Add Rust commands for file reading |

### Estimated Effort: 2-3 days

---

## Phase 6: Advanced Capabilities

**Goal:** Differentiate significantly from all competitors.

### 6.1 Bidirectional Conversion (Bricks → HTML Export)

```
GET /agent-bricks/v1/pages/{id}/export?format=html
```

- Export Bricks page as clean, semantic HTML/CSS
- Useful for: migration, backup, external editing, AI processing
- Round-trip: export → edit externally → re-import

### 6.2 URL-to-Bricks Pipeline

```
POST /agent-bricks/v1/convert/url
{
  "url": "https://example.com/landing-page",
  "postId": 42,
  "options": {
    "includeImages": true,
    "stripNavigation": false,
    "enhanceWithLlm": true
  }
}
```

- Fetch URL → extract HTML/CSS → convert → apply
- Handle external images (download + import to media library)
- Strip cookie banners, analytics scripts, etc.
- CLI: `atb convert --url https://example.com --page 42`

### 6.3 Design-to-Bricks (Image Input)

Leverage multimodal LLMs to convert screenshots/mockups:

```
POST /agent-bricks/v1/convert/image
{
  "image": "base64-encoded-image-or-url",
  "postId": 42,
  "options": {
    "enhanceWithLlm": true,
    "framework": "acss"
  }
}
```

- Screenshot → LLM describes layout → generate Bricks elements
- Figma export → analyze design → build matching Bricks page
- Competitor: Bricks Pilot already offers this at $5-50/mo

### 6.4 Template Library from HTML Sources

- Convert popular HTML templates (Bootstrap themes, Tailwind UI components) into Bricks template library
- Pre-built conversion mappings for common component libraries
- Community-contributed conversion rules

### 6.5 MCP Integration Preparation

Bricks has "MCP Support" on their roadmap (137 upvotes, "Next" priority). Prepare ATB to work with it:

- Monitor `bricks-mcp` by cristianuibar (existing third-party MCP server)
- Design our conversion API to be MCP-tool-compatible
- When Bricks ships native MCP, integrate as an MCP tool provider

### 6.6 Conversion Intelligence Dashboard

WordPress admin page showing:

- Conversion history with before/after
- Accuracy metrics (how many properties mapped natively vs custom CSS)
- Framework utilization (how well converted content uses ACSS)
- Suggestions for improving converted content

---

## Phase 7: Testing Strategy

### 7.1 Unit Tests (PHP)

```
tests/
├── test-html-parser.php          # DOM parsing edge cases
├── test-element-mapper.php       # Tag → element mapping
├── test-css-mapper.php           # CSS property → Bricks setting mapping
├── test-css-shorthand.php        # Shorthand expansion (margin, padding, etc.)
├── test-framework-matcher.php    # ACSS class matching
├── test-global-class-builder.php # Global class creation
├── test-html-converter.php       # Full pipeline integration
└── test-convert-api.php          # REST endpoint tests
```

### 7.2 Test Fixtures

Create a library of HTML fixtures with expected Bricks output:

```
tests/fixtures/convert/
├── simple-heading.html           → expected-heading.json
├── hero-section.html             → expected-hero.json
├── card-grid.html                → expected-card-grid.json
├── nav-with-links.html           → expected-nav.json
├── form-with-inputs.html         → expected-form.json
├── tailwind-component.html       → expected-tailwind.json
├── bootstrap-card.html           → expected-bootstrap.json
├── complex-page.html             → expected-page.json
├── malformed-html.html           → expected-malformed.json
├── css-variables.html            → expected-variables.json
├── media-queries.html            → expected-responsive.json
└── svg-inline.html               → expected-svg.json
```

### 7.3 Staging Tests

Against `ts-staging.wavedepth.com`:

1. Convert known HTML fixtures → verify elements appear correctly in Bricks editor
2. Convert → export → re-convert → compare (round-trip fidelity)
3. Convert with ACSS framework → verify class usage
4. Convert complex real-world pages (CodePen examples, HTML templates)
5. Performance benchmarks (conversion time for various complexity levels)

### 7.4 Go CLI Tests

```
cli/internal/commands/convert_test.go    # Command parsing, flag handling
cli/internal/client/convert_test.go      # API client mocking
```

---

## Implementation Priority & Dependencies

```
Phase 1 ──► Phase 2 ──► Phase 3
  │                        │
  │                        ▼
  │         Phase 4 (CLI) ◄── can start after Phase 1
  │                        │
  │         Phase 5 (GUI) ◄── can start after Phase 1
  │
  └──────► Phase 6 (Advanced) ◄── after Phases 1-3
                │
                ▼
           Phase 7 (Testing) ◄── ongoing from Phase 1
```

**Recommended order:**
1. **Phase 1** — Core converter (critical path, unlocks everything else)
2. **Phase 7** — Tests (alongside Phase 1, TDD approach)
3. **Phase 2** — Framework matching (high value, low effort)
4. **Phase 4** — CLI command (agents need this)
5. **Phase 3** — LLM enhancement (differentiator)
6. **Phase 5** — GUI (nice to have)
7. **Phase 6** — Advanced features (future roadmap)

---

## API Documentation Updates

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agent-bricks/v1/convert` | Convert HTML/CSS to Bricks elements |
| POST | `/agent-bricks/v1/convert/url` | Fetch URL and convert to Bricks (Phase 6) |
| POST | `/agent-bricks/v1/convert/image` | Convert design image to Bricks (Phase 6) |
| GET | `/agent-bricks/v1/pages/{id}/export` | Export page as HTML/CSS (Phase 6) |

### Website Documentation

| Action | File | Description |
|--------|------|-------------|
| Create | `website/src/content/docs/plugin/html-converter.md` | Converter feature docs |
| Create | `website/src/content/docs/cli/convert-command.md` | CLI convert command docs |
| Create | `website/src/content/docs/plugin/rest-api-convert.md` | API endpoint reference |
| Modify | `website/src/content/docs/plugin/rest-api.md` | Add convert endpoints to overview |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bricks element JSON format undocumented, may change | High | Use existing validator; test against multiple Bricks versions |
| `_bricks_page_content_2` meta key change | High | Already handle via `site/info` endpoint returning correct meta key |
| Complex CSS fails to map cleanly | Medium | Graceful fallback to `_cssCustom`; LLM enhancement as safety net |
| Malformed HTML input crashes parser | Medium | `DOMDocument` handles most malformed HTML; add try/catch + sanitization |
| LLM enhancement produces invalid elements | Low | Existing element validator catches all structural issues |
| Performance on large HTML documents | Medium | Add size limits; stream processing for very large documents |
| Bricks ships their own API for HTML conversion | Low | Our LLM enhancement and framework awareness remain differentiators |

---

## Success Metrics

1. **Conversion accuracy**: >90% of CSS properties mapped to native Bricks controls (not custom CSS)
2. **Framework utilization**: >80% of convertible styles use ACSS classes when framework is active
3. **Round-trip fidelity**: Export → re-import produces identical element tree
4. **Performance**: <2s for typical section conversion, <10s for full page
5. **Test coverage**: >90% for parser, mapper, and converter classes
6. **User adoption**: Convert command becomes top-3 most used CLI command

---

## Assessment: Is Bricks 2.3's HTML-to-Bricks Well Thought Out?

### What They Got Right

**Yes, the core concept is excellent:**

1. **Clipboard-first UX** — Paste is the most natural action. No file uploads, no import wizards. Copy from CodePen/AI/anywhere → paste → done. This is genius for the target audience (visual builders, not developers).

2. **CSS `:root` → Global Variables** — This is smart. Most modern HTML/CSS uses custom properties. Auto-creating Bricks Global Variables from `:root` definitions means the design system carries over, not just the elements.

3. **CSS classes → Global Classes** — Same logic. Preserves the class-based architecture so elements remain maintainable, not just inline-styled one-offs.

4. **Security model** — Quarantining JS and external resources is the right call. They didn't try to be clever about executing unknown scripts; they flag it for human review. Good judgment.

5. **Three-mode configuration** — "Confirm on paste / No confirm / Disabled" gives agencies and teams control. If you're a solo freelancer, skip the dialog. If you're an agency with junior designers, require confirmation.

6. **Native CSS property mapping** — Mapping known properties (margin, padding, typography) to Bricks UI controls means the result is genuinely editable in the visual builder, not just a code dump.

### Where It Falls Short

**But it's limited in important ways:**

1. **No API** — The single biggest gap. This feature is useless for automation, agents, CI/CD, headless workflows, or any programmatic use case. It's a manual, one-at-a-time, human-in-the-loop operation. For an ecosystem increasingly moving toward AI agents and MCP (which Bricks themselves has on their roadmap), this is a missed opportunity.

2. **Deterministic-only** — It's a dumb parser. `<div>` always becomes Div. `<section>` always becomes Section. It can't recognize that a `<div class="card">` pattern repeated 6 times should be a Query Loop. It can't detect that a `<nav>` with `<a>` tags should map to a Nav Menu element. No semantic understanding.

3. **No framework awareness** — If your HTML uses Tailwind `flex items-center gap-4`, Bricks creates global classes literally named `flex`, `items-center`, `gap-4` — duplicating what ACSS already provides. It can't translate between frameworks.

4. **No responsive inference** — `@media` queries exist in the CSS, but there's no evidence they map to Bricks breakpoints. The responsive story is incomplete.

5. **No component detection** — Repeated patterns in HTML (cards, list items, testimonials) should become Bricks Components or Query Loops. The native converter just makes N independent copies.

6. **One-shot, no iteration** — You paste, you get results, done. No preview, no "convert but let me adjust mappings first," no iterative refinement. For complex HTML, the first conversion is rarely perfect.

7. **`_cssCustom` is a dumping ground** — Properties that don't map to UI controls get dumped into Custom CSS, which is less maintainable and harder to adjust visually.

### Verdict

**It's a solid v1 for manual use, but architecturally limited.** It solves the "I found nice HTML on CodePen and want it in Bricks" use case well. But it doesn't solve the automation, agent, or professional workflow use cases at all.

This is where ATB has a clear differentiation opportunity.

---

## Integration Strategy: Working WITH Bricks 2.3's Converter

Rather than only competing with the native feature, we should also integrate with it where it makes sense.

### Strategy 1: Pre-Process HTML for Better Native Conversion

ATB can **pre-process HTML** before users paste it into Bricks 2.3:

```
Raw HTML → ATB Pre-processor → Optimized HTML → User pastes into Bricks 2.3
```

What the pre-processor does:
- **Restructure** HTML to use tags that map better (e.g., wrap loose `<div>` groups in `<section>`)
- **Clean up** redundant wrappers, empty divs, framework-specific cruft
- **Inline critical CSS** from external `<link>` stylesheets so Bricks can see it
- **Normalize** class names to be Bricks-friendly
- **Extract and consolidate** `:root` variables from multiple sources
- **Add semantic tags** where generic `<div>` could be `<section>`, `<nav>`, `<header>`, etc.

This is a lightweight, no-commitment integration — users get better results from the native feature without us replacing it.

**CLI command:**
```bash
atb prepare --file messy-page.html > clean-page.html
# User copies clean-page.html content, pastes into Bricks
```

### Strategy 2: Post-Process Bricks' Conversion Output

After a user converts HTML with Bricks 2.3, ATB can **enhance the result**:

```
Bricks 2.3 conversion → ATB reads page elements → LLM enhancement → writes back
```

1. User pastes HTML into Bricks 2.3 (quick, familiar)
2. User runs `atb enhance --page 42` or clicks "Enhance" in GUI
3. ATB reads the converted elements via existing Elements API
4. LLM analyzes the flat element tree and suggests improvements:
   - Merge redundant wrappers
   - Apply ACSS classes where inline styles exist
   - Convert repeated patterns to Query Loops
   - Fix responsive breakpoints
   - Improve accessibility
5. User reviews suggestions and applies

**New endpoint:**
```
POST /agent-bricks/v1/pages/{id}/enhance
{
  "focus": ["framework", "responsive", "patterns", "accessibility"],
  "dryRun": true
}
```

### Strategy 3: Bypass the Native Converter Entirely (Full Pipeline)

For agent/automation workflows, skip Bricks 2.3 entirely and use our full pipeline:

```
HTML → ATB Parser → ATB Mapper → ATB Validator → Bricks post_meta
```

This is what Phases 1-3 of the plan already describe. The result is identical to what Bricks 2.3 produces (native elements in `_bricks_page_content_2`), but with:
- Full API access
- LLM enhancement
- Framework awareness
- Batch processing
- No manual intervention required

### Strategy 4: Hybrid — Let Users Choose

In the GUI and CLI, offer all three paths:

```
┌─────────────────────────────────────────────┐
│           IMPORT HTML                        │
│                                              │
│  ○ Quick Convert (Bricks-native style)       │
│    Fast, deterministic, matches paste behavior│
│                                              │
│  ○ Smart Convert (AI-enhanced)               │
│    Uses LLM to optimize structure & classes   │
│                                              │
│  ○ Prepare for Bricks Paste                  │
│    Cleans HTML for manual paste into editor   │
│                                              │
│  ○ Enhance Existing Page                     │
│    Improve already-converted page content     │
│                                              │
│  [Convert]                                   │
└─────────────────────────────────────────────┘
```

### Recommended Integration Approach

**Phase 1-3: Build our own full converter** (server-side, API-driven). This is the core value.

**Phase 4: Add "prepare" command** to CLI that outputs optimized HTML for Bricks paste. Low effort, high utility for users who prefer the native workflow.

**Phase 5: Add "enhance" endpoint** that improves any page's elements (whether converted by Bricks or by us). This works with the native feature rather than against it.

**Long-term: When Bricks ships MCP support**, integrate as an MCP tool provider so Bricks' own AI agent can call ATB's conversion and enhancement capabilities.

---

## Open Questions

1. **Should we support Bricks 2.3's paste format?** — If users copy from Bricks 2.3's converter, should we accept that intermediate format?
2. **Global class naming convention** — When creating global classes from CSS class names, should we prefix them (e.g., `atb--` prefix)?
3. **Image handling** — Should we download and import referenced images to the WP media library, or leave as external URLs?
4. **JavaScript handling** — Bricks 2.3 quarantines JS. Should we strip it entirely, convert to Bricks interactions, or pass to Code elements?
5. **Bricks MCP integration** — Should we contribute to or fork the `bricks-mcp` project, or build our own MCP tool layer?
6. **Versioning** — Does this warrant a minor version bump (2.2.0) or major (3.0.0)?
