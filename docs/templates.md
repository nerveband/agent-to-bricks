# Templates

Templates are reusable page sections stored as JSON. Each template represents a self-contained piece of a page — a hero, a feature grid, a footer — that you can browse, search, compose together, and push to any page.

## What a template looks like

A template is a JSON file containing Bricks elements and (optionally) the global CSS classes those elements use. There are two formats:

### Standard format

Used when you learn templates from pages or create them by hand:

```json
{
  "name": "my-hero",
  "description": "Dark hero with CTA buttons",
  "category": "hero",
  "tags": ["hero", "dark", "cta"],
  "elements": [
    {
      "id": "8d66e3",
      "name": "section",
      "parent": 0,
      "children": ["a405ff"],
      "settings": {
        "_cssGlobalClasses": ["acss_import_section--l"]
      },
      "label": "Hero"
    },
    {
      "id": "a405ff",
      "name": "heading",
      "parent": "8d66e3",
      "children": [],
      "settings": {
        "text": "Welcome",
        "tag": "h1"
      }
    }
  ],
  "globalClasses": [],
  "source": "learned"
}
```

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Template name, used as the key when loading and composing |
| `description` | string | Human-readable summary |
| `category` | string | Grouping category (hero, footer, feature-section, etc.) |
| `tags` | string[] | Searchable tags |
| `elements` | object[] | The Bricks elements that make up this template |
| `globalClasses` | object[] | CSS class definitions used by the elements (optional) |
| `source` | string | Where the template came from — a file path or `"learned"` |

### Frames export format

