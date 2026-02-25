---
title: REST API
description: Every endpoint in the Agent to Bricks plugin API, with methods, parameters, and example requests
---

The plugin registers all routes under `/wp-json/agent-bricks/v1/`. Every request must include the `X-ATB-Key` header (see [Authentication](/plugin/authentication/)).

Rate limit: 60 requests per minute per key.

## Site

### GET /site/info

Returns Bricks version, WordPress version, PHP version, plugin version, registered element types, and breakpoints.

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/site/info \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "bricksVersion": "1.11.1",
  "contentMetaKey": "_bricks_page_content_2",
  "elementTypes": ["section", "container", "heading", "text-basic", "image", "button"],
  "breakpoints": { "desktop": 1280, "tablet": 1024, "mobile": 768 },
  "pluginVersion": "1.2.0",
  "phpVersion": "8.2.27",
  "wpVersion": "6.7.2"
}
```

### GET /site/frameworks

Detects CSS frameworks installed on the site. Returns ACSS tokens, color palette, spacing scale, and typography settings when Automatic.css is active.

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/site/frameworks \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "frameworks": {
    "acss": {
      "name": "Automatic.css",
      "active": true,
      "version": "3.0",
      "classCount": 247,
      "colors": {
        "primary": "#2563eb",
        "secondary": "#7c3aed",
        "accent": "#f59e0b"
      },
      "spacing": {
        "scale": "1.5",
        "sectionPadding": "var(--section-space-m)"
      },
      "typography": {
        "rootFontSize": "62.5%",
        "textFontFamily": "Inter, sans-serif",
        "headingFontFamily": "Poppins, sans-serif"
      }
    }
  }
}
```

### GET /site/element-types

Returns all registered Bricks element types with labels, categories, and icons.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `include_controls` | boolean | Include control definitions for each element type |
| `category` | string | Filter by category (e.g., `general`, `media`, `layout`) |

```bash
curl -s "https://your-site.com/wp-json/agent-bricks/v1/site/element-types?category=general" \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "elementTypes": [
    { "name": "heading", "label": "Heading", "category": "general", "icon": "ti-text" },
    { "name": "text-basic", "label": "Basic Text", "category": "general", "icon": "ti-align-left" }
  ],
  "count": 2
}
```

---

## Pages / Elements

All element endpoints use optimistic locking. Write operations require an `If-Match` header containing the `contentHash` from your last GET. If someone else modified the page in between, you'll get a `409 Conflict` with the current hash so you can retry.

### GET /pages/{id}/elements

Fetches all elements on a page.

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/pages/42/elements \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "elements": [
    {
      "id": "abc123",
      "name": "section",
      "parent": 0,
      "children": ["def456"],
      "settings": {
        "_cssGlobalClasses": ["acss_import_section-l"],
        "tag": "section"
      }
    }
  ],
  "contentHash": "e3b0c44298fc1c14...",
  "count": 12,
  "metaKey": "_bricks_page_content_2"
}
```

### POST /pages/{id}/elements

Appends elements to a page. Optionally specify a parent or insertion point.

**Headers:** `If-Match: <contentHash>`

**Body:**

```json
{
  "elements": [
    {
      "id": "new001",
      "name": "heading",
      "parent": "abc123",
      "children": [],
      "settings": { "tag": "h2", "text": "Hello world" }
    }
  ],
  "parentId": "abc123",
  "insertAfter": "def456"
}
```

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/pages/42/elements \
  -H "X-ATB-Key: atb_abc123..." \
  -H "If-Match: e3b0c44298fc1c14..." \
  -H "Content-Type: application/json" \
  -d '{"elements": [{"id":"new001","name":"heading","parent":"abc123","children":[],"settings":{"tag":"h2","text":"Hello world"}}]}'
```

**Response (201):**

```json
{
  "success": true,
  "contentHash": "a1b2c3d4e5f6...",
  "added": ["new001"],
  "count": 13
}
```

### PUT /pages/{id}/elements

