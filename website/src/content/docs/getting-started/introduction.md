---
title: Introduction
description: What is Agent to Bricks and who is it for
---

Agent to Bricks lets you build and manage [Bricks Builder](https://bricksbuilder.io/) pages without opening the visual editor. Write HTML, convert it to Bricks elements, push it to any page. All from the command line.

Two kinds of people end up here: Bricks users who want AI in their workflow, and developers who'd rather type commands than drag blocks around. Both get what they need.

## The three components

The project ships as three pieces that work together.

**The WordPress plugin** adds a REST API to your Bricks site. It reads and writes page content, manages snapshots, and exposes global classes, design tokens, templates, and media to external tools. It's the bridge between your WordPress database and the outside world.

**The CLI** is a standalone binary called `bricks`. It converts HTML to Bricks element JSON, generates content with AI, composes pages from templates, searches across your entire site, and handles snapshot rollbacks. Mac, Linux, Windows.

**The desktop GUI** wraps AI coding tools (Claude Code, Codex, OpenCode) in a native app with a prompt builder that autocompletes pages, classes, colors, and components from your site. It's optional. Everything the GUI does, the CLI can do too.

Use the plugin and CLI together. Add the GUI if you want a visual interface. Or point an AI agent at the CLI and let it build pages on its own.

## Who this is for

**Bricks Builder users** who want to move faster. If you've ever spent an afternoon clicking through the visual editor to build a landing page, the CLI can do that same work in a few commands. Pull a page, generate a hero section with AI, push it back.

**Developers and agencies** managing multiple Bricks sites. The CLI's config supports multiple site profiles, so you can push templates across staging and production environments without opening a browser.

**AI agents and coding assistants.** The `bricks agent context` command outputs your site's full design system -- every CSS class, design token, and template -- in a format LLMs can consume directly. An AI agent with shell access can read your site, generate pages that match your design system, and push them live.

## Core concepts

A few things to understand before diving in.

### Elements

Bricks stores page content as a JSON tree. Each node is an **element** with a type (section, heading, image, button), settings that control its appearance, and parent/child relationships that define the layout hierarchy. When you pull a page with the CLI, you get this tree as JSON. When you push, you send it back.

### Global classes

Bricks has a registry of CSS classes that live at the site level, not on individual pages. If your site uses Automatic.css (ACSS), those utility classes (`section--l`, `text--primary`, `bg--primary-dark`) are all registered as global classes. The CLI resolves class names in your HTML to global class IDs automatically during conversion.

### Snapshots

Before the CLI modifies a page, it can save the current state as a **snapshot**. If the AI generates something you don't like, or a push goes wrong, you roll back to the snapshot. It takes one command. Always use the `--snapshot` flag when pushing content.

### Templates

The CLI includes a local template library. You can import templates from files, learn them from existing pages on your site, search by description, and compose multiple templates into a single page. A template is just a reusable chunk of Bricks elements with a name and some metadata.

### Design tokens

If your site uses ACSS or another token-based CSS framework, the CLI can read those tokens -- spacing values, color variables, font sizes -- and pass them to AI generation so the output matches your design system. The `bricks styles variables` command shows what's available.

## What's next

Head to [Installation](/getting-started/installation/) to set up the plugin and CLI, then follow the [Quick start](/getting-started/quick-start/) to build your first page from the terminal.
