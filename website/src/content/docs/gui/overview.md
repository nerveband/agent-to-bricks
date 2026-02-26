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

- **Bricks CLI** (`bricks`) installed and on your PATH. This is a **hard requirement** -- the app will not start without it. See [Installation](/getting-started/installation/) for setup options.
- **Node.js 18** or newer
- **Rust** (stable toolchain) -- Tauri needs this to compile the native shell
- **At least one AI coding tool** installed globally. The app auto-detects Claude Code (`claude`), Codex (`codex`), and OpenCode (`opencode`). You can also register your own. These are optional -- the app works without them but you won't be able to run agent sessions.
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

When the app opens it runs a startup detection sequence. You will see a real-time log showing:

1. **Environment detection** -- your OS, architecture, shell type, and augmented PATH directories.
2. **Bricks CLI check** -- the required dependency is checked first. If it is not found, the app shows a blocking gate with installation instructions (Go install or website download). You must install Bricks CLI and click "Re-check" before the app will proceed.
3. **Optional agent scan** -- Claude Code, Codex, and OpenCode are checked. Missing agents are reported but do not block the app.

The detection system supports all major shells (bash, zsh, fish, PowerShell, Nushell, cmd.exe) and augments the search PATH with common tool directories so that CLI tools installed via Homebrew, Cargo, Go, npm, and other package managers are found even when the app is launched outside a terminal.

After detection, onboarding tooltips walk you through the main areas: the tool list, the prompt builder, the command palette shortcut, and the site switcher. You can skip these or step through them at your own pace. They won't appear again after you finish or dismiss them.

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