Full replacement of all page elements. The plugin auto-creates a snapshot before overwriting.

**Headers:** `If-Match: <contentHash>`

```bash
curl -X PUT https://your-site.com/wp-json/agent-bricks/v1/pages/42/elements \
  -H "X-ATB-Key: atb_abc123..." \
  -H "If-Match: e3b0c44298fc1c14..." \
  -H "Content-Type: application/json" \
  -d '{"elements": [...]}'
```

```json
{
  "success": true,
  "contentHash": "f6e5d4c3b2a1...",
  "count": 8
}
```

### PATCH /pages/{id}/elements

Delta-patch individual elements by ID. Settings are merged (not replaced) -- set a key to `null` to remove it.

**Headers:** `If-Match: <contentHash>`

**Body:**

```json
{
  "patches": [
    {
      "id": "abc123",
      "settings": {
        "text": "Updated heading text",
        "_margin": null
      }
    }
  ]
}
```

```json
{
  "success": true,
  "contentHash": "d4e5f6a1b2c3...",
  "patched": ["abc123"],
  "count": 1
}
```

### DELETE /pages/{id}/elements

Removes elements by ID. Also cleans up references in parent `children` arrays.

**Headers:** `If-Match: <contentHash>`

```bash
curl -X DELETE https://your-site.com/wp-json/agent-bricks/v1/pages/42/elements \
  -H "X-ATB-Key: atb_abc123..." \
  -H "If-Match: e3b0c44298fc1c14..." \
  -H "Content-Type: application/json" \
  -d '{"ids": ["abc123", "def456"]}'
```

```json
{
  "success": true,
  "contentHash": "b2c3d4e5f6a1...",
  "deleted": ["abc123", "def456"],
  "count": 10
}
```

### POST /pages/{id}/elements/batch

Execute multiple operations in a single atomic write. All operations apply to the same element array in sequence, then the result is saved once.

**Headers:** `If-Match: <contentHash>`

Supported operations: `append`, `patch`, `delete`.

```json
{
  "operations": [
    {
      "op": "delete",
      "ids": ["old001"]
    },
    {
      "op": "append",
      "elements": [
        { "id": "new001", "name": "heading", "parent": "abc123", "children": [], "settings": { "tag": "h2", "text": "New section" } }
      ]
    },
    {
      "op": "patch",
      "patches": [
        { "id": "abc123", "settings": { "text": "Updated text" } }
      ]
    }
  ]
}
```

```json
{
  "success": true,
  "contentHash": "c3d4e5f6a1b2...",
  "operations": [
    { "op": "delete", "deleted": 1 },
    { "op": "append", "added": 1 },
    { "op": "patch", "patched": 1 }
  ],
  "count": 12
}
```

---

## Snapshots

### GET /pages/{id}/snapshots

Lists all snapshots for a page (up to 10, FIFO). Does not include element data in the listing.

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/pages/42/snapshots \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "snapshots": [
    {
      "snapshotId": "snap_a1b2c3d4e5f6",
      "contentHash": "e3b0c44298fc1c14...",
      "elementCount": 12,
      "timestamp": "2026-02-25 14:30:00",
      "label": "Before hero redesign"
    }
  ]
}
```

### POST /pages/{id}/snapshots

Creates a snapshot of the page's current state.

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/pages/42/snapshots \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"label": "Before hero redesign"}'
```

```json
{
  "snapshotId": "snap_a1b2c3d4e5f6",
  "contentHash": "e3b0c44298fc1c14...",
  "elementCount": 12,
  "timestamp": "2026-02-25 14:30:00"
}
```

### POST /pages/{id}/snapshots/{snapshot_id}/rollback

