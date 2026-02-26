---
title: Global classes
description: How Bricks global classes work, how the plugin manages them, and how ACSS utility classes get registered
---

Bricks Builder has a site-wide registry of CSS classes stored in the `bricks_global_classes` wp_option. These are different from regular CSS classes. They get an ID, they're managed through the Bricks UI, and elements reference them by ID rather than by name.

The plugin exposes this registry through the REST API and handles the mapping between class names (what you write in HTML) and class IDs (what Bricks stores in element settings).

## How classes are stored

Each global class is an entry in the `bricks_global_classes` option array:

```json
{
  "id": "abcdef",
  "name": "card--featured",
  "settings": {
    "_background": { "color": "var(--primary)" },
    "_padding": { "top": "2rem", "right": "2rem", "bottom": "2rem", "left": "2rem" },
    "_border": { "radius": "8px" }
  },
  "label": "Featured card style",
  "modified": 1708891200,
  "user_id": 1
}
```

The `id` is a 6-character alphanumeric string that Bricks generates. When an element uses this class, its `settings._cssGlobalClasses` array contains `"abcdef"` (the ID, not the name `"card--featured"`).

## ACSS classes

If your site uses Automatic.css, those utility classes are imported into the Bricks global class registry with an `acss_import_` prefix on the ID. A class named `section--l` gets the ID `acss_import_section-l`.

The plugin detects ACSS classes by checking for this prefix. It tags them with `"framework": "acss"` in API responses:

```json
{
  "id": "acss_import_section-l",
  "name": "section--l",
  "settings": {},
  "framework": "acss"
}
```

ACSS classes are read-only through the API. Trying to update or delete one returns `403 Forbidden`. These classes are managed by ACSS itself, and editing them through the plugin would cause conflicts.

## Listing classes

```bash
# All classes
bricks classes list

# Just ACSS classes
bricks classes list --framework acss

# Just custom (non-ACSS) classes
bricks classes list --framework custom
```

Via the API:

```bash
curl -s "https://your-site.com/wp-json/agent-bricks/v1/classes?framework=acss" \
  -H "X-ATB-Key: atb_abc123..."
```

The response includes counts:

```json
{
  "classes": [...],
  "count": 147,
  "total": 312
}
```

`count` is how many matched the filter. `total` is the full number of classes registered on the site.

## Finding a class by name

The search endpoint lets you find elements using a specific class across your entire site:

```bash
bricks search elements --global-class "section--l"
```

This searches all pages, posts, and templates for elements that have the class in their `_cssGlobalClasses` array. The API resolves the class name to its ID automatically, so you can search by name even though elements store IDs.

## Creating classes

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/classes \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "testimonial-card",
    "label": "Testimonial card",
    "settings": {
      "_background": { "color": "var(--neutral-ultra-light)" },
      "_padding": { "top": "var(--space-l)", "right": "var(--space-l)", "bottom": "var(--space-l)", "left": "var(--space-l)" },
      "_border": { "radius": "var(--radius-m)" }
    }
  }'
```

If a class with that name already exists, you'll get a `409 Conflict` with the existing class ID, so you can use it instead of creating a duplicate.

## Updating and deleting classes

PATCH updates specific fields. DELETE removes the class permanently.

```bash
# Update
curl -X PATCH https://your-site.com/wp-json/agent-bricks/v1/classes/abcdef \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"settings": {"_background": {"color": "var(--accent)"}}}'

# Delete
curl -X DELETE https://your-site.com/wp-json/agent-bricks/v1/classes/abcdef \
  -H "X-ATB-Key: atb_abc123..."
```

Both operations are blocked for ACSS-imported classes. You'll get `403 Forbidden` with the message "Cannot modify ACSS-imported class."

## Class resolution in the HTML converter

When the CLI converts HTML to Bricks elements, it encounters class names in the markup:

```html
<section class="section--l bg--primary-dark">
  <div class="container">
    <h2 class="text--xl text--white">Hello</h2>
  </div>
</section>
```

The converter fetches the global class registry, builds a name-to-ID lookup table, and resolves each class name to its Bricks ID. The output element for the `h2` ends up with:

```json
{
  "name": "heading",
  "settings": {
    "tag": "h2",
    "text": "Hello",
    "_cssGlobalClasses": ["acss_import_text-xl", "acss_import_text-white"]
  }
}
```

Classes that don't exist in the global registry go into the `_cssClasses` field as a plain string. The CLI warns you about unresolved classes so you know which ones need to be created or were misspelled.

## Framework detection

The plugin auto-detects installed CSS frameworks by scanning active plugins. When it finds ACSS, it reads the ACSS settings to report:

- How many ACSS classes are in the global registry
- Color token values (primary, secondary, accent, base, neutral)
- Spacing scale and section padding defaults
- Typography settings (root font size, text and heading font families)

This information feeds into the agent context system so AI tools know what design tokens your site offers.

```bash
bricks site frameworks
```

```json
{
  "frameworks": {
    "acss": {
      "name": "Automatic.css",
      "active": true,
      "classCount": 247,
      "colors": {
        "primary": "#2563eb",
        "secondary": "#7c3aed"
      }
    }
  }
}
```
