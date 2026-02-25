---
title: Philosophy
description: Why Agent to Bricks exists and what it's trying to be
---

I built Agent to Bricks because I kept watching the same thing happen.

A new AI tool for WordPress would launch. It looked good in the demo video. Then you'd see the pricing page: $29/month, $49/month, $99/month for the "agency" tier. On top of your hosting. On top of Bricks Builder. On top of ACSS. On top of Frames. The costs stack, and they never stop stacking.

Some tools offered lifetime deals. I bought a few. Half of them stopped getting meaningful updates within a year. The other half pivoted to something else. Plugin fatigue is real, and LTD fatigue might be worse.

## What I wanted instead

Bricks Builder has a clean, well-structured element system. Global classes. Design tokens. A JSON data model that's actually readable. It's one of the few page builders where the underlying architecture is good enough to build real tooling on top of.

I wanted AI tools that matched the quality of Bricks itself. Tools that understood the data model, respected the class system, and worked with the design tokens already on your site. And I didn't want to pay a monthly fee for what amounts to "API call + some prompting."

So I built a CLI that does it all for free.

## The approach

Agent to Bricks is three things:

1. **A WordPress plugin** that adds a REST API to your Bricks site. Read elements, write elements, manage classes, search across pages. It's the bridge between your site and external tools.

2. **A CLI** that talks to that API. It handles HTML conversion, AI generation, template composition, cross-site search, and everything else. It runs on your machine with your API keys.

3. **A desktop GUI** that wraps the CLI in a visual interface. It adds @mention prompting, preset workflows, and multi-session management. It's optional -- some people prefer the terminal.

The design principle: your machine, your keys, your workflow. No cloud service in the middle. No usage tracking. No subscription.

## On "bring your own agent"

I didn't want to build another AI coding tool. There are already good ones: Claude Code, Codex, OpenCode, and whatever comes next. What was missing was the Bricks-specific layer -- the part that understands elements, classes, tokens, and how to push changes back to WordPress.

Agent to Bricks provides that layer. You bring whatever AI tool you prefer. The CLI gives it the context and commands it needs to work with your site.

## On open source

This project is GPL-3.0 and will stay that way. I don't have a business model for it. I don't plan to add a "pro" tier or gate features behind a paywall.

My honest hope is that Bricks Builder eventually ships native AI tools that are better than what I've built here. When that happens, this project can quietly retire. Until then, this is my contribution to the community.

-- Ashraf Ali