Restores a page to a previous snapshot. Auto-creates a new snapshot of the current state before restoring, so you can always undo a rollback.

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/pages/42/snapshots/snap_a1b2c3d4e5f6/rollback \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "contentHash": "f6e5d4c3b2a1...",
  "count": 12,
  "restoredFrom": "snap_a1b2c3d4e5f6"
}
```

---

## Global classes

### GET /classes

Lists all global CSS classes. Optionally filter by framework.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `framework` | string | Filter by `acss` or `custom` |

```bash
curl -s "https://your-site.com/wp-json/agent-bricks/v1/classes?framework=acss" \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "classes": [
    {
      "id": "acss_import_section-l",
      "name": "section--l",
      "settings": {},
      "framework": "acss"
    }
  ],
  "count": 147,
  "total": 312
}
```

### POST /classes

Creates a new global class. Returns `409` if the name already exists.

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/classes \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"name": "card--featured", "label": "Featured card", "settings": {"_background": {"color": "var(--primary)"}}}'
```

### GET /classes/{id}

Returns a single class by ID.

### PATCH /classes/{id}

Updates a class. ACSS-imported classes cannot be modified (returns `403`).

### DELETE /classes/{id}

Deletes a class. ACSS-imported classes cannot be deleted (returns `403`).

---

## Templates

### GET /templates

Lists all Bricks templates.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by template type: `header`, `footer`, `section`, `content`, `archive` |

```bash
curl -s "https://your-site.com/wp-json/agent-bricks/v1/templates?type=section" \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "templates": [
    {
      "id": 105,
      "title": "Hero - Centered",
      "type": "section",
      "status": "publish",
      "elementCount": 8,
      "modified": "2026-02-20 09:15:00"
    }
  ],
  "count": 3
}
```

### POST /templates

Creates a new Bricks template from element JSON.

```json
{
  "title": "CTA - Two Column",
  "type": "section",
  "elements": [...],
  "status": "publish"
}
```

### GET /templates/{id}

Returns a template with its full element content and content hash.

### PATCH /templates/{id}

Updates a template's title, type, elements, or settings.

### DELETE /templates/{id}

Permanently deletes a template.

---

## Components

Components are section-type templates. The `/components` endpoints give a filtered view of templates where `_bricks_template_type` is `section`.

### GET /components

Lists all section components.

### GET /components/{id}

Returns a component with its elements and content hash. Returns `404` if the template exists but is not a section type.

---

## Search

### GET /search/elements

Searches elements across all pages, posts, and templates on the site.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `element_type` | string | Filter by element type (e.g., `heading`, `image`) |
| `setting_key` | string | Filter by settings key presence |
| `setting_value` | string | Filter by settings value (case-insensitive substring match) |
| `global_class` | string | Filter by global class name or ID |
| `post_type` | string | Filter by post type (`page`, `post`, `bricks_template`) |
| `per_page` | integer | Results per page (max 100, default 50) |
| `page` | integer | Page number (default 1) |

```bash
curl -s "https://your-site.com/wp-json/agent-bricks/v1/search/elements?element_type=heading&setting_value=pricing" \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "results": [
    {
      "postId": 42,
      "postTitle": "Pricing Page",
      "postType": "page",
      "elementId": "abc123",
      "elementType": "heading",
      "elementLabel": "",
      "settings": { "tag": "h2", "text": "Simple pricing for everyone" },
      "parentId": "xyz789"
    }
  ],
  "total": 3,
  "page": 1,
  "perPage": 50,
  "totalPages": 1
}
```

---

## Media

### GET /media

Lists media library items. Most recent first, 50 per request.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by filename or title |

```bash
curl -s "https://your-site.com/wp-json/agent-bricks/v1/media?search=hero" \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "media": [
    {
      "id": 201,
      "title": "hero-background",
      "url": "https://your-site.com/wp-content/uploads/2026/02/hero-background.webp",
      "mimeType": "image/webp",
      "date": "2026-02-15 10:00:00",
      "filesize": 142580
    }
  ],
  "count": 1
}
```

### POST /media/upload

Uploads a file to the WordPress media library. Send as multipart form data with a `file` field.

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/media/upload \
  -H "X-ATB-Key: atb_abc123..." \
  -F "file=@hero-image.webp"
