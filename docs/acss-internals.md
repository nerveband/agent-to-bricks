# Automatic.css (ACSS) Internals

Discovered from staging server running ACSS 3.3.6 on Bricks 2.2.

## WordPress Options

| Option Key | Size | Description |
|---|---|---|
| `automatic_css_settings` | ~94KB | Main settings object (2126 keys) |
| `automatic_css_db_version` | 5B | Version string (e.g. "3.3.6") |
| `automatic_css_license_key` | 32B | License key hash |
| `automatic_css_license_status` | 5B | "valid" or other status |
| `automatic_css__hotfix_302` | 1B | Hotfix flag |

## Settings Structure (`automatic_css_settings`)

2126 keys organized by prefix. Major groups:

### Colors (24 keys + 60 per color family)
- `color-primary`, `color-secondary`, `color-accent`, `color-base`, `color-neutral`
- Each color family has ~60 computed keys: `{family}-comp-h`, `{family}-comp-s`, `{family}-comp-l`, etc.
- Color families: primary, secondary, tertiary, accent, base, neutral, shade, action, info, success, warning, danger

### Spacing
- `space-scale` — spacing scale factor
- `section-padding-block` — section vertical padding
- `section-padding-x-min`, `section-padding-x-max` — section horizontal padding
- `space-adjust-section` — section space adjustment
- `mob-space-scale`, `mob-space-adjust-section` — mobile overrides

### Typography
- `root-font-size` — base font size
- `text-font-family`, `heading-font-family` — font stacks
- `h1` through `h6` — each has: color, font-family, font-style, font-weight, letter-spacing, line-height, max-width, text-transform, font-size (10-11 keys each)
- `mob-text-scale`, `mob-heading-scale` — mobile scaling

### Buttons (429 keys!)
- `btn-{variant}-bg`, `btn-{variant}-border-color`, `btn-{variant}-focus-color`, etc.
- Variants: accent, action, base, danger, info, neutral, primary, secondary, success, tertiary, warning
- Each variant has normal + dark + outline + dark-outline states

### Layout
- `breakpoint-xs` through `breakpoint-xxl` — custom breakpoints
- `content-feature`, `content-feature-max` — content width
- `header-height`, `header-height-l/m/s/xl/xxl` — header heights
- `col-width-l/m/s` — column widths
- Auto-grid: `auto-grid-aggressiveness`, `auto-grid-flow-option`, etc.

### Borders & Radius
- `border-main`, `border-size`, `border-style`, `border-color-light`, `border-color-dark`
- `radius-scale` — border radius scale
- `body-border-*` — body border settings

### Cards
- `card-*` — 20 card-related settings
- `light-card-*`, `dark-card-*` — 11 keys each for light/dark card styles

### Textures
- `texture-1-*` through `texture-5-*` — 85 total texture settings

### Options/Toggles (227 keys)
- `option-{feature}` — boolean toggles for enabling/disabling features
- e.g., `option-accent-btn`, `option-accent-clr`, `option-grid-gap`, etc.

## Bricks Global Classes

2984 ACSS-imported classes (ID prefix: `acss_import_`).

### Class Categories by Prefix

| Prefix | Count | Examples |
|---|---|---|
| bg | 530 | bg-primary, bg-dark, bg-gradient-* |
| col | 342 | col-primary, col-accent, col-text-* |
| overlay | 275 | overlay-primary, overlay-dark-* |
| row | 252 | row-gap-*, row-reverse-* |
| link | 225 | link-primary, link-underline-* |
| text | 151 | text-l, text-m, text-xl, text-center |
| grid | 117 | grid-l, grid-m, grid-auto-* |
| z | 84 | z-1 through z-10, etc. |
| marker | 72 | marker styles |
| height | 64 | height-100, height-auto, etc. |
| max | 64 | max-width-*, max-height-* |
| aspect | 63 | aspect-ratio presets |
| focus | 61 | focus-visible styles |
| pad | 55 | pad-section, pad-l, pad-m, etc. |
| flex | 52 | flex-grow, flex-center, etc. |
| justify | 50 | justify-center, justify-between, etc. |
| align | 50 | align-center, align-start, etc. |
| center | 50 | centering utilities |
| section | 42 | section padding/spacing |
| margin | 36 | margin-auto, margin-l, etc. |

## Theme Style

ACSS registers a Bricks theme style: `acss_bricks_1.10.x`
- Label: "ACSS-Bricks-1.10.x"
- Settings: `_custom`, `conditions`, `typography`, `container`, `code`, `image`, `heading`
- Custom CSS: minimal (4 chars)

## Plugin Detection

- Plugin path: `automaticcss-plugin/automaticcss-plugin.php`
- Check: `is_plugin_active('automaticcss-plugin/automaticcss-plugin.php')`
- Settings key: `automatic_css_settings` (NOT `automaticcss_options`)

## CSS Variable Mapping

ACSS generates CSS variables from its settings. Key mappings:
- `color-primary` → `--primary` (and `--primary-hover`, `--primary-light`, etc.)
- `space-scale` → `--space-xs`, `--space-s`, `--space-m`, `--space-l`, `--space-xl`, `--space-xxl`
- `radius-scale` → `--radius-s`, `--radius-m`, `--radius-l`
- Typography → `--h1-size` through `--h6-size`, `--text-s/m/l/xl/xxl`
