---
title: Style profiles
description: Learn design tokens from your site, build style profiles, and apply consistent color palettes and spacing to generated content
---

A style profile is a snapshot of your site's design system -- its colors, spacing, typography, and CSS variables -- packaged in a format that the CLI and AI tools can use. When you generate content or convert HTML, the style profile tells the tools what design tokens are available so the output matches your site.

## What's in a style profile

A style profile pulls together:

- **Color palette** from Bricks global settings (named colors with hex values)
- **CSS custom properties** defined in Bricks theme styles (things like `--card-radius`, `--section-max-width`)
- **ACSS design tokens** if Automatic.css is active: color families (primary, secondary, accent, base, neutral), spacing scale, section padding, root font size, font families
- **Theme style settings** like default typography, heading styles, link colors

It's not a CSS file. It's structured data that describes your design decisions.

## Learning styles from your site

Point the CLI at a page that represents your site's visual style:

```bash
bricks styles learn 1460
```

```
Learning styles from page 1460 (Homepage)...
  |- 6 colors detected
  |- 4 spacing tokens in use
  |- 3 typography scales
  |- 12 global classes referenced
  |- 2 background patterns

Style profile saved.
```

The CLI pulls the page, analyzes every element's settings, and extracts the patterns: which colors appear most often, what spacing values are used, which typography scales are applied, and which global classes show up repeatedly.

You can also name profiles:

```bash
bricks styles learn 1460 --name "client-site-v2"
```

## Viewing the current profile

```bash
bricks styles show
```

```
Style Profile (learned from page 1460)

Colors:
  Primary:    var(--primary) / #3B82F6
  Background: var(--shade-dark) / #1E293B
  Text:       var(--white) / #FFFFFF
  Accent:     var(--accent) / #F59E0B

Spacing:
  Section padding: var(--section-space-l)
  Content gap:     var(--space-m)
  Card padding:    var(--space-l)

Typography:
  Headings: var(--h1) through var(--h4)
  Body:     var(--body)
  Font weight: 700 (headings), 400 (body)

Common classes:
  section--l, bg--primary-dark, text--white, fw--700, grid--auto-3
```

## The underlying API endpoints

### GET /styles

Returns Bricks theme styles and the color palette:

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/styles \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "themeStyles": [
    {
      "key": "default",
      "label": "Default",
      "settings": {
        "typography": { "font-family": "Inter, sans-serif" },
        "colors": { "heading": "#1a1a2e", "text": "#4a4a68" }
      }
    }
  ],
  "colorPalette": [
    { "id": "cp1", "color": { "hex": "#2563eb" }, "name": "Primary" },
    { "id": "cp2", "color": { "hex": "#7c3aed" }, "name": "Secondary" }
  ]
}
```

### GET /variables

Returns CSS custom properties, including ones extracted from theme style custom CSS blocks:

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/variables \
  -H "X-ATB-Key: atb_abc123..."
```

```json
{
  "variables": [],
  "extractedFromCSS": [
    { "name": "--card-radius", "value": "8px", "source": "default" },
    { "name": "--section-max-width", "value": "1200px", "source": "default" },
    { "name": "--hero-min-height", "value": "80vh", "source": "default" }
  ]
}
```

The `extractedFromCSS` array contains variables that the plugin found by parsing `--variable-name: value;` patterns inside `:root` and `body` blocks in your theme styles.

## ACSS design tokens

If your site has Automatic.css, the framework detection endpoint adds a rich set of tokens:

```bash
bricks site frameworks
```

```json
{
  "frameworks": {
    "acss": {
      "colors": {
        "primary": "#2563eb",
        "secondary": "#7c3aed",
        "accent": "#f59e0b",
        "base": "#1a1a2e",
        "neutral": "#6b7280"
      },
      "spacing": {
        "scale": "1.5",
        "sectionPadding": "var(--section-space-m)"
      },
      "typography": {
        "rootFontSize": "62.5%",
        "textFontFamily": "Inter, sans-serif",
        "headingFontFamily": "Poppins, sans-serif"
      }
    }
  }
}
```

These tokens map directly to CSS variables your site already uses. When you reference `var(--primary)` in your HTML, it resolves to `#2563eb`.

## How profiles influence generation

When you run `bricks generate section` or `bricks agent context`, the style profile data is included in the context sent to the LLM. The AI gets a concrete list of tokens and their values.

Without a profile, the AI might output:

```html
<section style="padding: 80px 0; background: #1a1a2e">
```

With a profile, it outputs:

```html
<section class="section--l bg--primary-dark">
```

The second version uses your actual design system. That's the difference.

## Design token commands

The `styles` commands show raw design token values:

```bash
bricks styles colors      # color palette
bricks styles variables   # all CSS custom properties
bricks styles theme       # theme-level styles
```

These are the underlying values that the style profile organizes into patterns.

## Multiple profiles

If you manage several sites with different design systems, keep separate profiles:

```bash
# Learn from site A
bricks config set site.url https://site-a.com
bricks styles learn 10 --name "site-a"

# Learn from site B
bricks config set site.url https://site-b.com
bricks styles learn 10 --name "site-b"
```

## Refreshing profiles

Design systems change. When you update your ACSS settings or Bricks theme styles, re-learn the profile:

```bash
bricks styles learn 1460 --name "default" --force
```

The `--force` flag overwrites the existing profile.

## Related

- [Style commands reference](/cli/style-commands/)
- [ACSS integration](/guides/acss-integration/) -- the framework that provides most tokens
- [Working with templates](/guides/working-with-templates/) -- templates + profiles for consistent pages
