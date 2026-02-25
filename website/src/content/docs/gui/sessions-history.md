---
title: Sessions and history
description: How to manage multiple AI tool sessions, switch between them, work with multiple sites, and use prompt history in the Agent to Bricks GUI.
---

Every time you launch a tool, the app creates a new session. Sessions are independent -- each one has its own terminal, PTY process, and scrollback buffer. You can run several at once and flip between them instantly.

## Session lifecycle

A session goes through two states:

- **Running** -- The PTY process is active. A pulsing green dot appears next to the session name in the sidebar. The status bar shows elapsed time.
- **Ended** -- The PTY process has exited (you typed `exit`, the tool finished, or the process was killed). The dot fades to muted gray. The terminal output remains visible and scrollable.

Sessions are created by clicking a tool in the sidebar (which opens the LaunchDialog) or pressing `Cmd+N` (which launches the default tool directly). Each session records:

- A unique ID
- Which tool it belongs to
- The command and arguments used to start it
- A timestamp for when it started
- An optional display name (defaults to the tool's name)

## Switching between sessions

Click any session in the sidebar to make it active. The terminal panel switches to show that session's output. Because each terminal instance is hidden rather than destroyed when inactive, you never lose scrollback -- switch away and come back to find everything where you left it.

The sidebar highlights the active session with the accent color. The status bar updates to show the corresponding tool name, version, and elapsed time.

## Renaming sessions

When you have multiple sessions of the same tool, it helps to give them descriptive names. Right-click a session and select "Rename". An inline text input appears below the session entry. Type a new name and press Enter (or click away) to save.

Names like "Homepage rebuild", "Staging deploy", or "Style cleanup" are more useful than three entries all called "Claude Code".

## Filtering sessions

Once you have more than three sessions, a search input appears at the top of the sessions list. Type to filter by display name or tool slug. This is a simple substring match -- type "claude" to see only Claude Code sessions, or part of your custom name to narrow things down.

## Closing sessions

Two ways to remove a session:

1. **Hover and click X** -- When you hover over a session in the sidebar, a small X button appears on the right side. Click it to close.
2. **Right-click and delete** -- The context menu has a "Delete" option (shown in red).

Closing a session removes it from the sidebar and discards its terminal output. If you close the active session, the app automatically switches to the next available one.

## Working directory per session

You can set a working directory at two levels:

- **Per tool** -- Set in the LaunchDialog or the tool's context menu. Every new session for that tool starts in this directory.
- **Per session** -- Right-click a running session and choose "Set working directory" to override the tool default for just that session.

The per-session directory is useful when you have one tool but multiple projects. Launch Claude Code for your main site, then launch another instance pointed at a different project folder.

## Multi-site support

The app supports multiple WordPress sites. Each site entry has:

- A display name
- A URL
- An API key
- An optional environment label (`production`, `staging`, or `local`)

### SiteSwitcher

The SiteSwitcher sits in the status bar at the bottom-left. It shows the active site's name with a green status dot. Click to open a dropdown listing all configured sites. Pick one to switch.

When you switch sites:
- The @mention cache clears, so new lookups hit the newly selected site
- The system prompt variables (`{site_url}`, `{api_key}`, etc.) resolve to the new site's values for subsequent launches
- Already-running sessions are not affected -- they keep whatever context they started with

If no sites are configured, the SiteSwitcher shows an "Add Site" button that opens the Settings dialog.

### Adding sites

You can add sites in two ways:

1. **Settings dialog** -- Go to Settings > Site, enter the URL and API key, and save.
2. **Command palette** -- Press `Cmd+P` and type something like `add site My Blog at https://myblog.com key atb_abc123`. The palette parses this natural-language command and creates the site entry.

### Environment labels

Each site can optionally have an environment label. This shows up in the `{environment}` variable in the system prompt. Use it to help the AI agent understand whether it is working on a live site (be careful) or a local dev instance (go wild).

## Prompt history

The app keeps a running history of your last 50 prompts. Every time you send a prompt -- whether from the PromptWorkshop or the CommandPalette -- it gets logged with:

- The raw text you typed
- The fully composed text (with resolved @mention context)
- A timestamp
- Which @mentions were included

### Viewing history

In the **PromptWorkshop** (context panel), toggle to the "History" tab. Prompts are listed newest-first with their text, timestamp, and mention count. Click any entry to reload its text into the editor.

In the **CommandPalette** (`Cmd+P`), recent prompts show automatically when the input is empty. Click one to load it.

### How history persists

Prompt history is saved to `~/.agent-to-bricks/config.yaml` alongside your other settings. It survives app restarts. The history caps at 50 entries -- the oldest drop off as new ones are added.

## Configuration persistence

All session-related settings are persisted automatically:

| Setting | Scope | Storage |
|---|---|---|
| Connected sites | Global | `~/.agent-to-bricks/config.yaml` |
| Active site index | Global | `~/.agent-to-bricks/config.yaml` |
| Tool flags | Per tool | App state (Jotai atoms) |
| Tool working directories | Per tool | App state (Jotai atoms) |
| Prompt history | Global | `~/.agent-to-bricks/config.yaml` |
| Custom presets | Global | `~/.agent-to-bricks/config.yaml` |
| Session pre-prompt | Global | `~/.agent-to-bricks/config.yaml` |
| Theme | Global | `~/.agent-to-bricks/config.yaml` |

Changes debounce for one second before writing to disk, so rapid edits do not hammer the filesystem.

The config file is written as JSON (which is valid YAML). The Go-based CLI reads the same file with its YAML parser, so both tools stay in sync.
