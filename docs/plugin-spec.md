# WordPress Plugin Spec — Bricks AI Savior

> Version: 0.1.0 | Date: 2026-02-15

---

## Overview

Server-side validation gate and persistence layer for AI-driven Bricks Builder modifications. Handles schema validation, snapshot/rollback, API key management, and secure commit of element changes.

---

## REST Endpoints

All endpoints require `manage_options` capability and valid nonce.

### `POST /wp-json/bricks-ai/v1/validate`

Validates an element patch against the canonical schema without committing.

**Request:**
```json
{
  "postId": 1297,
  "patch": {
    "meta": { "version": "1.0", "source": "ai-extension", "timestamp": 1771205000 },
    "patchMode": "insert",
    "targetParent": "97a22e",
    "targetIndex": 0,
    "nodes": [
      {
        "name": "heading",
        "label": "New Heading",
        "settings": { "text": "Hello World", "tag": "h2" },
        "children": []
      }
    ]
  }
}
```

**Response (valid):**
```json
{
  "valid": true,
  "warnings": [],
  "resolvedNodes": [
    {
      "id": "generated_abc123",
      "name": "heading",
      "label": "New Heading",
      "parent": "97a22e",
      "children": [],
      "settings": { "text": "Hello World", "tag": "h2" }
    }
  ]
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "errors": [
    { "code": "INVALID_PARENT", "message": "Parent element 'xyz' not found in post 1297" },
    { "code": "MISSING_FIELD", "message": "Node 0: 'name' is required" }
  ]
}
```

### `POST /wp-json/bricks-ai/v1/commit`

Validates and commits an element patch. Creates snapshot before writing.

**Request:** Same as `/validate` plus:
```json
{
  "postId": 1297,
  "patch": { ... },
  "snapshotReason": "AI: Added hero section heading"
}
```

**Response:**
```json
{
  "success": true,
  "snapshotId": "snap_1771205001",
  "elementsModified": 3,
  "newElementIds": ["abc123", "def456"],
  "postMetaKey": "_bricks_page_content_2"
}
```

**Flow:**
1. Validate patch schema
2. Load current `_bricks_page_content_2` post meta
3. Create snapshot (store current state in `_bricks_ai_snapshots`)
4. Apply patch (insert/replace/append/delete)
5. Validate parent-child integrity
6. Remap class IDs if needed
7. Save to post meta
8. Return result

### `POST /wp-json/bricks-ai/v1/rollback`

Restores a previous snapshot.

**Request:**
```json
{
  "postId": 1297,
  "snapshotId": "snap_1771205001"
}
```

**Response:**
```json
{
  "success": true,
  "restoredElements": 744,
  "rolledBackFrom": "snap_1771205002"
}
```

### `GET /wp-json/bricks-ai/v1/snapshots`

Lists available snapshots for a post.

**Request:** `?postId=1297&limit=20`

**Response:**
```json
{
  "snapshots": [
    {
      "id": "snap_1771205001",
      "postId": 1297,
      "reason": "AI: Added hero section heading",
      "elementCount": 744,
      "timestamp": 1771205001,
      "user": "admin"
    }
  ]
}
```

### `POST /wp-json/bricks-ai/v1/transform`

Optional server-side LLM proxy (keeps API keys server-side).

**Request:**
```json
{
  "postId": 1297,
  "selectedElements": [ { "id": "705598", "name": "heading", ... } ],
  "instruction": "Make this heading larger and add a subtitle below it",
  "context": {
    "availableClasses": ["acss_import_h1", "acss_import_h2"],
    "colorPalette": [{ "name": "primary", "raw": "var(--primary)" }]
  }
}
```

**Response:**
```json
{
  "patch": {
    "patchMode": "replace",
    "nodes": [ ... ],
    "meta": { "version": "1.0", "source": "ai-transform", "model": "claude-sonnet-4-5-20250929" }
  },
  "explanation": "Increased heading to h1 with primary color, added h3 subtitle below"
}
```

### `GET /wp-json/bricks-ai/v1/elements`

Read current element tree for a post (for extension bootstrap/sync).

**Request:** `?postId=1297&subtree=97a22e`

**Response:**
```json
{
  "postId": 1297,
  "elements": [ ... ],
  "globalClasses": [ ... ],
  "classMap": { "alq0tl": "ui-heading-h1" }
}
```

---

## Authentication & Security

| Layer | Mechanism |
|-------|-----------|
| WordPress auth | Cookie-based session (same as builder) |
| Nonce verification | `wp_verify_nonce()` with `bricks-ai-savior` action |
| Capability check | `current_user_can('edit_post', $postId)` |
| Rate limiting | 60 requests/minute per user |
| Input validation | JSON schema validation before any write |
| API key storage | `wp_options` table, encrypted at rest |

---

## Data Storage

### Post Meta Keys

| Key | Purpose |
|-----|---------|
| `_bricks_page_content_2` | Bricks element data (existing, read/write) |
| `_bricks_page_header_2` | Header elements (existing) |
| `_bricks_page_footer_2` | Footer elements (existing) |
| `_bricks_ai_snapshots` | Snapshot history (new, our plugin) |
| `_bricks_ai_last_transform` | Last AI transform metadata (new) |

### Options Table

| Key | Purpose |
|-----|---------|
| `bricks_ai_api_key` | Encrypted LLM API key |
| `bricks_ai_settings` | Plugin configuration |
| `bricks_ai_class_map` | Global class name → ID mapping cache |

---

## Validation Rules

### Element Node
- `name` — required, must be registered Bricks element type
- `parent` — required, must exist in content tree (or `0` for root)
- `children` — required array, all referenced IDs must exist
- `settings` — required object (can be empty `{}` or `[]`)
- `id` — auto-generated if not provided; must be unique if provided

### Patch Modes
- `insert` — add nodes at targetParent/targetIndex
- `replace` — replace element(s) by ID, preserving parent/position
- `append` — add nodes after last child of targetParent
- `delete` — remove elements by ID (recursive children cleanup)

### Integrity Checks
- No orphaned elements (all parents exist)
- No circular references
- No duplicate IDs
- Parent's `children` array matches actual children
- All `_cssGlobalClasses` IDs exist in global classes registry
