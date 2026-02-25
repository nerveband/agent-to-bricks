---
title: Roadmap
description: Planned features and what's coming next for Agent to Bricks
---

This is a rough map of where Agent to Bricks is headed. Nothing here is guaranteed or on a fixed timeline. Priorities shift based on community feedback, Bricks updates, and what AI tooling makes possible.

If something on this list matters to you, open an issue on GitHub and add your use case. That helps prioritize.

## In progress

**Template versioning.** Track changes to templates over time. Diff two versions. Roll back to a previous template version the same way you roll back page snapshots. This extends the snapshot model that already works for pages.

**Style profile improvements.** Better extraction of design patterns from existing pages. The current `bricks styles learn` command catches the basics, but it misses some nuances around responsive settings and breakpoint-specific styles.

## Planned

### Chrome extension

A browser extension that adds Agent to Bricks controls directly to the Bricks visual editor. Select an element in the editor, right-click, and modify it with AI. Preview changes in the editor before committing them.

The extension communicates with the same REST API the CLI uses. It's a different interface to the same backend. For people who like working in the browser but want AI assistance, this is the planned path.

### MCP transport

[Model Context Protocol](https://modelcontextprotocol.io/) support so AI tools like Claude Desktop can talk to your Bricks site without the CLI as an intermediary. The plugin would expose an MCP server that AI clients connect to directly.

This would let you use Agent to Bricks from Claude Desktop, Cursor, or any MCP-compatible tool without installing the CLI binary. The site context, class resolution, and element management would all be available as MCP tools.

### Embeddings search

Semantic search across your site's content using vector embeddings. Instead of keyword matching, you could search for "pages that have a dark hero section with pricing below it" and get meaningful results.

The embeddings would be generated from your element structure and text content, stored locally, and searched with cosine similarity. No external service required. This would make the `bricks search` command much more powerful for large sites.

### Server-side transforms

Right now, all HTML-to-Bricks conversion happens in the CLI on your local machine. Server-side transforms would move this to the plugin, so you could POST raw HTML to an endpoint and get Bricks elements back.

This simplifies integrations. A webhook, a Zapier action, or a custom script could send HTML to your site and get Bricks elements without anyone installing the CLI. It also opens the door for teams that can't install CLI tools on their machines.

### Bricks template export

Export your local template library as Bricks-native templates that import through the Bricks UI. This would let you share AI-generated sections with team members who don't use Agent to Bricks at all.

## Under consideration

These ideas are less defined. They might happen, might not, or might end up looking different than described here.

**Visual diff.** Side-by-side comparison of page states. Show what changed between two snapshots or between the current page and a proposed update. Probably a feature of the Chrome extension.

**Multi-site sync.** Push templates, classes, and style profiles from one site to another. Useful for agencies that maintain a base design system across multiple client sites.

**Bricks editor panel improvements.** The experimental panel inside the Bricks editor works but is limited. Better integration with the Bricks UI, element selection, and preview would make it more useful.

**Local generation.** Run LLM inference locally using Ollama or llama.cpp instead of sending prompts to a cloud API. For sites with sensitive content or strict data residency requirements.

**Bulk operations across multiple sites.** Run the same command against staging and production, or push a template update to ten client sites at once.

## What's not planned

**Hosted service.** Agent to Bricks runs on your machine and your WordPress site. There's no plan for a hosted version or cloud service.

**Proprietary AI model.** The project uses whatever LLM provider you configure. There's no custom model and no plan to train one.

**Premium tier.** Everything stays GPL-3.0 and free. No feature gating.

## How to influence the roadmap

The best way to move something up the priority list:

1. **Open a GitHub issue** describing what you'd use the feature for. Concrete use cases help more than +1s.
2. **Submit a pull request** if you've built something. Even a rough implementation of one of these ideas is worth discussing.
3. **Join the conversation** in existing issues. If someone has filed a feature request that matches your needs, add your perspective.

The project lives at [github.com/nerveband/agent-to-bricks](https://github.com/nerveband/agent-to-bricks).
