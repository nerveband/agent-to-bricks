---
title: Bring your own agent
description: How to connect Claude Code, Codex, or any AI coding tool to your Bricks site using the agent context system
---

Agent to Bricks doesn't lock you into a specific AI tool. The CLI exports your site's full design system as a system prompt that any LLM can understand. You feed it to Claude Code, Codex, OpenCode, or a custom agent, and the AI can read your site, generate matching pages, and push them live.

## The agent context command

The command that makes this work:

```bash
bricks agent context --format prompt
```

This calls your site's API, pulls down the global classes, design tokens, templates, element types, and site info, then assembles it into a system prompt. The output tells the AI:

- What Bricks version you're running
- What ACSS utility classes are available and what they do
- What Frames component classes exist
- What design tokens (colors, spacing, typography) are set up
- What templates are in the library
- How to use the CLI commands to convert HTML and push pages

Three output formats are available:

| Format | Use case |
|--------|----------|
| `--format prompt` | Complete system prompt ready to paste or pipe into an AI tool |
| `--format markdown` | Structured markdown document (good for reference or embedding in a CLAUDE.md file) |
| `--format json` | Machine-readable JSON (good for programmatic consumption) |

You can also pull individual sections:

```bash
bricks agent context --section tokens     # Just design tokens
bricks agent context --section classes     # Just class lists
bricks agent context --section templates   # Just templates
bricks agent context --section workflows   # Just CLI workflow instructions
```

## Setting up Claude Code

Claude Code is probably the best fit because it has shell access and can run CLI commands directly.

### 1. Generate the context

```bash
bricks agent context --format markdown > BRICKS_CONTEXT.md
```

### 2. Add it to your project's CLAUDE.md

If you have a `CLAUDE.md` file in your project root (Claude Code reads this automatically), append the context:

```bash
cat BRICKS_CONTEXT.md >> CLAUDE.md
```

Or create a dedicated instructions file:

```bash
bricks agent context --format prompt > .claude/bricks-system-prompt.md
```

### 3. Start Claude Code and tell it what to build

```bash
claude
```

Then in the conversation:

> Build a landing page for a SaaS product called "Flowboard". It needs a hero section with a headline, subtext, and two CTA buttons. Then a 3-column feature grid. Then a testimonial slider. Then a CTA banner. Push it to page 42.

Claude Code will use the system prompt context to write HTML with your ACSS classes, run `bricks convert html`, and push the result to your page.

### Example session

Here's what the interaction looks like in practice:

```
You: Create an about page for page 58. Use the company name "Archway Digital".
     Include a hero with tagline, team grid (4 members), values section, and CTA.

Claude: I'll create the about page. Let me first check what's on page 58 and review
        the available design tokens.

        > bricks site info
        > bricks styles variables
        > bricks classes list --framework acss | head -30

        Now I'll write the HTML using your ACSS classes and push it:

        > cat <<'EOF' > /tmp/about-page.html
        <section class="section--l bg--white">
          <div class="container grid--2">
            <div>
              <h1 class="text--xxl">We're Archway Digital</h1>
              <p class="text--l text--secondary">Building bridges between ideas and execution since 2019.</p>
            </div>
            <div>
              <img src="/team-photo.jpg" alt="The Archway Digital team" class="img--rounded" />
            </div>
          </div>
        </section>
        ...
        EOF

        > bricks convert html /tmp/about-page.html --push 58 --snapshot

        Done. The page has 4 sections with 28 elements. I created a snapshot before
        pushing in case you want to roll back.
```

## Setting up Codex

OpenAI's Codex CLI works similarly. It has shell access and can run commands.

### 1. Create a system prompt file

```bash
bricks agent context --format prompt > codex-bricks-prompt.txt
```

### 2. Set up your Codex instructions

Add to your Codex configuration or pass it at startup. The prompt file contains everything Codex needs: available classes, tokens, templates, and CLI commands.

### 3. Start Codex

```bash
codex --instructions codex-bricks-prompt.txt
```

Then give it the same kind of natural language instructions.

## Setting up a custom agent

Any tool that can make HTTP requests or run shell commands can work. The key pieces:

### Option A: Shell access

If your agent can run shell commands, give it the system prompt and let it use the CLI directly:

```bash
# Agent reads the site
bricks site info
bricks classes list
bricks styles variables

# Agent writes HTML
echo '<section class="section--l">...</section>' > /tmp/page.html

# Agent converts and pushes
bricks convert html /tmp/page.html --push 42 --snapshot
```

### Option B: HTTP only

If your agent can only make HTTP requests, it can call the REST API directly:

```bash
# Read page content
GET /wp-json/agent-bricks/v1/pages/42/elements

# Generate with AI
POST /wp-json/agent-bricks/v1/generate
{
  "prompt": "Add a testimonial section",
  "postId": 42,
  "mode": "section"
}

# Push elements
POST /wp-json/agent-bricks/v1/pages/42/elements
{
  "elements": [...],
  "parentId": "root_container_id"
}
```

See the [REST API reference](/plugin/rest-api/) for every endpoint.

## Context sections explained

The system prompt from `bricks agent context --format prompt` has these sections:

### Rules

Instructions for the AI on how to write HTML for Bricks conversion. Use ACSS utility classes, semantic HTML, `<section>` wrappers, descriptive alt text, etc.

### Available Design Tokens

ACSS tokens from your site: color values, spacing scale, font families, root font size. The AI uses these to write CSS variable references like `var(--primary)` and `var(--space-m)`.

### Utility Classes (ACSS)

Every ACSS class registered on your site, grouped by category: layout, spacing, typography, colors, backgrounds, borders. The AI picks from these instead of writing custom CSS.

### Component Classes (Frames)

If you have Frames installed, the component classes (prefixed `fr-`, `btn--`, etc.) are listed here. These map to pre-built UI patterns.

### Templates

Your template library, grouped by category. The AI can reference these by slug when using `bricks templates compose`.

### Workflows

Three recommended approaches:
1. **HTML Convert** -- write HTML, convert with the CLI, push
2. **Template Compose** -- search templates, compose them into a page
3. **AI Generate** -- use the `/generate` endpoint for rapid prototyping

## Tips for better results

**Be specific about structure.** "Add a hero section" is vague. "Add a hero section with an H1 headline, a paragraph of subtext, and two side-by-side buttons (primary and outline)" gives the AI something concrete to build.

**Reference your tokens.** If you mention "use the primary color" or "medium spacing," the AI will map those to your actual ACSS tokens. The context tells it what `--primary` and `--space-m` resolve to.

**Use the `--compact` flag for smaller contexts.** If your site has hundreds of classes and the context is too long for your LLM's window:

```bash
bricks agent context --format prompt --compact
```

This uses shorter notation (comma-separated lists instead of bullet points) and reduces the token count.

**Pipe context directly.** Some tools accept stdin:

```bash
bricks agent context --format prompt | your-agent-tool --system-prompt -
```