```

```json
{
  "id": 202,
  "url": "https://your-site.com/wp-content/uploads/2026/02/hero-image.webp",
  "mimeType": "image/webp",
  "filename": "hero-image.webp",
  "filesize": 98432
}
```

---

## Styles

### GET /styles

Returns Bricks theme styles, color palette, and global settings.

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/styles \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "themeStyles": [
    {
      "key": "default",
      "label": "Default",
      "settings": {
        "typography": { "font-family": "Inter, sans-serif" },
        "colors": { "heading": "#1a1a2e", "text": "#4a4a68" }
      }
    }
  ],
  "colorPalette": [
    { "id": "cp1", "color": { "hex": "#2563eb" }, "name": "Primary" }
  ],
  "globalSettings": {}
}
```

### GET /variables

Returns CSS custom properties defined in Bricks, plus any variables extracted from theme style custom CSS blocks.

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/variables \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "variables": [],
  "extractedFromCSS": [
    { "name": "--card-radius", "value": "8px", "source": "default" },
    { "name": "--section-max-width", "value": "1200px", "source": "default" }
  ]
}
```

---

## AI

### POST /generate

Generates new Bricks elements from a text prompt using the configured LLM provider.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | yes | What to generate |
| `postId` | integer | yes | Target page ID (for context) |
| `mode` | string | no | `section` (default) or `page` |
| `context` | object | no | Extra context to include in the system prompt |
| `model` | string | no | Override the default model |

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/generate \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a hero section with a headline, subtext, and two CTA buttons",
    "postId": 42,
    "mode": "section"
  }'
```

```json
{
  "success": true,
  "elements": [...],
  "explanation": "Created a centered hero with gradient background...",
  "warnings": [],
  "provider": "Cerebras",
  "model": "llama-4-scout-17b-16e-instruct",
  "tokens_used": { "prompt_tokens": 2400, "completion_tokens": 890 }
}
```

Validation errors return `422`:

```json
{
  "success": false,
  "error": "Generated elements failed validation.",
  "details": ["elements[0]: Missing or invalid 'name' field."],
  "warnings": [],
  "raw": {}
}
```

### POST /modify

Modifies existing elements based on a prompt. Pass the current element data so the LLM knows what to change.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | yes | What to change |
| `postId` | integer | yes | Page ID |
| `currentElement` | object | yes | The element(s) to modify |
| `model` | string | no | Override the default model |

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/modify \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Change the heading to use the accent color and increase font size to 3xl",
    "postId": 42,
    "currentElement": {
      "id": "abc123",
      "name": "heading",
      "settings": { "tag": "h2", "text": "Welcome" }
    }
  }'
```

### GET /providers

Lists available LLM providers and their models. Does not expose API keys.

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/providers \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "providers": {
    "cerebras": {
      "name": "Cerebras",
      "models": ["llama-4-scout-17b-16e-instruct"],
      "default": "llama-4-scout-17b-16e-instruct",
      "active": true,
      "has_key": true
    },
    "openai": {
      "name": "OpenAI",
      "models": ["gpt-4o", "gpt-4o-mini"],
      "default": "gpt-4o",
      "active": false,
      "has_key": false
    }
  },
  "activeProvider": "cerebras",
  "activeModel": "llama-4-scout-17b-16e-instruct"
}
```

---

## Error responses

All errors follow the same shape:

```json
{
  "error": "Human-readable error message.",
  "code": "optional_error_code"
}
```

Common status codes:

| Code | Meaning |
|------|---------|
| 400 | Bad request (missing fields, invalid data) |
| 401 | Invalid or missing API key |
| 403 | Forbidden (e.g., trying to modify an ACSS class) |
| 404 | Resource not found |
| 409 | Conflict (contentHash mismatch -- someone else wrote first) |
| 422 | Validation failed (AI-generated elements were invalid) |
| 428 | If-Match header required but missing |
| 429 | Rate limit exceeded |
| 502 | LLM provider returned an error |
