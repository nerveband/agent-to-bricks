---
title: GUI overview
description: What the Agent to Bricks desktop app is, how to install it, and how to get it running on your machine.
---

The Agent to Bricks GUI is a desktop application built with [Tauri 2](https://v2.tauri.app/), React, and TypeScript. It gives you a visual way to manage AI coding agent sessions that interact with your Bricks Builder sites. Instead of juggling terminal windows and remembering CLI flags, you get a single interface where your tools, sites, and prompts live together.

## What it does

The app wraps AI coding tools -- Claude Code, Codex, OpenCode, or any CLI tool you add -- in managed terminal sessions. You pick a tool, configure it, and launch. The app handles the PTY (pseudo-terminal) connection, streams output in real time, and lets you switch between multiple running sessions.

On top of that, the prompt composer lets you write prompts that reference your actual site objects. Type `@page` and the app pulls your real pages from the WordPress REST API. That context gets injected into the prompt before it reaches the AI tool, so the agent knows exactly which page, section, or class you mean.

Here is what you get:

- **Managed terminal sessions** for each AI tool, with scrollback preserved when you switch between them
- **@mention autocomplete** that queries your live Bricks site for pages, sections, classes, colors, components, and media
- **Prompt presets** for common workflows like generating sections, pulling pages, and converting HTML
- **Multi-site switching** so you can work across production, staging, and local environments
- **Persistent configuration** saved to `~/.agent-to-bricks/config.yaml` and shared with the CLI

## Prerequisites

Before you run the GUI, make sure you have:

- **Node.js 18** or newer
- **Rust** (stable toolchain) -- Tauri needs this to compile the native shell
- **At least one AI coding tool** installed globally. The app auto-detects Claude Code (`claude`), Codex (`codex`), and OpenCode (`opencode`). You can also register your own.
- **A Bricks Builder site** with the Agent to Bricks WordPress plugin installed and an API key generated. This is optional for basic use, but @mentions and site context won't work without it.

## Running the app

Clone the repository, then:

```bash
cd gui
npm install
npm run tauri dev
```

The first run takes a few minutes while Rust compiles the Tauri backend. After that, hot-reload kicks in for the React frontend -- changes appear immediately.

For a production build:

```bash
npm run tauri build
```

This produces a platform-native binary (`.app` on macOS, `.msi` on Windows, `.deb`/`.AppImage` on Linux).

## First launch

When you open the app for the first time, onboarding tooltips walk you through the main areas: the tool list, the prompt builder, the command palette shortcut, and the site switcher. You can skip these or step through them at your own pace. They won't appear again after you finish or dismiss them.

If no AI tools are detected on your system, the sidebar will show them as "not found" with installation instructions. Get at least one installed, restart the app, and you are ready to go.

## Configuration file

The GUI reads and writes `~/.agent-to-bricks/config.yaml`. This is the same file the CLI uses, so settings stay in sync. The file stores:

- Connected sites (name, URL, API key)
- Active site index
- Theme preference (dark or light)
- Custom prompt presets
- Prompt history (last 50 entries)
- Session pre-prompt template
- Onboarding state

Changes are auto-saved with a one-second debounce. You do not need to manually save or export anything.
