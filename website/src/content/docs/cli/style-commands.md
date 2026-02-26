---
title: Style commands
description: Inspect your site's color palette, CSS variables, theme styles, and build style profiles from existing pages.
---

The `bricks styles` commands give you access to your site's design tokens: colors, CSS custom properties, theme configuration, and learned style profiles. This is the data that AI agents and the HTML converter use to write markup that matches your site's design system.

## View the color palette

```bash
bricks styles colors
```

```
Color Palette:
  --primary:           #3B82F6
  --primary-light:     #60A5FA
  --primary-dark:      #1D4ED8
  --primary-trans-10:  rgba(59, 130, 246, 0.1)
  --secondary:         #8B5CF6
  --secondary-light:   #A78BFA
  --secondary-dark:    #6D28D9
  --accent:            #F59E0B
  --neutral:           #6B7280
  --shade-light:       #F3F4F6
  --shade-dark:        #1F2937
  --white:             #FFFFFF
  --black:             #111827
  --success:           #10B981
  --warning:           #F59E0B
  --danger:            #EF4444
```

These are the CSS custom properties your site defines for colors. If you're running ACSS, this pulls from the ACSS color configuration.

## View CSS custom properties

```bash
bricks styles variables
```

```
CSS Custom Properties (142 total):

Spacing:
  --space-xs:    clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem)
  --space-s:     clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem)
  --space-m:     clamp(1rem, 0.8rem + 1vw, 1.5rem)
  --space-l:     clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem)
  --space-xl:    clamp(2rem, 1.6rem + 2vw, 3rem)

Typography:
  --h1:          clamp(2.5rem, 2rem + 2.5vw, 4rem)
  --h2:          clamp(2rem, 1.6rem + 2vw, 3rem)
  --h3:          clamp(1.5rem, 1.3rem + 1vw, 2rem)
  --body:        clamp(1rem, 0.95rem + 0.25vw, 1.125rem)

Layout:
  --content-width:  1280px
  --narrow-width:   768px
  --section-space-s: clamp(2rem, 1.5rem + 2.5vw, 3rem)
  --section-space-m: clamp(3rem, 2.5rem + 2.5vw, 5rem)
  --section-space-l: clamp(5rem, 4rem + 5vw, 8rem)
...
```

This is the full set of CSS custom properties available on your site. Use these in inline styles when writing HTML for conversion.

## View theme styles

```bash
bricks styles theme
```

```
Theme Styles:
  Body:
    font-family: "Inter", system-ui, sans-serif
    font-size: var(--body)
    line-height: 1.6
    color: var(--shade-dark)
    background: var(--white)

  Headings:
    font-family: "Manrope", system-ui, sans-serif
    font-weight: 700
    line-height: 1.2

  Links:
    color: var(--primary)
    text-decoration: underline
    hover-color: var(--primary-dark)

  Buttons:
    font-family: "Manrope", system-ui, sans-serif
    font-weight: 600
    border-radius: 8px
    padding: 0.75em 1.5em
```

Theme styles are Bricks-level defaults that apply across your site. They're the baseline that element-specific styles build on top of.

## Learn a style profile

Analyze an existing page and extract a style profile from it. The profile captures the patterns in how that page uses colors, spacing, typography, and layout.

```bash
bricks styles learn <page-id>
```

### Example

```bash
bricks styles learn 1460
```

```
Analyzed page 1460 (Homepage)

Style Profile:
  Sections: 4 found
    Spacing: section--l (3), section--m (1)
    Backgrounds: bg--primary-dark (2), bg--white (1), bg--shade-light (1)

  Typography:
    H1: var(--h1), fw--700, text--white
    H2: var(--h2), fw--600, text--shade-dark
    Body: var(--body), text--shade-dark

  Color usage:
    Primary surfaces: --primary-dark (hero, CTA)
    Text on dark: --white, --white-trans-60
    Text on light: --shade-dark, --neutral

  Layout patterns:
    Max width: var(--content-width)
    Grid: grid--auto-3 with gap--m
    Button pairs: primary + outline

Saved as style profile "homepage"
```

Style profiles help AI agents match the look of your existing pages. When you run `bricks agent context`, the profile data is included in the exported context so AI tools know which tokens and classes to use.

## Show the current style profile

```bash
bricks styles show
```

```
Active Style Profile: homepage (learned from page 1460)

Spacing preferences:
  Default section padding: section--l
  Content gaps: gap--m
  Element spacing: space-m

Color preferences:
  Hero backgrounds: bg--primary-dark
  Content backgrounds: bg--white, bg--shade-light
  Primary text: text--shade-dark
  Accent text: text--primary

Typography preferences:
  Headline weight: fw--700
  Subheading weight: fw--600
  Body text: default (no weight override)
```

This shows whatever profile was most recently learned or set as active.

## Using design tokens in HTML

Once you know what tokens are available, reference them in your HTML for the converter:

```html
<section class="section--l bg--primary-dark">
  <div class="container" style="max-width: var(--content-width)">
    <h1 class="text--white" style="font-size: var(--h1)">
      Page title here
    </h1>
    <p style="color: var(--white-trans-60); font-size: var(--body)">
      Supporting text with reduced opacity.
    </p>
  </div>
</section>
```

The `bricks convert html` command will translate this into proper Bricks elements with the correct global class IDs and style properties.

## Related commands

- [`bricks classes list`](/cli/class-commands/): see the global classes that reference these tokens
- [`bricks agent context`](/cli/agent-commands/): full context export including styles, classes, and tokens
- [`bricks site frameworks`](/cli/site-commands/): see which CSS framework provides these tokens
- [`bricks templates learn`](/cli/template-commands/): learn templates alongside style profiles
