---
title: Template commands
description: Browse, import, learn, and compose reusable section templates for building Bricks pages fast.
---

Templates are reusable section blueprints stored locally. You can import them from a directory, learn them from existing pages, search by description, and compose multiple templates into a full page layout. The `bricks templates` and `bricks compose` commands manage this workflow.

## List templates

See everything in your local template library.

```bash
bricks templates list
```

```
Name                  Type      Elements  Description
hero-cali             hero      8         Dark hero with gradient overlay and dual CTAs
hero-stockholm        hero      6         Minimal hero with centered headline
feature-havana        features  12        3-column feature grid with icons
pricing-alpha         pricing   18        3-tier pricing table with toggle
testimonial-grid      social    9         3-card testimonial layout
footer-amsterdam      footer    14        4-column footer with newsletter signup
```

## Show template details

Inspect a specific template's structure.

```bash
bricks templates show <name>
```

### Example

```bash
bricks templates show hero-cali
```

```
Name:        hero-cali
Type:        hero
Elements:    8
Description: Dark hero with gradient overlay and dual CTAs

Element tree:
  section (section--l, bg--primary-dark)
  └─ container
     ├─ div (content wrapper)
     │  ├─ heading (h1): "{headline}"
     │  ├─ text-basic: "{subheadline}"
     │  └─ div (button group)
     │     ├─ button: "{cta_primary}"
     │     └─ button (outline): "{cta_secondary}"
     └─ div (image wrapper)
        └─ image: "{hero_image}"

Variables:
  headline, subheadline, cta_primary, cta_secondary, hero_image
```

Templates can include placeholder variables (wrapped in curly braces) that get filled in during composition.

## Import templates

Load templates from a directory of JSON files.

```bash
bricks templates import <directory>
```

### Example

```bash
bricks templates import ./my-templates/
```

```
Imported 4 templates:
  hero-minimal (6 elements)
  feature-split (10 elements)
  cta-banner (4 elements)
  footer-simple (8 elements)
```

The import directory should contain JSON files following the template format. Each file becomes a template named after the file (without the `.json` extension).

## Learn from a page

Extract a template from an existing Bricks page. The CLI analyzes the page structure and creates a reusable template from it.

```bash
bricks templates learn <page-id>
```

### Example

```bash
bricks templates learn 1460
```

```
Analyzed page 1460 (Homepage)
Found 4 sections:
  1. Hero section (8 elements) → saved as hero-homepage
  2. Features grid (12 elements) → saved as features-homepage
  3. Testimonials (9 elements) → saved as testimonials-homepage
  4. Footer (14 elements) → saved as footer-homepage

Learned 4 templates from page 1460
```

This is a good way to turn a hand-built page into reusable parts. Once learned, those templates show up in `bricks templates list` and can be composed into new pages.

## Search templates

Find templates by description using natural language.

```bash
bricks templates search "<query>"
```

### Examples

```bash
bricks templates search "dark hero with gradient"
```

```
Results (3 matches):
  hero-cali          Dark hero with gradient overlay and dual CTAs (score: 0.92)
  hero-stockholm     Minimal hero with centered headline (score: 0.61)
  hero-minimal       Simple hero with background image (score: 0.54)
```

```bash
bricks templates search "pricing table"
```

```
Results (1 match):
  pricing-alpha      3-tier pricing table with toggle (score: 0.89)
```

## Compose templates into a page

The `bricks compose` command stitches multiple templates together into a single page layout.

```bash
bricks compose <name1> <name2> [name3...] [flags]
```

### Flags

| Flag | Description |
|------|-------------|
| `-o <file>` | Write composed output to a file |
| `--push <page-id>` | Push the composed page directly to a site page |

### Examples

Compose and save to a file:

```bash
bricks compose hero-cali feature-havana pricing-alpha footer-amsterdam -o landing-page.json
```

```
Composed 4 templates → 52 elements
Written to landing-page.json
```

Compose and push in one step:

```bash
bricks compose hero-cali feature-havana footer-amsterdam --push 1460
```

```
Composed 3 templates → 34 elements
Pushed to page 1460
```

The templates are combined in the order you list them. The first template becomes the top section, the last becomes the bottom.

## A typical template workflow

Build a page from templates in four steps:

```bash
# 1. Find templates that match what you need
bricks templates search "hero"
bricks templates search "features"
bricks templates search "footer"

# 2. Preview what each one looks like
bricks templates show hero-cali
bricks templates show feature-havana
bricks templates show footer-amsterdam

# 3. Compose them into a page
bricks compose hero-cali feature-havana footer-amsterdam --push 1460

# 4. Pull the page, edit the HTML, and push the updated version
bricks site pull 1460 -o tweaked.json
```

## Build your own template library

Start by learning from pages you've already built:

```bash
# Learn from your best pages
bricks templates learn 1460    # homepage
bricks templates learn 1523    # about page
bricks templates learn 1587    # landing page

# Check what you've got
bricks templates list

# Use them on new pages
bricks compose hero-homepage features-landing footer-homepage --push 1650
```

Or import templates from files shared by your team:

```bash
bricks templates import ~/team-templates/
```

## Related commands

- [`bricks convert html`](/cli/convert-commands/): convert HTML to Bricks elements as an alternative to templates
- [`bricks site snapshot`](/cli/site-commands/): snapshot before pushing composed pages
- [`bricks styles learn`](/cli/style-commands/): learn style profiles alongside templates