Used by [Frames](https://getframes.io/) (a component library for Bricks). The template library ships in this format:

```json
{
  "idx": 4,
  "title": "Hero Cali",
  "elementCount": 13,
  "classCount": 20,
  "bricksExport": {
    "content": [ ... elements ... ],
    "source": "bricksCopiedElements",
    "sourceUrl": "https://example.com",
    "version": "2.2",
    "globalClasses": [ ... class definitions ... ],
    "components": [],
    "globalElements": []
  }
}
```

The CLI detects this format automatically when loading templates. Elements are read from `bricksExport.content` and classes from `bricksExport.globalClasses`.

## Element structure

Each element in a template is a JSON object:

```json
{
  "id": "8d66e3",
  "name": "section",
  "parent": 0,
  "children": ["a405ff", "54ede3"],
  "settings": {
    "_cssGlobalClasses": ["olpivm", "acss_import_bg--ultra-dark"],
    "_cssClasses": ["my-custom-class"],
    "text": "Content here",
    "tag": "h1",
    "_typography": { "font-size": "var(--h1)" },
    "_padding": { "top": "var(--space-m)" }
  },
  "label": "Hero Cali"
}
```

| Field | Description |
|-------|-------------|
| `id` | 6-character hex ID, unique within the template |
| `name` | Bricks element type: `section`, `container`, `div`, `heading`, `text-basic`, `button`, `image`, etc. |
| `parent` | ID of the parent element, or `0` for root elements |
| `children` | Array of child element IDs |
| `settings` | All configuration for the element (classes, text, styles, links, images) |
| `label` | Human-readable label shown in the Bricks editor |

### Key settings

- **`_cssGlobalClasses`** — array of global class IDs applied to the element
- **`_cssClasses`** — plain CSS class names that aren't in the global registry
- **`text`** — text content (for headings, text blocks, buttons)
- **`tag`** — HTML tag override (`h1`, `p`, `div`, `ul`, etc.)
- **`link`** — URL configuration for links and buttons
- **`image`** — image source configuration
- **`_typography`** — font-size, font-weight, color, line-height, letter-spacing
- **`_padding`** / **`_margin`** — spacing with top, right, bottom, left
- **`_background`** — color, image, gradient, overlay
- **`_width`** / **`_heightMin`** — sizing constraints
- **`_display`**, **`_flexWrap`**, **`_alignItems`**, **`_justifyContent`** — layout

Responsive overrides use a `:breakpoint` suffix on the key (e.g., `_alignItems:mobile_landscape`).

## Global classes in templates

Templates carry their own class definitions so they work on any site without needing the classes to already exist.

### How it works

In the Frames export format, the `globalClasses` array maps opaque IDs to human-readable names and includes the CSS settings:

```json
{
  "globalClasses": [
    {
      "id": "olpivm",
      "name": "hero-cali",
      "settings": {
        "_heightMin": "90vh",
        "_justifyContent": "flex-end",
        "_overflow": "clip"
      }
    },
    {
      "id": "btn--primary",
      "name": "btn--primary",
      "settings": [],
      "_mappedId": "acss_import_btn--primary"
    }
  ]
}
```

When an element has `"_cssGlobalClasses": ["olpivm"]`, Bricks looks up ID `olpivm` in the global classes list, finds `hero-cali`, and applies its settings.

Some classes have a `_mappedId` starting with `acss_import_`. This means the class is an ACSS utility — the settings are defined by Automatic.css, not by the template. The template just references it.

## CSS class naming: ACSS vs BEM

Templates use two kinds of CSS classes. Understanding the difference matters when creating templates or writing HTML for conversion.

### ACSS utility classes

Automatic.css provides a library of utility classes that follow a **double-hyphen modifier** pattern:

```
section--l          section with large padding
section--xl         section with extra-large padding
bg--primary-dark    primary dark background color
bg--ultra-dark      ultra dark background
text--l             large text size
text--primary       primary text color
btn--primary        primary button style
btn--outline        outline button style
grid--auto-3        3-column auto grid
gap--m              medium gap
fw--700             font-weight 700
is-bg               background container marker
```

In the class registry, ACSS classes have IDs prefixed with `acss_import_`:

```
name: "btn--primary"  →  id: "acss_import_btn--primary"
name: "text--l"       →  id: "acss_import_text--l"
name: "bg--ultra-dark" → id: "acss_import_bg--ultra-dark"
```

ACSS classes have no custom settings in the template — they're defined globally by the Automatic.css framework.

### Custom BEM classes

Component-specific classes follow **BEM naming** (`block__element--modifier`):

```
hero-cali                  block: the hero section itself
hero-cali__heading         element: the heading inside hero-cali
hero-cali__bg-wrapper      element: background wrapper
hero-cali__bg              element: background container
hero-cali__bg-image        element: individual background image
hero-cali__looper          element: the image looper

intro-foxtrot              block: the intro layout
intro-foxtrot__heading     element: heading in that layout
intro-foxtrot__lede        element: lede paragraph
intro-foxtrot__accent-heading  element: accent heading
```

BEM classes carry their own CSS settings in the template's `globalClasses` array. They define component-specific styles like widths, custom CSS, responsive overrides, etc.

Frames also uses `fr-` prefixed utility classes for shared component patterns:

```
fr-accent-heading    shared accent heading style
fr-lede              shared lede paragraph style
fr-note              shared note/callout style
fr-cta-links-bravo   CTA link group layout
```

### When to use which

| Use case | Class type | Example |
|----------|-----------|---------|
| Spacing, padding, margins | ACSS | `section--l`, `gap--m` |
| Colors, backgrounds | ACSS | `bg--primary-dark`, `text--white` |
| Typography sizes | ACSS | `text--l`, `text--s` |
| Button styles | ACSS | `btn--primary`, `btn--outline` |
| Grid layouts | ACSS | `grid--auto-3`, `grid--auto-2` |
| Component-specific structure | BEM | `hero-cali__heading` |
| Component-specific CSS | BEM | `hero-cali__bg-wrapper` |
| Shared Frames patterns | `fr-` prefix | `fr-lede`, `fr-accent-heading` |

### How the converter resolves classes

When you write HTML with CSS class names and run `bricks convert html`, the converter looks up each class name in the site's class registry:

1. **Matched** → the class is in the registry. Its ID goes into `_cssGlobalClasses`.
2. **Unmatched** → the class is not in the registry. The name goes into `_cssClasses` as a plain CSS class.

The registry is built from your site's actual global classes (fetched from the API). ACSS utilities and Frames components both appear in the registry.

## Creating templates

### From existing pages

Pull the sections from a live page and save them as templates:

```bash
bricks templates learn <page-id>
```

This connects to your site, pulls all elements from the page, splits them by top-level `<section>` elements, and saves each section as a separate template. Templates are named `page-<id>-<section-label>` and stored in your local template directory.

### From Frames exports

If you have Frames template JSON files (the format with `bricksExport` wrapper), just import them:

```bash
bricks templates import ./frames-templates/       # import a directory
bricks templates import hero-cali.json             # import a single file
```

The CLI auto-detects the Frames format and extracts elements and classes from the `bricksExport` wrapper.

### From AI generation

Generate a section with AI, save the output, then import it:

```bash
bricks generate section "dark hero with CTA buttons" --page 1460
```

Or generate to a file and import:

```bash
bricks generate section "dark hero with gradient" -o hero.json
bricks templates import hero.json
```

### By hand

Create a JSON file following the standard format:

```json
{
  "name": "simple-cta",
  "description": "Simple call-to-action section",
  "category": "cta",
  "tags": ["cta", "simple"],
  "elements": [
    {
      "id": "a00001",
      "name": "section",
      "parent": 0,
      "children": ["a00002"],
      "settings": {
        "_cssGlobalClasses": ["acss_import_section--l", "acss_import_bg--primary-dark"]
      },
      "label": "CTA Section"
    },
    {
      "id": "a00002",
      "name": "container",
      "parent": "a00001",
      "children": ["a00003", "a00004"],
      "settings": {}
    },
    {
      "id": "a00003",
      "name": "heading",
      "parent": "a00002",
      "children": [],
      "settings": {
        "text": "Ready to get started?",
        "tag": "h2"
      }
    },
    {
      "id": "a00004",
      "name": "button",
      "parent": "a00002",
      "children": [],
      "settings": {
        "text": "Get Started",
        "_cssGlobalClasses": ["acss_import_btn--primary"],
        "link": { "type": "external", "url": "#" }
      }
    }
  ]
}
```

Save it as `simple-cta.json` and import:

```bash
bricks templates import simple-cta.json
```

## Using templates

### List, search, show

```bash
bricks templates list                               # list all templates
bricks templates show hero-cali                      # show details for one template
bricks templates search "dark hero"                  # search by name, description, tags, category
```

### Compose into pages

Combine multiple templates into a single page:

```bash
# Compose and output to file
bricks compose hero-cali feature-havana footer-amsterdam -o page.json

# Compose and push directly to a page
bricks compose hero-cali feature-havana footer-amsterdam --push <page-id>
```

Templates are assembled in the order you specify. The first template's section appears at the top of the page, the last at the bottom.

### How composition works

When you compose multiple templates, the composer:

1. **Remaps element IDs** — each template gets new unique 6-character hex IDs so there are no collisions between templates that might share IDs.

2. **Updates parent/child references** — all `parent` and `children` fields are updated to use the new IDs, preserving the element tree structure.

3. **Merges global classes** — classes from all templates are combined into a single list, deduplicated by name. If two templates use the same class (e.g., `btn--primary`), only one copy is kept.

4. **Preserves section order** — elements are appended in template order, so your page reads top to bottom: hero, then features, then footer.

## Storage

Templates live in your local config directory:

```
~/.agent-to-bricks/templates/
```

Files are named by sanitizing the template name (lowercase, spaces to hyphens, alphanumeric only):

```
~/.agent-to-bricks/templates/hero-cali.json
~/.agent-to-bricks/templates/feature-section-havana.json
~/.agent-to-bricks/templates/footer-amsterdam.json
```

The catalog loader walks this directory recursively, so you can organize templates into subdirectories by category:

```
~/.agent-to-bricks/templates/
  hero/
    hero-cali.json
    hero-atlanta.json
  feature-section/
    feature-section-havana.json
    feature-section-iceland.json
  footer/
    footer-amsterdam.json
```

Both flat and nested layouts work. Template names come from the JSON content, not the file path. The category is derived from the parent directory name when loading Frames-format templates.

## For LLM agents

If you're an AI agent working with this tool, here's how to use templates effectively.

### Discover available templates

```bash
bricks templates list                    # see what's available
bricks templates search "hero"           # find hero templates
bricks templates show hero-cali          # get details and element count
```

### Use templates as context

Pull a template's JSON to understand the structure of a well-built section:

```bash
bricks templates show hero-cali          # overview
```

Study the element hierarchy, class usage, and settings patterns. This is a good way to learn what "good" Bricks JSON looks like before generating your own.

### Build pages from templates

The fastest way to build a complete page without AI generation:

```bash
# Find the sections you need
bricks templates search "hero"
bricks templates search "feature"
bricks templates search "footer"

# Compose them into a page
bricks compose hero-cali feature-section-havana footer-amsterdam --push <page-id>
```

### Generate new templates

If no existing template fits, generate one:

```bash
bricks generate section "testimonial grid with star ratings" --page <page-id>
```

Or generate HTML using the site's design tokens and convert it:

```bash
# Get the site's design context first
bricks agent context --format prompt

# Write HTML using the site's classes, then convert and push
echo '<section class="section--l bg--ultra-dark">
  <div class="container">
    <h2 class="text--white">What people say</h2>
  </div>
</section>' | bricks convert html --stdin --push <page-id> --snapshot
```

### Learn from existing pages

If a site already has well-designed pages, learn from them:

```bash
bricks templates learn <page-id>
```

This saves each section as a template you can reuse or compose later.
