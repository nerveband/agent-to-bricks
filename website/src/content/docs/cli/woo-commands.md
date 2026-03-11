---
title: WooCommerce commands
description: Inspect WooCommerce availability, products, categories, and tags from the Agent to Bricks CLI.
---

The `bricks woo` commands expose WooCommerce discovery data in a machine-readable way. They are read-only commands designed for agent prompts, autocomplete flows, and preflight checks before building product grids or query-driven Bricks sections.

## Check WooCommerce status

```bash
bricks woo status
bricks woo status --format json
```

```
Active:             true
Version:            9.8.1
HPOS:               true
Product post type:  true
Product categories: true
Product tags:       true
Woo element types:  3
Element types:      product-add-to-cart, woocommerce-notice, woocommerce-account-page
```

Use this before attempting Woo-specific prompts or templates. It tells you whether WooCommerce is active, whether the product taxonomies exist, and whether the current Bricks install exposes Woo-specific element types.

## List products

```bash
bricks woo products --search hoodie --limit 10
bricks woo products --format json
```

### Flags

| Flag | Description |
|------|-------------|
| `--search <text>` | Filter products by title |
| `--limit <N>` | Maximum results to return |
| `--page <N>` | Page number for paginated results |
| `--format json` | Output result as JSON |
| `--json` | Shorthand for `--format json` |

### Example

```bash
bricks woo products --search hoodie
```

```
ID    TITLE            SKU         PRICE   STATUS
812   Zip Hoodie       HOOD-ZIP    69.00   publish
844   Pullover Hoodie  HOOD-PULL   59.00   publish
```

The JSON output includes category and tag summaries for each product, which makes it useful for agent @mentions and product-query planning.

## List product categories

```bash
bricks woo categories
bricks woo categories --search featured --format json
```

```
ID   NAME       SLUG       COUNT
21   Featured   featured   14
33   Hoodies    hoodies    8
```

## List product tags

```bash
bricks woo tags
bricks woo tags --search sale --format json
```

```
ID   NAME   SLUG   COUNT
18   Sale   sale   6
27   New    new    9
```

## Related commands

- [`bricks site features`](/cli/site-commands/) for overall site capability discovery
- [`bricks site query-elements`](/cli/site-commands/) to see which Bricks elements can run Woo product queries
- [`bricks search elements`](/cli/search-commands/) with `--has-query` or `--query-post-type product` to find existing product loops
