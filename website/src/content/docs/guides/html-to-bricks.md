---
title: HTML to Bricks
description: Write standard HTML with ACSS classes, convert it to Bricks elements, and push it to any page
---

The HTML converter is probably the most-used feature in the CLI. Write HTML the normal way, run one command, and get a fully structured Bricks page. The converter handles the translation from HTML elements to Bricks element JSON, resolves class names to global class IDs, and maps tags to the right Bricks element types.

## Basic usage

Write an HTML file:

```html
<!-- hero.html -->
<section class="section--l bg--primary-dark">
  <div class="container text--center">
    <h1 class="text--xxl text--white">Ship faster with Flowboard</h1>
    <p class="text--l text--white-trans">The project management tool that gets out of your way.</p>
    <div class="flex--row gap--m justify--center">
      <a href="/signup" class="btn btn--primary btn--lg">Start free trial</a>
      <a href="/demo" class="btn btn--outline-light btn--lg">Watch demo</a>
    </div>
  </div>
</section>
```

Convert it:

```bash
bricks convert html hero.html
```

This prints the Bricks element JSON to stdout. The output is a flat array of elements with proper parent/child relationships, where each HTML element maps to a Bricks element type.

## Pushing to a page

Add `--push` to send the result directly to a page:

```bash
bricks convert html hero.html --push 42
```

With a snapshot for safety:

```bash
bricks convert html hero.html --push 42 --snapshot
```

## How the conversion works

The converter walks the HTML DOM tree and maps each element:

| HTML | Bricks element type |
|------|-------------------|
| `<section>` | section |
| `<div>` | div or container (first div inside a section becomes a container) |
| `<h1>` through `<h6>` | heading with matching `tag` setting |
| `<p>` | text-basic |
| `<a>` | text-link (or button if it has button classes) |
| `<img>` | image |
| `<video>` | video |
| `<ul>`, `<ol>` | text-basic with rich text content |
| `<form>` | form |
| `<code>` | code |

Attributes are mapped too:

- `href` becomes a `link` setting with `type: "external"` and the URL
- `src` and `alt` on images become `image` settings
- `class` is split into global class IDs (for recognized classes) and `_cssClasses` (for unrecognized ones)
- Inline `style` attributes with CSS custom properties get converted to Bricks settings (`_padding`, `_typography`, `_background`, etc.)

## Class resolution

This is the part that makes the converter useful in practice. When you write `class="section--l bg--primary-dark"`, the converter:

1. Fetches the global class registry from your site (or uses a cached copy)
2. Looks up each class name in the registry
3. Replaces names with Bricks global class IDs in the output

So `section--l` becomes `acss_import_section-l` in the element's `_cssGlobalClasses` array.

Classes that aren't in the registry go into the `_cssClasses` string field, and the CLI prints a warning:

```
WARN: Unresolved classes: custom-hero-bg, my-special-layout
```

This tells you those classes need to be created as global classes in Bricks, or they're plain CSS classes that should live in your stylesheet.

### Handling unresolved classes

You have a few options:

- **Create the missing classes** with `bricks classes create custom-hero-bg` so they become global classes
- **Leave them as plain CSS classes** -- they'll still work if your stylesheet defines them
- **Check for typos** -- a class named `section-l` (single dash) won't match `section--l` (double dash)

## Stdin piping

You don't need a file. Pipe HTML directly:

```bash
echo '<section class="section--m">
  <div class="container">
    <h2 class="text--xl">Quick test</h2>
  </div>
</section>' | bricks convert html --stdin --push 42
```

This is especially useful when an AI agent generates HTML and wants to push it in one step:

```bash
cat /tmp/ai-output.html | bricks convert html --stdin --push 42 --snapshot
```

Or pipe from a generator script:

```bash
./generate-page.sh | bricks convert html --stdin -o output.json
```

## Dry run

Preview the conversion without pushing:

```bash
bricks convert html hero.html --push 42 --dry-run
```

This shows you the element JSON, the class resolution results, and any warnings, without touching your site. Good for checking that the converter understood your HTML correctly before committing.

The dry run output includes a summary:

```
Elements: 8
Resolved classes: 12/14 (85.7%)
Unresolved: custom-hero-bg, my-animation
Warnings: 0
```

## Saving output to a file

Instead of pushing, save the converted JSON for review:

```bash
bricks convert html hero.html -o elements.json
```

Then validate and push separately:

```bash
bricks validate elements.json
bricks site push 42 elements.json
```

## Multi-section pages

You can put an entire page in one HTML file:

```html
<!-- landing-page.html -->
<section class="section--l bg--primary-dark">
  <div class="container text--center">
    <h1 class="text--xxl text--white">Hero headline</h1>
    <p class="text--l text--white-trans">Supporting text goes here.</p>
  </div>
</section>

<section class="section--m">
  <div class="container">
    <h2 class="text--xl text--center">Features</h2>
    <div class="grid--3 gap--l">
      <div class="card">
        <h3 class="text--l">Feature one</h3>
        <p>Description of the first feature.</p>
      </div>
      <div class="card">
        <h3 class="text--l">Feature two</h3>
        <p>Description of the second feature.</p>
      </div>
      <div class="card">
        <h3 class="text--l">Feature three</h3>
        <p>Description of the third feature.</p>
      </div>
    </div>
  </div>
</section>

<section class="section--m bg--neutral-ultra-light">
  <div class="container text--center">
    <h2 class="text--xl">Ready to get started?</h2>
    <a href="/signup" class="btn btn--primary btn--lg">Sign up free</a>
  </div>
</section>
```

```bash
bricks convert html landing-page.html --push 42 --snapshot
```

Each `<section>` becomes a Bricks section element. The nested structure is preserved throughout.

## Tips for converter-friendly HTML

**Wrap everything in `<section>` tags.** The converter treats `<section>` as a Bricks section element, which is the standard top-level container in Bricks layouts.

**Use a single `<div>` as the container inside each section.** The first `<div>` inside a `<section>` becomes a Bricks container element, which controls max-width and centering.

**Use semantic tags.** `<h1>` through `<h6>` map cleanly to Bricks headings. `<p>` maps to text. `<a>` maps to links or buttons. `<img>` maps to images. The converter understands these natively.

**Stick to ACSS classes when possible.** The whole point is that classes like `section--l`, `text--xl`, and `grid--3` resolve to global class IDs. Custom classes work too, but they need to exist in your global class registry or they'll end up as plain CSS classes.

**Keep it clean.** The converter doesn't need `<html>`, `<head>`, or `<body>` tags. Just the page content. If they're present, the converter extracts the `<body>` content and ignores the rest.

## Combining with AI generation

A common pattern: have an AI write the HTML, then convert it.

```bash
# AI generates HTML using your ACSS classes
# (The AI uses context from `bricks agent context` to know your classes)

# Then convert and push
bricks convert html /tmp/ai-generated.html --push 42 --snapshot
```

The AI writes standard HTML with your ACSS classes. The converter handles the Bricks-specific transformation. Neither the AI nor you need to think about Bricks element JSON directly.

## Related

- [Convert commands reference](/cli/convert-commands/)
- [ACSS integration](/guides/acss-integration/) -- working with Automatic.css classes
- [Bring your own agent](/guides/bring-your-own-agent/) -- having AI write the HTML for you
