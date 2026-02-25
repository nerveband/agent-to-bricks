# Feature Parity: Search, Components, Element Types, PHP 8.0

**Date:** 2026-02-24
**Status:** Approved

## Goal

Add three new plugin endpoints and corresponding CLI commands to reach feature parity with competing Bricks tooling. Bump PHP requirement to 8.0. Prepare for public distribution.

## Constraints

- CLI-only architecture (no MCP transport)
- PHP 8.0+ (bumped from 7.4)
- WordPress 6.0+ (unchanged)
- Red/green TDD
- Test on ts-staging.wavedepth.com

---

## Feature 1: Cross-Site Element Search

### Plugin: `class-search-api.php`

**Endpoint:** `GET /agent-bricks/v1/search/elements`

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `element_type` | string | — | Filter by element name (heading, button, etc.) |
| `setting_key` | string | — | Filter by setting key (tag, text, etc.) |
| `setting_value` | string | — | Substring match on setting value |
| `global_class` | string | — | Filter by global class ID or name |
| `post_type` | string | all | Filter by post type |
| `per_page` | int | 50 | Results per page (max 100) |
| `page` | int | 1 | Pagination |

**Response:**

```json
{
  "results": [
    {
      "postId": 42,
      "postTitle": "Homepage",
      "postType": "page",
      "elementId": "abc123",
      "elementType": "heading",
      "elementLabel": "Hero Title",
      "settings": { "text": "Welcome", "tag": "h1" },
      "parentId": "def456"
    }
  ],
  "total": 15,
  "page": 1,
  "perPage": 50,
  "totalPages": 1
}
```

**Implementation:** WP_Query for all posts with Bricks content meta -> iterate elements -> filter by params -> paginate.

### CLI: `bricks search elements`

**Flags:** `--type`, `--setting key=value`, `--class`, `--post-type`, `--json`, `--limit`

**Client:** `SearchElements(params) (*SearchResponse, error)`

---

## Feature 2: Components Endpoint

### Plugin: `class-components-api.php`

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/components` | GET | List reusable components (section-type templates) |
| `/components/{id}` | GET | Single component with element tree |

**List response:**

```json
{
  "components": [
    {
      "id": 89,
      "title": "Hero Block",
      "type": "section",
      "status": "publish",
      "elementCount": 5,
      "modified": "2024-01-15 10:30:00"
    }
  ],
  "count": 3,
  "total": 3
}
```

**Single response:** Same as templates single, includes `elements`, `contentHash`.

**Implementation:** Query `bricks_template` posts where `_bricks_template_type = 'section'`.

### CLI: `bricks components list` / `bricks components show <id>`

**Flags:** `--json`

**Client:** `ListComponents()`, `GetComponent(id)`

---

## Feature 3: Rich Element Type Metadata

### Plugin: Enhancement to `class-site-api.php`

**New endpoint:** `GET /site/element-types`

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `include_controls` | bool | false | Include full controls schema |
| `category` | string | — | Filter by element category |

**Response (without controls):**

```json
{
  "elementTypes": [
    {
      "name": "heading",
      "label": "Heading",
      "category": "basic",
      "icon": "ti-text"
    }
  ],
  "count": 45
}
```

**Response (with include_controls=true):**

```json
{
  "elementTypes": [
    {
      "name": "heading",
      "label": "Heading",
      "category": "basic",
      "controls": {
        "content": {
          "text": { "type": "text", "label": "Text", "default": "Heading" },
          "tag": { "type": "select", "label": "Tag", "options": [...] }
        },
        "style": { ... }
      }
    }
  ]
}
```

**Implementation:** Reflect from `\Bricks\Elements::$elements` registry. Instantiate elements to get controls when requested.

### CLI: `bricks elements types [name]`

**Flags:** `--controls`, `--category`, `--json`

**Client:** `ListElementTypes(includeControls, category)`

---

## Feature 4: PHP 8.0 Bump

- Plugin header: `Requires PHP: 7.4` -> `Requires PHP: 8.0`
- New files: use `match()`, `str_contains()`, `str_starts_with()`, union types
- Existing files: fix `strpos()` footguns where used for boolean checks
- No sweeping refactor of working code

---

## Files Changed/Created

### Plugin (new files)
- `includes/class-search-api.php`
- `includes/class-components-api.php`

### Plugin (modified files)
- `agent-to-bricks.php` (require new files, init new classes, bump PHP header)
- `includes/class-site-api.php` (add element-types endpoint)

### CLI (new files)
- `cmd/search.go`
- `cmd/components.go`
- `cmd/elements.go`

### CLI (modified files)
- `internal/client/client.go` (add new API methods)

### Tests
- Plugin: new test files for each endpoint
- CLI: new test files for each client method and command
