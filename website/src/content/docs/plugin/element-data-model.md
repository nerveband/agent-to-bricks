---
title: Element data model
description: How Bricks stores page content as a flat JSON array of elements with parent/child references and settings
---

Bricks Builder stores page content as a flat JSON array in post meta (key: `_bricks_page_content_2`). Each entry in the array is an element. Elements reference each other through parent IDs and children arrays, forming a tree structure in a flat list.

Understanding this structure is important if you're building elements directly through the API, writing custom converters, or debugging unexpected output from AI generation.

## Element structure

Every element has these fields:

```json
{
  "id": "abc123",
  "name": "heading",
  "parent": "xyz789",
  "children": [],
  "settings": {
    "tag": "h2",
    "text": "About our company",
    "_cssGlobalClasses": ["acss_import_text-l", "acss_import_clr-primary"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier. Bricks uses 6-character lowercase strings (e.g., `abc123`). Must be unique within the page. |
| `name` | string | Element type. Must be a registered type: `section`, `container`, `heading`, `text-basic`, `image`, `button`, etc. |
| `parent` | string or 0 | ID of the parent element. Top-level elements use `0` as the parent. |
| `children` | array | IDs of child elements, in order. Empty array for leaf elements. |
| `settings` | object | All configuration: text content, HTML tag, CSS classes, spacing, typography, background, links, images, and more. |

There's also an optional `label` field for a human-readable name shown in the Bricks structure panel.

## The settings object

Settings hold everything about an element's appearance and content. A few key properties:

### Content

| Key | Type | Description |
|-----|------|-------------|
| `text` | string | Text content (supports HTML for rich-text elements) |
| `tag` | string | HTML tag: `h1`-`h6`, `p`, `div`, `span`, `section`, `article`, etc. |
| `link` | object | `{ "type": "external", "url": "https://...", "newTab": true }` |
| `image` | object | `{ "url": "https://...", "id": 201 }` (references media library) |

### CSS classes

| Key | Type | Description |
|-----|------|-------------|
| `_cssGlobalClasses` | array | Global class IDs (not names). These reference the Bricks global class registry. |
| `_cssClasses` | string | Inline CSS class string (custom classes not in the registry) |

The distinction matters. When you see `"_cssGlobalClasses": ["acss_import_section-l"]`, that's a reference to a global class with ID `acss_import_section-l`. The CLI's HTML converter handles this mapping automatically when it resolves class names to IDs.

### Spacing and layout

| Key | Type | Description |
|-----|------|-------------|
| `_padding` | object | `{ "top": "20px", "right": "30px", "bottom": "20px", "left": "30px" }` |
| `_margin` | object | Same shape as padding |
| `_typography` | object | `{ "font-size": "1.5rem", "font-weight": "700", "line-height": "1.4" }` |
| `_background` | object | `{ "color": "var(--primary)", "image": { "url": "..." } }` |

Most layout properties accept CSS values directly, including CSS custom properties like `var(--space-m)`.

## A complete page example

Here's a minimal page with a section containing a heading and paragraph:

```json
[
  {
    "id": "sect01",
    "name": "section",
    "parent": 0,
    "children": ["cont01"],
    "settings": {
      "tag": "section",
      "_cssGlobalClasses": ["acss_import_section-l"]
    }
  },
  {
    "id": "cont01",
    "name": "container",
    "parent": "sect01",
    "children": ["head01", "text01"],
    "settings": {
      "_cssGlobalClasses": ["acss_import_container"]
    }
  },
  {
    "id": "head01",
    "name": "heading",
    "parent": "cont01",
    "children": [],
    "settings": {
      "tag": "h1",
      "text": "Welcome to our site",
      "_cssGlobalClasses": ["acss_import_text-xl"]
    }
  },
  {
    "id": "text01",
    "name": "text-basic",
    "parent": "cont01",
    "children": [],
    "settings": {
      "tag": "p",
      "text": "We build things people actually want to use."
    }
  }
]
```

Notice that the array is flat. `sect01` is the root (parent `0`), `cont01` is inside it, and `head01` and `text01` are inside the container. The parent/child references create the tree.

## Parent/child integrity

The plugin validates these rules:

- **No orphans.** Every element with a parent ID must have that parent actually exist in the array.
- **No circular references.** An element can't be its own ancestor.
- **No duplicate IDs.** Every `id` must be unique within the page.
- **Children match parents.** If element A lists B in its `children` array, B's `parent` should be A.

The `bricks validate` command checks all of these locally before you push.

## Content hash (optimistic locking)

Every time you GET a page's elements, the response includes a `contentHash`. This is an MD5 hash of the serialized element data.

When you write elements back (POST, PUT, PATCH, DELETE), you must send this hash in the `If-Match` header:

```
If-Match: e3b0c44298fc1c14...
```

If someone else modified the page between your read and your write, the hash won't match, and the plugin returns `409 Conflict` with the current hash. This prevents two editors (or an editor and an AI agent) from overwriting each other's changes.

The CLI handles this automatically. It reads the page, gets the hash, and includes it in write requests.

## Registered element types

The valid element type names come from Bricks Builder's element registry. Common types:

**Layout:** `section`, `container`, `block`, `div`

**Text:** `heading`, `text-basic`, `rich-text`, `text-link`

**Interactive:** `button`, `icon`, `image`, `video`

**Navigation:** `nav-menu`, `nav-nested`, `offcanvas`

**Dynamic:** `accordion`, `accordion-nested`, `tabs`, `tabs-nested`, `slider`, `slider-nested`, `carousel`

**Forms and data:** `form`, `map`, `code`, `template`, `post-content`, `posts`, `pagination`

Custom elements registered by third-party plugins are also valid. The validator will warn about unknown types but won't reject them, since your site might have custom elements it doesn't know about.

You can fetch the full list from your site with:

```bash
bricks site element-types
```

Or via the API:

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/site/element-types \
  -H "X-ATB-Key: atb_abc123..."
```

## Settings sanitization

The plugin sanitizes all settings before saving:

- `text` content goes through `wp_kses_post` (allows safe HTML)
- `tag` values are sanitized as plain text
- `link.url` values go through `esc_url_raw`
- `_cssGlobalClasses` must be an array of strings
- Nested objects are sanitized recursively
- Unknown setting keys are allowed but sanitized based on their type (string, number, boolean, or array)

This means AI-generated elements that include script tags or event handlers in text content will have those stripped out.
