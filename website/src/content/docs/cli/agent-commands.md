---
title: Agent commands
description: Export your site's full design context for AI agents -- classes, tokens, templates, and element rules.
---

The `bricks agent context` command gathers your entire site's design system into a single output that AI agents can use as a reference. It pulls global classes, CSS custom properties, design tokens, templates, element types, and conversion rules into one document.

This is the command that makes AI agents effective with your specific site. Without it, an agent has to guess at class names and token values. With it, the agent writes markup that matches your design system from the start.

## Basic usage

```bash
bricks agent context
```

By default, this prints a formatted system prompt to stdout -- the kind of thing you'd paste into a Claude Code or Codex session.

## Flags

| Flag | Description |
|------|-------------|
| `--format <type>` | Output format: `prompt` (default) or `json` |
| `--compact` | Shorter output with less detail |
| `--section <name>` | Only output a specific section: `classes` or `tokens` |
| `-o <file>` | Write output to a file |

## Full context as a system prompt

```bash
bricks agent context --format prompt
```

```
# Agent to Bricks — Site Context

You are working with a Bricks Builder site at https://example.com.
Bricks 1.11.1 / WordPress 6.5.2 / PHP 8.2.18
Frameworks: Automatic.css 3.0.2, Frames 2.2.0

## CSS Global Classes (186 total)

### ACSS Utilities
- section--s → padding-block: var(--section-space-s)
- section--m → padding-block: var(--section-space-m)
- section--l → padding-block: var(--section-space-l)
- bg--primary → background-color: var(--primary)
- bg--primary-dark → background-color: var(--primary-dark)
- text--white → color: var(--white)
- text--primary → color: var(--primary)
- fw--700 → font-weight: 700
- grid--auto-3 → grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))
- gap--m → gap: var(--space-m)
...

### Frames Components
- fr-hero → (14 properties)
- fr-lede → (6 properties)
- btn--primary → (8 properties)
- btn--outline → (6 properties)
...

## Design Tokens

### Colors
- --primary: #3B82F6
- --primary-dark: #1D4ED8
- --white: #FFFFFF
...

### Spacing
- --space-s: clamp(0.5rem, ...)
- --space-m: clamp(1rem, ...)
- --space-l: clamp(1.5rem, ...)
...

### Typography
- --h1: clamp(2.5rem, ...)
- --h2: clamp(2rem, ...)
- --body: clamp(1rem, ...)
...

## HTML Conversion Rules

- Use <section> as top-level containers
- Use CSS class names directly; they resolve to global class IDs
- Use var(--token-name) in inline styles
- Nesting determines parent/child relationships
...
```

This is typically 2,000-4,000 lines depending on how many classes and tokens your site has.

## Compact output

```bash
bricks agent context --compact
```

A condensed version that hits the key points without exhaustive listings. Useful when your LLM has a smaller context window or when you want to save on tokens.

## JSON format

```bash
bricks agent context --format json
```

```json
{
  "site": {
    "url": "https://example.com",
    "bricks_version": "1.11.1",
    "wordpress_version": "6.5.2"
  },
  "classes": [
    {
      "id": "acss_import_section__l",
      "name": "section--l",
      "framework": "acss",
      "properties": { "padding-block": "var(--section-space-l)" }
    }
  ],
  "tokens": {
    "colors": { "--primary": "#3B82F6" },
    "spacing": { "--space-m": "clamp(1rem, ...)" },
    "typography": { "--h1": "clamp(2.5rem, ...)" }
  },
  "templates": [],
  "element_types": ["section", "container", "div", "heading", "text", "button"]
}
```

JSON format is better for programmatic consumption -- when you're building a custom tool that reads the context rather than feeding it directly to an LLM.

## Export a single section

Grab only classes or only tokens if that's all you need.

```bash
bricks agent context --section classes
```

```bash
bricks agent context --section tokens
```

## Save to a file

```bash
bricks agent context --format prompt -o site-context.md
```

```bash
bricks agent context --format json -o site-context.json
```

Save the context and load it into your AI tool of choice. This is how you'd set up a Claude Code session or feed context to Codex:

```bash
# Generate the context file
bricks agent context --format prompt -o context.md

# Use it as a system prompt in Claude Code
claude --system-prompt context.md
```

## When to use this

**Starting a new AI session.** Run `bricks agent context` at the beginning of every session so the agent knows your site's design system. Without this context, the agent will generate generic HTML that may not match your ACSS tokens or Frames components.

**Debugging generated output.** If AI-generated sections look wrong, check whether the context includes the classes and tokens you expected. Run `bricks agent context --section classes` to verify.

**Sharing context across tools.** Save the JSON output and load it into multiple AI tools, scripts, or custom pipelines.

## Related commands

- [`bricks styles variables`](/cli/style-commands/) -- the tokens that appear in agent context
- [`bricks classes list`](/cli/class-commands/) -- the classes that appear in agent context
- [`bricks generate section`](/cli/generate-commands/) -- uses agent context internally
- [`bricks site frameworks`](/cli/site-commands/) -- framework info included in context
