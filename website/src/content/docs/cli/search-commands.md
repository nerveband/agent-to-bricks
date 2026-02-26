---
title: Search commands
description: Find elements across every page, template, and component on your Bricks Builder site.
---

The `bricks search` command lets you find elements across your entire site. Search by element type, global class, setting value, or post type. Useful for auditing content, finding where a specific component is used, or understanding what exists before making changes.

## Basic usage

```bash
bricks search elements [flags]
```

At least one search filter is required. You can combine multiple filters to narrow results.

## Flags

| Flag | Description |
|------|-------------|
| `--type <type>` | Filter by element type (heading, button, image, etc.) |
| `--class <class>` | Filter by global class name |
| `--setting <key=value>` | Filter by a specific setting and value |
| `--post-type <type>` | Limit to a post type: page, template, etc. |
| `--limit <N>` | Maximum number of results to return |
| `--json` | Output as JSON instead of the default table |

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

## Limit results

```bash
bricks search elements --type image --limit 5
```

Returns at most 5 matching elements.

## JSON output

```bash
bricks search elements --type heading --limit 3 --json
```

```json
[
  {
    "page_id": 1460,
    "page_title": "Homepage",
    "element_id": "abc123",
    "element_type": "heading",
    "settings": {
      "tag": "h1",
      "text": "Welcome to Acme",
      "_cssGlobalClasses": ["acss_import_text__white", "acss_import_fw__700"]
    }
  },
  {
    "page_id": 1523,
    "page_title": "About",
    "element_id": "ghi789",
    "element_type": "heading",
    "settings": {
      "tag": "h1",
      "text": "About Us"
    }
  },
  {
    "page_id": 1587,
    "page_title": "Contact",
    "element_id": "mno345",
    "element_type": "heading",
    "settings": {
      "tag": "h1",
      "text": "Contact"
    }
  }
]
```

JSON output is what you'll want when piping results into another tool or feeding them to an AI agent.

## Practical uses

**Audit heading structure across the site:**
```bash
bricks search elements --type heading --json | jq '.[].settings.tag' | sort | uniq -c
```

> On Windows, `jq`, `sort`, and `uniq` are not built-in. Install [jq](https://jqlang.github.io/jq/download/) separately, or use PowerShell:
> ```powershell
> bricks search elements --type heading --json | ConvertFrom-Json | Group-Object { $_.settings.tag } | Select-Object Count, Name
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
bricks search elements --type image --json | jq length
```

## Related commands

- [`bricks site pull`](/cli/site-commands/): pull full page content once you've found what you're looking for
- [`bricks classes find`](/cli/class-commands/): search for global class definitions (not usages)
- [`bricks doctor`](/cli/doctor-validate/): find structural problems on a specific page
