---
title: Class commands
description: List, create, search, and delete global CSS classes on your Bricks Builder site.
---

Global classes in Bricks are reusable CSS class definitions that get stored in the database and can be applied to any element. The `bricks classes` commands let you browse them, create new ones, search by name, and clean up ones you don't need.

## List all classes

```bash
bricks classes list
```

```
ID                              Name              Framework   Properties
acss_import_section__l          section--l         acss        padding-block: var(--section-space-l)
acss_import_bg__primary_dark    bg--primary-dark   acss        background-color: var(--primary-dark)
acss_import_text__white         text--white        acss        color: var(--white)
acss_import_fw__700             fw--700            acss        font-weight: 700
frames_fr_hero                  fr-hero            frames      (14 properties)
custom_card_shadow              card-shadow        custom      box-shadow: 0 4px 12px rgba(0,0,0,0.1)
```

### Flags

| Flag | Description |
|------|-------------|
| `--framework <name>` | Filter by framework: `acss`, `frames`, `custom` |
| `--json` | Output as JSON |

### Filter by framework

Show only ACSS utility classes:

```bash
bricks classes list --framework acss
```

```
ID                              Name              Properties
acss_import_section__s          section--s         padding-block: var(--section-space-s)
acss_import_section__m          section--m         padding-block: var(--section-space-m)
acss_import_section__l          section--l         padding-block: var(--section-space-l)
acss_import_bg__primary         bg--primary        background-color: var(--primary)
acss_import_bg__primary_dark    bg--primary-dark   background-color: var(--primary-dark)
...
```

### JSON output

```bash
bricks classes list --json
```

```json
[
  {
    "id": "acss_import_section__l",
    "name": "section--l",
    "framework": "acss",
    "properties": {
      "padding-block": "var(--section-space-l)"
    }
  },
  {
    "id": "custom_card_shadow",
    "name": "card-shadow",
    "framework": "custom",
    "properties": {
      "box-shadow": "0 4px 12px rgba(0,0,0,0.1)"
    }
  }
]
```

JSON output includes the full property definitions. This is what AI agents use to understand what classes are available and what they do.

## Create a class

Add a new global class to your site.

```bash
bricks classes create <name>
```

### Example

```bash
bricks classes create card-hover
```

```
Created global class: card-hover (ID: custom_card_hover)
```

This creates an empty class definition. Style it in the Bricks visual editor, or use `bricks site patch` to add properties programmatically.

## Find classes by name

Search for classes matching a query string.

```bash
bricks classes find "<query>"
```

### Examples

```bash
bricks classes find "hero"
```

```
ID                  Name       Framework  Properties
frames_fr_hero      fr-hero    frames     (14 properties)
custom_hero_overlay hero-overlay custom    background: linear-gradient(...)
```

```bash
bricks classes find "btn"
```

```
ID                          Name           Framework  Properties
frames_btn__primary         btn--primary   frames     (8 properties)
frames_btn__outline         btn--outline   frames     (6 properties)
frames_btn__ghost           btn--ghost     frames     (5 properties)
custom_btn_large            btn-large      custom     font-size: 1.125rem; padding: ...
```

The search matches against class names, so partial matches work. Searching for "btn" finds `btn--primary`, `btn--outline`, and anything else with "btn" in the name.

## Delete a class

Remove a global class from your site.

```bash
bricks classes delete <id>
```

### Example

```bash
bricks classes delete custom_card_hover
```

```
Deleted global class: custom_card_hover (card-hover)
```

Use the class ID (not the name) for deletion. Get the ID from `bricks classes list` or `bricks classes find`.

Be careful with this one. Deleting a class that's actively used on pages won't break anything immediately -- the class reference just becomes orphaned. But those elements will lose the styles that class provided.

## Practical uses

**See what ACSS utilities are available before writing HTML:**
```bash
bricks classes list --framework acss --json | jq '.[].name'
```

**Find all classes related to spacing:**
```bash
bricks classes find "space"
bricks classes find "gap"
bricks classes find "section--"
```

**Export your full class library for documentation:**
```bash
bricks classes list --json > all-classes.json
```

**Check if a class exists before creating it:**
```bash
bricks classes find "card-shadow"
```

## Related commands

- [`bricks search elements --class`](/cli/search-commands/) -- find where a class is used across your site
- [`bricks convert html`](/cli/convert-commands/) -- the converter resolves class names to global class IDs automatically
- [`bricks styles variables`](/cli/style-commands/) -- see CSS custom properties used by classes
