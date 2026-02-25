---
title: Generate commands
description: Use AI to generate Bricks sections, full pages, or modify existing content from plain English descriptions.
---

The `bricks generate` commands let you describe what you want in plain English and get Bricks elements back. They work with OpenAI, Anthropic, Cerebras, or any OpenAI-compatible provider.

You'll need an LLM configured before these commands will do anything. See [Config and update](/cli/config-update/) for setup.

## Prerequisites

Set up your LLM provider first:

```bash
bricks config set llm.provider openai
bricks config set llm.api_key sk-proj-abc123...
bricks config set llm.model gpt-4o
```

Supported providers: `openai`, `anthropic`, `cerebras`, or any provider with an OpenAI-compatible API (set `llm.base_url` for custom endpoints).

## Generate a section

Create a single section from a description.

```bash
bricks generate section "<prompt>" --page <page-id>
```

### Flags

| Flag | Description |
|------|-------------|
| `--page <id>` | Target page ID (the section gets appended to this page) |
| `--dry-run` | Show what would be generated without pushing anything |

### Examples

```bash
bricks generate section "dark hero with a headline, subtitle, and two CTA buttons" --page 1460
```

```
Generating section for page 1460...
Created 6 elements:
  section (dark background)
  └─ container
     ├─ heading (h1): "Transform Your Digital Presence"
     ├─ text-basic: "Build faster, ship smarter, grow without limits."
     └─ div (button group)
        ├─ button: "Get Started"
        └─ button: "Learn More" (outline)

Pushed to page 1460
```

Preview without pushing:

```bash
bricks generate section "testimonial grid with 3 cards" --dry-run
```

The `--dry-run` flag outputs the generated JSON so you can inspect it, tweak it, or pipe it elsewhere.

## Generate a full page

Build an entire page layout from a description.

```bash
bricks generate page "<prompt>" --page <page-id>
```

### Flags

| Flag | Description |
|------|-------------|
| `--page <id>` | Target page ID (existing content gets replaced) |
| `--dry-run` | Preview the generated output without pushing |

### Example

```bash
bricks generate page "SaaS landing page with hero, features grid, pricing table, and footer" --page 1460
```

```
Generating page for page 1460...
Created 42 elements across 4 sections:
  section: Hero
  section: Features (3-column grid)
  section: Pricing (3 tiers)
  section: Footer

Pushed to page 1460
```

This replaces everything on the target page. Take a snapshot first if you want a way back:

```bash
bricks site snapshot 1460 -l "before AI generation"
bricks generate page "SaaS landing page with pricing" --page 1460
```

## Modify existing content

Change what's already on a page using natural language.

```bash
bricks generate modify "<prompt>" --page <page-id>
```

### Flags

| Flag | Description |
|------|-------------|
| `--page <id>` | Page to modify |
| `--dry-run` | Preview changes without applying them |

### Examples

Change specific text:

```bash
bricks generate modify "change the hero headline to 'Welcome to Acme'" --page 1460
```

```
Modified 1 element on page 1460:
  heading (abc123): "Transform Your Digital Presence" → "Welcome to Acme"
```

Adjust styling:

```bash
bricks generate modify "make all section backgrounds darker and increase heading sizes" --page 1460
```

Restructure layout:

```bash
bricks generate modify "convert the features section from a 2-column to a 3-column grid" --page 1460
```

The modify command pulls the current page content, sends it to the LLM along with your prompt, and pushes the modified result back. It handles the content hash automatically.

## Tips for better prompts

Be specific about what you want. Vague prompts get vague results.

**Works well:**
```bash
bricks generate section "pricing table with 3 tiers: Starter at $9/mo, Pro at $29/mo, Enterprise at $99/mo. Each tier shows 4 features. Dark background, white text." --page 1460
```

**Too vague:**
```bash
bricks generate section "a nice pricing section" --page 1460
```

Reference your site's design system if you know it. The generate commands pull context from your site automatically, but explicit references help:

```bash
bricks generate section "hero using ACSS section--l spacing, bg--primary-dark, with fr-hero component styling" --page 1460
```

## How it works under the hood

1. The CLI calls `bricks agent context` internally to gather your site's design tokens, global classes, and available element types
2. It builds a system prompt with that context plus your description
3. It sends the prompt to your configured LLM
4. The LLM returns HTML using your site's actual class names and CSS variables
5. The CLI converts that HTML to Bricks elements (same as `bricks convert html`)
6. The elements get pushed to the target page

This means generate commands produce the same output format as `bricks convert html`. If you'd rather write your own HTML and skip the LLM, the convert command does the same thing without the AI step.

## Related commands

- [`bricks agent context`](/cli/agent-commands/) -- see what context the LLM receives
- [`bricks convert html`](/cli/convert-commands/) -- convert HTML manually without AI
- [`bricks site snapshot`](/cli/site-commands/) -- save a restore point before generating
- [`bricks config set`](/cli/config-update/) -- configure your LLM provider
