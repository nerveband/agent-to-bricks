---
title: Search commands
description: Find elements across every page, template, and component on your Bricks Builder site.
---

The `bricks search` command lets you find elements across your entire site. Search by element type, global class, setting value, post type, or Bricks query metadata. Useful for auditing content, finding query loops, locating WooCommerce product grids, or understanding what exists before making changes.

## Basic usage

```bash
bricks search elements [flags]
```

You can run it without filters, but it is usually more useful to combine filters so the result set stays small enough for people and agents to reason about.

## Flags

| Flag | Description |
|------|-------------|
| `--type <type>` | Filter by element type (heading, button, image, etc.) |
| `--class <class>` | Filter by global class name |
| `--setting <key=value>` | Filter by a specific setting and value |
| `--post-type <type>` | Limit to a post type: page, template, etc. |
| `--has-query` | Only return elements with Bricks query settings |
| `--query-object-type <type>` | Filter query elements by object type |
| `--query-post-type <type>` | Filter query elements by queried post type |
| `--query-taxonomy <taxonomy>` | Filter query elements by queried taxonomy |
| `--limit <N>` | Maximum number of results to return |
| `--format json` | Output as JSON instead of the default table |
| `--json` | Shorthand for `--format json` |

## Find by element type

```bash
bricks search elements --type heading
```

```
Page    Element ID  Type     Tag  Text
1460    abc123      heading  h1   Welcome to Acme
1460    def456      heading  h2   Our Services
1523    ghi789      heading  h1   About Us
1523    jkl012      heading  h3   Our Team
1587    mno345      heading  h1   Contact
```

This returns every heading element across all pages, templates, and components.

## Find by global class

Track down everywhere a specific class is used.

```bash
bricks search elements --class fr-hero
```

```
Page    Element ID  Type     Classes
1460    abc123      section  fr-hero, section--l
1523    xyz789      section  fr-hero, bg--primary-dark
```

Works with ACSS utility classes, Frames component classes, and any custom global classes.

## Find by setting value

Search for elements with a specific setting.

```bash
bricks search elements --setting tag=h1
```

```
Page    Element ID  Type     Text
1460    abc123      heading  Welcome to Acme
1523    ghi789      heading  About Us
1587    mno345      heading  Contact
```

Every `h1` on the site, in one command. Handy for checking heading hierarchy.

## Filter by post type

Narrow results to just pages, or just templates.

```bash
bricks search elements --type button --post-type page
```

```
Page    Element ID  Type    Text
1460    pqr678      button  Get Started
1460    stu901      button  Learn More
1523    vwx234      button  Contact Us
```

## Combine filters

Stack multiple flags to get specific.

```bash
bricks search elements --type heading --setting tag=h1 --post-type page
```

This finds all `h1` headings, but only on pages (not templates or components).

## Find query-driven sections

```bash
bricks search elements --has-query
```

This returns elements that have Bricks query data or loop settings attached, regardless of whether they are classic post loops or WooCommerce product lists.

## Find WooCommerce product loops

```bash
bricks search elements --has-query --query-post-type product
```

This is the fastest way to find existing product grids, related-product sections, or custom loops that query the `product` post type.

You can narrow it further by taxonomy:

```bash
bricks search elements --has-query --query-post-type product --query-taxonomy product_cat
```

## Limit results

```bash
bricks search elements --type image --limit 5
```

Returns at most 5 matching elements.

## JSON output

```bash
bricks search elements --has-query --query-post-type product --limit 3 --json
```

```json
{
  "results": [
    {
      "postId": 1460,
      "postTitle": "Shop",
      "postType": "page",
      "elementId": "abc123",
      "elementType": "posts",
      "elementLabel": "Featured products",
      "settings": {
        "hasLoop": true,
        "query": {
          "objectType": "post",
          "post_type": ["product"]
        }
      },
      "parentId": "0",
      "hasQuery": true,
      "queryObjectType": "post",
      "queryPostTypes": ["product"],
      "queryTaxonomies": [],
      "queryRaw": {
        "objectType": "post",
        "post_type": ["product"]
      }
    }
  ],
  "total": 1,
  "page": 1,
  "perPage": 3,
  "totalPages": 1
}
```

JSON output is what you'll want when piping results into another tool or feeding them to an AI agent.

## Practical uses

**Audit heading structure across the site:**
```bash
bricks search elements --type heading --json | jq '.results[].settings.tag' | sort | uniq -c
```

> On Windows, `jq`, `sort`, and `uniq` are not built-in. Install [jq](https://jqlang.github.io/jq/download/) separately, or use PowerShell:
> ```powershell
> bricks search elements --type heading --json | ConvertFrom-Json | Select-Object -ExpandProperty results | Group-Object { $_.settings.tag } | Select-Object Count, Name
> ```

**Find all buttons linking to a specific URL:**
```bash
bricks search elements --type button --setting link=/pricing
```

**Check which pages use a particular component class:**
```bash
bricks search elements --class fr-pricing-table
```

**Count images across all pages:**
```bash
bricks search elements --type image --json | jq '.results | length'
```

## Related commands

- [`bricks site pull`](/cli/site-commands/): pull full page content once you've found what you're looking for
- [`bricks site query-elements`](/cli/site-commands/): list the Bricks element types that support queries
- [`bricks woo products`](/cli/woo-commands/): inspect WooCommerce content directly
- [`bricks classes find`](/cli/class-commands/): search for global class definitions (not usages)
- [`bricks doctor`](/cli/doctor-validate/): find structural problems on a specific page
