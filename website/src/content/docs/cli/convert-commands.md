---
title: Convert commands
description: Convert HTML files into Bricks Builder element JSON, with automatic ACSS and Frames class resolution.
---

The `bricks convert html` command turns HTML into Bricks element JSON. Write your markup using your site's CSS classes, and the converter handles the translation -- including resolving ACSS utility names and Frames component classes to their global class IDs.

## Basic usage

```bash
bricks convert html <file.html>
```

This reads the HTML file and prints the converted Bricks element JSON to stdout.

## Flags

| Flag | Description |
|------|-------------|
| `--push <page-id>` | Push the converted elements directly to a page |
| `--snapshot` | Take a snapshot before pushing (only works with `--push`) |
| `--dry-run` | Show what would happen without actually pushing |
| `-o <file>` | Write output to a file instead of stdout |
| `--stdin` | Read HTML from stdin instead of a file |
| `--class-cache` | Cache class lookups for faster repeated conversions |

## Convert a file

```bash
bricks convert html hero.html
```

```json
[
  {
    "id": "a1b2c3",
    "name": "section",
    "parent": 0,
    "settings": {
      "tag": "section",
      "_cssGlobalClasses": ["acss_import_section__l", "acss_import_bg__primary_dark"]
    },
    "children": ["d4e5f6"]
  },
  {
    "id": "d4e5f6",
    "name": "heading",
    "parent": "a1b2c3",
    "settings": {
      "tag": "h1",
      "text": "Welcome to our site",
      "_cssGlobalClasses": ["acss_import_text__white"]
    }
  }
]
```

## Convert and push to a page

The most common workflow: convert and push in one step.

```bash
bricks convert html homepage.html --push 1460
```

```
Converted 18 elements from homepage.html
Pushed to page 1460
```

Add `--snapshot` to save a restore point first:

```bash
bricks convert html homepage.html --push 1460 --snapshot
```

```
Snapshot created: snap_20260225_093015
Converted 18 elements from homepage.html
Pushed to page 1460
```

## Preview with dry run

See exactly what would be pushed without changing anything on your site.

```bash
bricks convert html homepage.html --push 1460 --dry-run
```

```
[dry-run] Would push 18 elements to page 1460
```

The `--dry-run` flag still runs the full conversion, so you'll catch any HTML parsing errors or class resolution failures before committing to a push.

## Save to a file

```bash
bricks convert html landing-page.html -o elements.json
```

Useful when you want to inspect or hand-edit the JSON before pushing it with `bricks site push`.

## Read from stdin

Pipe HTML directly from another command or script.

```bash
echo '<section class="section--l bg--primary-dark">
  <div class="container" style="max-width: var(--content-width)">
    <h1 class="text--white fw--700">Launch day</h1>
    <p class="text--white-trans-60">Ship it.</p>
  </div>
</section>' | bricks convert html --stdin
```

This works well with AI agents that generate HTML on the fly:

```bash
cat generated-output.html | bricks convert html --stdin --push 1460 --snapshot
```

Or combine stdin with push for a one-liner:

```bash
echo '<section class="section--m">
  <h2>Hello</h2>
</section>' | bricks convert html --stdin --push 1460
```

## Class resolution

The converter automatically maps CSS class names to Bricks global class IDs. Here's what happens:

1. **ACSS utility classes** like `section--l`, `bg--primary-dark`, `text--white` get resolved to their internal IDs (e.g., `acss_import_section__l`)
2. **Frames component classes** like `fr-hero`, `fr-lede`, `btn--primary` get resolved to their registered global class IDs
3. **Custom global classes** you've created in Bricks also get resolved
4. **Unrecognized classes** stay as plain CSS class names in the `_cssClasses` array

You don't need to know the internal IDs. Write your HTML with the class names you'd use in a stylesheet, and the converter figures out the mapping.

### Example

Input HTML:
```html
<section class="section--l bg--primary-dark">
  <div class="fr-hero container">
    <h1 class="text--white custom-title">Big headline</h1>
  </div>
</section>
```

The converter resolves:
- `section--l` to global class ID `acss_import_section__l`
- `bg--primary-dark` to global class ID `acss_import_bg__primary_dark`
- `fr-hero` to its Frames global class ID
- `container` to its global class ID
- `text--white` to global class ID `acss_import_text__white`
- `custom-title` stays in `_cssClasses` (not a registered global class)

## Writing HTML for conversion

A few structural rules to keep in mind:

- Use `<section>` elements as top-level containers
- Use `<div>` for layout wrappers, grids, and groups
- Use semantic elements for content: `<h1>`-`<h6>`, `<p>`, `<a>`, `<img>`, `<ul>`, `<ol>`
- Inline styles with CSS custom properties work: `style="padding: var(--space-l)"`
- Nesting determines the parent/child relationships in the Bricks element tree

```html
<section class="section--l">
  <div class="container grid--auto-3 gap--m">
    <div class="card">
      <h3>Feature one</h3>
      <p>Description of the feature.</p>
    </div>
    <div class="card">
      <h3>Feature two</h3>
      <p>Another description here.</p>
    </div>
    <div class="card">
      <h3>Feature three</h3>
      <p>And one more for the grid.</p>
    </div>
  </div>
</section>
```

## Related commands

- [`bricks site push`](/cli/site-commands/) -- push a JSON file manually
- [`bricks site snapshot`](/cli/site-commands/) -- take a snapshot separately
- [`bricks classes list`](/cli/class-commands/) -- see available global classes
- [`bricks generate section`](/cli/generate-commands/) -- generate HTML with AI instead of writing it yourself
