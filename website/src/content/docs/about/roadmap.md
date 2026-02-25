---
title: Roadmap
description: What's coming next for Agent to Bricks
---

This is a rough list of what's planned. Priorities shift based on community feedback, so nothing here is a guarantee. If something on this list matters to you, open an issue on GitHub and say so -- it helps with prioritization.

## In progress

**Template versioning** -- Track changes to templates over time. Diff two versions. Roll back to a previous template version the same way you roll back page snapshots.

**Style profile improvements** -- Better extraction of patterns from existing pages. The current `bricks styles learn` command catches the basics, but it misses some nuances around responsive settings and breakpoint-specific styles.

## Planned

**Chrome extension** -- A browser extension that adds Agent to Bricks controls to the Bricks visual editor. Select elements in the editor, right-click, and send them to an AI tool for modification. The extension would communicate with the CLI running locally.

**MCP transport** -- Support for the Model Context Protocol as a transport layer. Instead of the CLI calling the REST API directly, it would expose an MCP server that AI tools can connect to natively. This would simplify the integration with Claude Code and other MCP-aware tools.

**Embeddings-based search** -- Semantic search across your site's content and structure. Instead of filtering by element type or class name, you'd search by description: "find sections that look like pricing tables" or "find all hero sections with dark backgrounds." Requires a local embedding model or an API call.

**Server-side transforms** -- The plugin already has a `/transform` endpoint that can proxy LLM calls. The plan is to expand this so the plugin can run AI transforms without needing the CLI at all. This would let teams run AI operations from the WordPress admin, which is useful for people who can't install CLI tools.

**Bricks template export** -- Export your local template library as Bricks-native templates that you can import through the Bricks UI. This would let you share AI-generated sections with team members who don't use Agent to Bricks.

## Ideas (no timeline)

- Visual diff for page changes (before/after comparison)
- Bulk operations across multiple sites
- Integration with popular deployment workflows (WP Engine, Flywheel, Cloudways)
- Template marketplace where people share templates
- Real-time collaboration (multiple agents working on different pages)

## How to influence the roadmap

The best way to get something built is to open a GitHub issue with:
- What you're trying to do
- Why the current tools don't solve it
- How you'd expect it to work

Feature requests with concrete use cases move faster than abstract suggestions.
