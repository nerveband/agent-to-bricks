---
title: ACSS integration
description: How Agent to Bricks works with Automatic.css utility classes, token mapping, and framework detection
---

If your site uses [Automatic.css](https://automaticcss.com/) (ACSS), Agent to Bricks picks it up automatically. The plugin detects ACSS on activation, reads its settings, maps utility class names to Bricks global class IDs, and exposes the design tokens to the CLI and AI tools.

You don't need to configure anything. It just works.

## What gets detected

When the plugin sees ACSS in your active plugins list, it reads:

- **Utility classes** -- all ACSS classes imported into the Bricks global class registry (`section--l`, `bg--primary`, `text--white`, `grid--auto-3`, etc.)
- **Color tokens** -- primary, secondary, accent, base, neutral, and their light/dark/ultra-light/ultra-dark variants
- **Spacing scale** -- the full clamp-based spacing scale (space-xs through space-xxl, section-space-s through section-space-xl)
- **Typography** -- root font size, heading and body font families, the responsive type scale

Check what's detected:

```bash
bricks site frameworks
```

```
Frameworks:
  Automatic.css 3.0.2
    |- 247 utility classes in global registry
    |- 18 color tokens
    |- 12 spacing tokens
    |- 8 typography tokens
```

## How ACSS classes map to Bricks

ACSS imports its utility classes into the Bricks global class registry. Each class gets an ID with the `acss_import_` prefix:

| ACSS class name | Bricks global class ID |
|-----------------|----------------------|
| `section--l` | `acss_import_section-l` |
| `text--xl` | `acss_import_text-xl` |
| `bg--primary-dark` | `acss_import_bg-primary-dark` |
| `grid--3` | `acss_import_grid-3` |
| `gap--m` | `acss_import_gap-m` |

When you write HTML with these class names and run `bricks convert html`, the converter matches each name to its ID in the registry. The output element uses the ID:

```json
{
  "settings": {
    "_cssGlobalClasses": ["acss_import_section-l", "acss_import_bg-primary-dark"]
  }
}
```

You never need to think about `acss_import_` prefixes in your HTML. The CLI handles the mapping.

## Class naming patterns

ACSS classes use a double-dash naming convention:

| Pattern | Example | What it does |
|---------|---------|-------------|
| `section--{size}` | `section--l` | Section padding |
| `bg--{color}` | `bg--primary-dark` | Background color |
| `text--{color}` | `text--white` | Text color |
| `fw--{weight}` | `fw--700` | Font weight |
| `grid--auto-{cols}` | `grid--auto-3` | Auto-fit grid |
| `gap--{size}` | `gap--m` | Grid/flex gap |
| `f-size--{scale}` | `f-size--xl` | Font size |
| `mt--{size}` / `mb--{size}` | `mt--m` | Margin top/bottom |
| `pt--{size}` / `pb--{size}` | `pt--l` | Padding top/bottom |

## Using ACSS classes in HTML

Write your HTML with ACSS class names exactly as they appear in the ACSS documentation:

```html
<section class="section--l bg--primary-dark">
  <div class="container">
    <div class="grid--2 gap--l align--center">
      <div>
        <h1 class="text--xxl text--white fw--900">Build faster</h1>
        <p class="text--l text--white-trans mt--m">
          Stop clicking. Start shipping.
        </p>
        <a href="/start" class="btn btn--primary btn--lg mt--l">
          Get started
        </a>
      </div>
      <div>
        <img src="/hero.webp" alt="Product screenshot" class="img--rounded shadow--l" />
      </div>
    </div>
  </div>
</section>
```

The converter handles the name-to-ID mapping. The resulting Bricks element for the section has:

```json
{
  "settings": {
    "_cssGlobalClasses": ["acss_import_section-l", "acss_import_bg-primary-dark"]
  }
}
```

## ACSS tokens in inline styles

CSS custom properties from ACSS work in inline styles and get converted to Bricks settings:

```html
<div style="padding: var(--space-l); font-size: var(--h2); color: var(--primary)">
```

Common ACSS tokens:

| Token | What it controls |
|-------|-----------------|
| `--space-{size}` | Spacing (xs, s, m, l, xl, xxl) |
| `--section-space-{size}` | Section padding |
| `--h1` through `--h6` | Heading sizes |
| `--body` | Body text size |
| `--primary`, `--secondary`, `--accent` | Theme colors |
| `--white`, `--black`, `--shade-{variant}` | Neutral colors |
| `--content-width`, `--narrow-width` | Layout widths |
| `--radius-{size}` | Border radius |

## Token mapping in AI context

When you run `bricks agent context --format prompt`, the ACSS tokens are included so the AI knows what your variables resolve to:

```
## Available Design Tokens
- `color-primary`: #2563eb
- `color-secondary`: #7c3aed
- `color-accent`: #f59e0b
- `space-scale`: 1.5
- `root-font-size`: 62.5%
- `text-font-family`: Inter, sans-serif
- `heading-font-family`: Poppins, sans-serif
```

This means when you tell the AI "use the accent color for the highlight," it knows `--accent` is `#f59e0b` and writes `text--accent` or `bg--accent` accordingly.

## Read-only protection

ACSS classes are read-only through the Agent to Bricks API. You can list and search them, but you can't update or delete them. The API returns `403 Forbidden` if you try:

```json
{
  "error": "Cannot modify ACSS-imported class."
}
```

This is intentional. ACSS manages these classes through its own settings panel. Editing them through the plugin would create conflicts the next time ACSS syncs its classes to the Bricks registry.

If you need to customize an ACSS utility class behavior, create a new custom class with a different name.

```bash
bricks classes list --framework acss    # list ACSS classes (read-only)
bricks classes list --framework custom  # list your own classes (read-write)
```

## Sites without ACSS

Agent to Bricks works fine without ACSS. The class resolution system handles any global classes in the Bricks registry, whether they come from ACSS, Frames, or were created manually.

Without ACSS, you won't have the utility class shortcuts or design tokens. The AI context will be shorter, and you'll reference classes by whatever names you've registered in Bricks. The workflow is the same -- the only difference is the set of available classes.

## Checking class resolution

To verify which ACSS classes the CLI can resolve:

```bash
# List all ACSS classes
bricks classes list --framework acss

# Check if a specific class resolves
bricks classes list | grep "section--l"
```

If a class you expect to see is missing, check that ACSS has synced its classes to the Bricks global registry. In the WordPress admin, go to the Bricks global classes panel and confirm the ACSS classes are listed there.

## Related

- [Global classes reference](/plugin/global-classes/)
- [Class commands](/cli/class-commands/) -- manage global classes
- [HTML to Bricks](/guides/html-to-bricks/) -- write HTML with ACSS classes
- [Style profiles](/guides/style-profiles/) -- learn patterns from ACSS-styled pages
