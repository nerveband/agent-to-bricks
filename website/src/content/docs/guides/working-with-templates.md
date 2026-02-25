---
title: Working with templates
description: Using the template library to import, search, learn from existing pages, and compose templates into new pages
---

Templates are reusable chunks of Bricks elements. A hero section, a pricing table, a footer -- anything you've built once and want to use again. The CLI has a local template catalog and can also pull templates from your Bricks site.

## Template sources

Templates come from two places:

**Your Bricks site.** Any `bricks_template` post in WordPress shows up when you list or search templates via the API. These include templates you've created in the Bricks editor, imported from Bricks' remote templates, or saved from Frames.

**The local catalog.** The CLI maintains its own template library at `~/.agent-to-bricks/templates/`. You can import templates from files, learn them from existing pages, or save them from API responses.

## Listing templates

### From your site

```bash
bricks templates list
```

Filter by type:

```bash
bricks templates list --type section
bricks templates list --type header
bricks templates list --type footer
```

### Via the API

```bash
curl -s "https://your-site.com/wp-json/agent-bricks/v1/templates?type=section" \
  -H "X-ATB-Key: atb_abc123..."
```

Each template in the response includes its ID, title, type, element count, and last modified date. To get the full element data, fetch an individual template by ID.

## Getting a template's content

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/templates/105 \
  -H "X-ATB-Key: atb_abc123..."
```

This returns the template's full element array, content hash, and settings. You can use this to inspect how a template is built, copy its structure, or import it into the local catalog.

## Searching templates

Search by description or keywords:

```bash
bricks templates search "hero with centered text"
bricks templates search "pricing table"
bricks templates search "contact form"
```

The search looks at template names and metadata. If you have embeddings search enabled, it can also do semantic matching -- searching for "call to action" will find templates named "CTA Banner" even though the words don't match exactly.

## Learning from existing pages

You can turn any page on your site into a template:

```bash
bricks templates learn --page 42 --name "Homepage hero" --category "heroes"
```

This pulls the page's elements and saves them as a template in the local catalog. Useful when you've built something in the Bricks editor and want to reuse the structure later.

You can also learn specific sections from a page rather than the whole thing:

```bash
bricks templates learn --page 42 --element sect01 --name "Testimonial grid"
```

This pulls just the element tree rooted at `sect01` and its children.

## Importing templates

Import from a JSON file:

```bash
bricks templates import hero-section.json --name "Hero - Split layout"
```

The file should contain a Bricks element array (the same format you get from `GET /pages/{id}/elements`).

## Creating templates via the API

Push a template directly to your Bricks site:

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/templates \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "CTA - Two Column",
    "type": "section",
    "status": "publish",
    "elements": [
      {
        "id": "sect01",
        "name": "section",
        "parent": 0,
        "children": ["cont01"],
        "settings": { "tag": "section", "_cssGlobalClasses": ["acss_import_section-m"] }
      },
      {
        "id": "cont01",
        "name": "container",
        "parent": "sect01",
        "children": ["head01", "text01"],
        "settings": { "_cssGlobalClasses": ["acss_import_grid-2"] }
      }
    ]
  }'
```

## Composing pages from templates

The real power of templates is composition. String several together to build a full page:

```bash
bricks templates compose hero-split features-grid testimonial-slider cta-banner \
  --push 42 --snapshot
```

This takes the element trees from each template, concatenates them in order, assigns fresh element IDs to avoid collisions, and pushes the combined result to page 42.

The `--snapshot` flag saves the page's current state before overwriting, so you can roll back if the composed page isn't what you wanted.

### Composition order matters

Templates are stacked top to bottom in the order you list them. The first template becomes the top of the page, the last becomes the bottom.

### ID remapping

Each template might have elements with IDs like `sect01` or `abc123`. When composing, the CLI generates new unique IDs for every element and updates all parent/child references. Two templates that both have a `sect01` won't collide.

## Updating templates

```bash
curl -X PATCH https://your-site.com/wp-json/agent-bricks/v1/templates/105 \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hero - Centered (v2)",
    "elements": [...]
  }'
```

You can update the title, type, elements, or settings independently. Only the fields you include in the request body are changed.

## Deleting templates

```bash
curl -X DELETE https://your-site.com/wp-json/agent-bricks/v1/templates/105 \
  -H "X-ATB-Key: atb_abc123..."
```

This permanently deletes the template from WordPress (not just trashing it).

## Components vs. templates

The `/components` endpoint is a filtered view of templates where the type is `section`. Components are section-level building blocks -- heroes, CTAs, feature grids, testimonials. They're the most common thing you'll compose into pages.

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/components \
  -H "X-ATB-Key: atb_abc123..."
```

## Workflow example

Here's a realistic workflow for building a new landing page from templates:

```bash
# 1. See what templates you have
bricks templates search "hero"
bricks templates search "features"
bricks templates search "pricing"
bricks templates search "cta"

# 2. Compose them into a page
bricks templates compose hero-centered features-3col pricing-cards cta-fullwidth \
  --push 78 --snapshot

# 3. Check the result in your browser
# Maybe the features section needs different copy...

# 4. Patch specific elements
bricks site elements 78 | jq '.elements[] | select(.name == "heading")'
# Find the heading IDs, then patch them via the API or generate new content

# 5. Or roll back and try different templates
bricks snapshots rollback 78 snap_a1b2c3d4e5f6
bricks templates compose hero-split features-icons pricing-simple cta-banner \
  --push 78 --snapshot
```
