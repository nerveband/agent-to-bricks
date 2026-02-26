---
title: Managing tools
description: How to configure, launch, and register AI coding tools in the Agent to Bricks GUI, including LaunchDialog, AddToolDialog, flags, working directories, and system prompts.
---

The GUI ships with built-in definitions for the Bricks CLI plus three optional AI coding agents: Claude Code, Codex, and OpenCode. On startup, it checks whether each tool's command is available on your system. Bricks CLI is checked first as a required dependency; the app will not proceed without it. The optional agents are checked next; each shows as installed with its version number or "not found" with a red status dot.

## Built-in tools

| Tool | Command | Config path (Mac/Linux) | Config path (Windows) |
|---|---|---|---|
| Claude Code | `claude` | `~/.claude/settings.json` | `C:\Users\YourName\.claude\settings.json` |
| Codex | `codex` | `~/.config/codex/config.yaml` | `C:\Users\YourName\.config\codex\config.yaml` |
| OpenCode | `opencode` | `~/.config/opencode/config.json` | `C:\Users\YourName\.config\opencode\config.json` |

You do not need all three. Install whichever you prefer. The app works with any one of them.

## Launching a session

Click an installed tool in the sidebar. The **LaunchDialog** opens with three configuration fields:

### Working directory

The path where the tool will run. This determines where the AI agent looks for project files, writes output, and executes commands. You can type a path directly or click "Browse" to pick a folder through the native file dialog.

The working directory persists per tool. Set it once, and it sticks for future launches. You can also change it per-session later through the sidebar's context menu.

### Flags

Extra command-line flags passed to the tool when it starts. Enter them as you would in a terminal:

```
--verbose --dangerously-skip-permissions
```

Flags also persist per tool. They are saved alongside the working directory in the app's state.

### System context prompt

A template that gets sent to the tool when the session starts. It uses variable interpolation with curly braces:

- `{site_url}`: Your connected site's URL
- `{api_key}`: The site API key
- `{site_name}`: The display name you gave the site
- `{environment}`: The environment label (production, staging, or local)

The default template looks like this:

```
You are a web developer working with a Bricks Builder WordPress site ({environment}).
Site: {site_url}
API Key: {api_key}
The bricks CLI is available. Use `bricks` commands to pull, push, generate, and modify page elements.
Use the API key with the X-ATB-Key header when making API calls to the site.
```

The VariableEditor renders each `{variable}` as a colored pill. Click a pill to see its resolved value based on the currently active site. You can edit the template however you like: add project-specific instructions, remove variables you don't need, or rewrite it entirely.

Changes to the system prompt persist across sessions and are shared by all tools.

### Launching

Click "Launch" and the app creates a new session, spawns a PTY process running the tool's command with your flags, and switches the terminal panel to show its output. The system prompt (with variables resolved) is piped to the tool once the PTY is ready.

## Adding custom tools

Click the **+** button next to the "Tools" heading in the sidebar. The **AddToolDialog** opens with four fields:

| Field | Required | Description |
|---|---|---|
| Tool name | Yes | A display name. The app generates a slug from it (e.g., "Aider" becomes `aider`). |
| Launch command | Yes | The CLI command to run (e.g., `aider`). |
| Working directory | No | Default path for this tool. |
| Config file path | No | Where the tool stores its own config (shown in the Tools tab of Settings). |

After adding, the tool appears in the sidebar alongside the built-ins. It is treated identically: you can launch sessions, set flags, configure working directories, and use it with the prompt composer.

## Editing tool configuration

There are several ways to adjust a tool's settings after initial setup:

**Right-click context menu on any tool:**
- "Edit flags": Opens an inline text input below the tool in the sidebar. Type your flags and press Enter or click away to save.
- "Browse path...": Opens the native directory picker to set the working directory.
- "Type path": Opens an inline text input for manually entering a directory path. A small browse button sits next to it.
- "Settings": Jumps to the Settings dialog.

**Settings dialog (Tools tab):**
- Set the default tool (which one launches when you press `Cmd+N`)
- See all installed tools with their version numbers and install status

**LaunchDialog:**
- Every time you launch, you can adjust the working directory, flags, and system prompt before starting

## Tool detection

The app runs a three-phase detection sequence at startup:

1. **Environment detection.** Identifies your OS, CPU architecture, default shell, and any extra PATH directories (Homebrew, Cargo, Go, npm global, etc.).
2. **Bricks CLI (required).** Checked first. If missing, the app shows a blocking gate with installation options and a "Re-check" button. The app cannot proceed without it.
3. **Optional agents.** Claude Code, Codex, and OpenCode are scanned. Missing agents are reported but do not block the app.

Detection works across all major shells: bash, zsh, fish, PowerShell, Nushell, and cmd.exe. Each shell is invoked with its native syntax to resolve tool paths. If the shell-based check fails, a direct binary search is used as a fallback.

A real-time log shows each step as it runs, including the detected environment, per-tool results, and any errors. This log is visible during the loading screen and can be expanded from the Bricks CLI gate if the required dependency is missing.

If a tool becomes available after the app is already running (say you install Claude Code in another terminal), you will need to restart the app for it to pick up the change.

## Settings dialog

Open it from the sidebar's bottom "Settings" button or from any tool's context menu. It has five tabs:

**Site.** Configure your WordPress site connection. Enter the site URL and API key, test the connection, and save. This is where @mentions get their data from.

**Tools.** Pick your default tool and see the install status of all registered tools.

**Prompt.** Configure the system prompt template and default prompt settings.

**Theme.** Switch between dark and light mode. The selection persists in your config file.

**About.** Shows the app version and framework info (Tauri 2).
