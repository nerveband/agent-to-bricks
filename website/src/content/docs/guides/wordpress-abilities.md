---
title: WordPress Abilities API
description: How Agent to Bricks integrates with the WordPress Abilities API to make your site discoverable by any AI agent.
---

Starting with WordPress 6.9, the [Abilities API](https://developer.wordpress.org/apis/abilities-api/) provides a standardized way for plugins to register machine-readable capabilities. Agent to Bricks registers all its operations as abilities, making your Bricks site discoverable by any AI tool that speaks the Abilities protocol.

This means Claude, ChatGPT, Codex, and any custom agent can discover what your site can do — not just through Agent to Bricks, but through every plugin that supports abilities.

## What gets registered

When your site runs WordPress 6.9+ with Agent to Bricks, these abilities become available:

| Category | Abilities | Description |
|----------|-----------|-------------|
| `agent-bricks-site` | `get-site-info`, `get-site-features`, `get-frameworks`, `list-element-types`, `list-query-element-types`, `list-pages` | Site configuration, discovery metadata, and query-capable element types |
| `agent-bricks-commerce` | `get-woocommerce-status`, `list-products`, `list-product-categories`, `list-product-tags` | WooCommerce discovery and catalog metadata |
| `agent-bricks-pages` | `get-page-elements`, `replace-page-elements`, `append-page-elements`, `patch-page-elements`, `delete-page-elements`, `search-elements` | Read and write Bricks page content |
| `agent-bricks-pages` | `list-snapshots`, `create-snapshot`, `rollback-snapshot` | Version control for page content |
| `agent-bricks-design` | `list-classes`, `create-class`, `delete-class`, `get-styles`, `get-variables` | Design system access |
| `agent-bricks-content` | `list-templates`, `list-components`, `get-component`, `upload-media` | Content and media management |

Each ability includes JSON schemas for inputs and outputs, behavioral annotations (readonly, destructive, idempotent), and permission checks.

## Discovering abilities from the CLI

List all abilities registered on your site:

```bash
bricks abilities list
```

```
ABILITY                                LABEL                    MODE

[agent-bricks-design]
agent-bricks/list-classes              List Global Classes      readonly
agent-bricks/create-class              Create Global Class      read/write
agent-bricks/get-styles                Get Theme Styles         readonly
agent-bricks/get-variables             Get CSS Variables        readonly

[agent-bricks-pages]
agent-bricks/get-page-elements         Get Page Elements        readonly
agent-bricks/replace-page-elements     Replace Page Elements    destructive
agent-bricks/append-page-elements      Append Page Elements     read/write
...

[seo]
yoast/get-seo-meta                     Get SEO Meta             readonly
yoast/set-seo-meta                     Set SEO Meta             read/write
```

Notice the last category — that's from Yoast SEO, not Agent to Bricks. The CLI discovers abilities from **all** plugins.

Filter by category:

```bash
bricks abilities list --category agent-bricks-pages
```

Get full details and schemas for a specific ability:

```bash
bricks abilities describe agent-bricks/get-page-elements
```

```
Name:        agent-bricks/get-page-elements
Label:       Get Page Elements
Description: Retrieves all Bricks elements for a page.
Category:    agent-bricks-pages
Mode:        readonly

Input Schema:
{
  "type": "object",
  "properties": {
    "page_id": { "type": "integer" }
  },
  "required": ["page_id"]
}

Output Schema:
{
  "type": "object",
  "properties": {
    "elements": { "type": "array" },
    "contentHash": { "type": "string" },
    "count": { "type": "integer" }
  }
}

Execute: POST https://example.com/wp-json/wp-abilities/v1/agent-bricks/get-page-elements/run
```

## Including abilities in LLM context

Add the `--abilities` flag to include discovered abilities in the agent context:

```bash
bricks agent context --format prompt --abilities
```

This adds a "Site Abilities" section to the context output. The LLM sees abilities from all plugins — Agent to Bricks, Yoast, WooCommerce, Gravity Forms, or anything else that registers abilities. It can then mix and match:

- Build a Bricks page using ATB abilities
- Discover query-capable elements and existing product loops before editing
- Set SEO meta using Yoast abilities
- Create or inspect WooCommerce objects using WC or ATB commerce abilities

All from the same conversation.

For the JSON format:

```bash
bricks agent context --format json --abilities
```

Or just the abilities section:

```bash
bricks agent context --section abilities
```

## Calling abilities directly (HTTP)

Any tool that can make HTTP requests can execute abilities. The WordPress Abilities REST API lives at `/wp-json/wp-abilities/v1/`.

### Discover available abilities

```bash
curl -H "X-ATB-Key: YOUR_KEY" \
  https://example.com/wp-json/wp-abilities/v1/abilities
```

### Execute a readonly ability

```bash
curl -H "X-ATB-Key: YOUR_KEY" \
  "https://example.com/wp-json/wp-abilities/v1/agent-bricks/get-site-info/run"
```

### Execute a write ability

```bash
curl -X POST \
  -H "X-ATB-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"page_id": 42}}' \
  "https://example.com/wp-json/wp-abilities/v1/agent-bricks/get-page-elements/run"
```

### Execute abilities from other plugins

```bash
curl -X POST \
  -H "X-ATB-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"post_id": 42, "title": "My Page Title", "description": "A great page"}}' \
  "https://example.com/wp-json/wp-abilities/v1/yoast/set-seo-meta/run"
```

## Authentication

The Abilities API supports standard WordPress authentication methods:

- **X-ATB-Key header** — works with Agent to Bricks abilities (same key as the custom REST API)
- **WordPress Application Passwords** — works with all abilities from any plugin
- **Cookie authentication** — for same-origin browser requests

For the best experience across all plugins' abilities, consider setting up a [WordPress Application Password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/) alongside your ATB API key.

## Requirements

- WordPress 6.9 or later
- Agent to Bricks plugin v1.8.0+
- No additional configuration needed — abilities are registered automatically

On WordPress versions before 6.9, the abilities features are simply not available. The plugin's custom REST API (`/wp-json/agent-bricks/v1/`) continues to work on all supported WordPress versions.

## How it works

Agent to Bricks registers abilities using WordPress's [`wp_register_ability()`](https://developer.wordpress.org/reference/functions/wp_register_ability/) function. Each ability wraps an existing REST endpoint handler, so there's zero duplication — the same code handles both the custom REST API and the abilities interface.

The registration is conditional: if `wp_register_ability_category` doesn't exist (pre-6.9), the plugin skips abilities setup entirely.

## Related

- [Bring your own agent](/guides/bring-your-own-agent/) — How to connect any AI tool to your Bricks site
- [REST API reference](/plugin/rest-api/) — The custom ATB REST API (works on all WP versions)
- [Agent commands](/cli/agent-commands/) — The `bricks agent context` command
- [WordPress Abilities API documentation](https://developer.wordpress.org/apis/abilities-api/) — Official WordPress developer docs
- [Abilities REST endpoints](https://developer.wordpress.org/apis/abilities-api/rest-api-endpoints/) — Official REST reference
