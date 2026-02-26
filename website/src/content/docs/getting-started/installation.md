---
title: Installation
description: Install the plugin, CLI, and optional GUI
---

Agent to Bricks has three components: a WordPress plugin, a CLI binary, and an optional desktop GUI. You need the plugin and CLI at minimum. The GUI is for people who want a visual interface for managing AI agent sessions.

## System requirements

| Component | Requirement |
|-----------|-------------|
| WordPress | 6.0 or higher |
| PHP | 8.0 or higher |
| Bricks Builder | 1.9 or higher |
| Automatic.css | 3.x recommended (not required) |
| Frames | Optional, for component templates |

## 1. Install the WordPress plugin

Download `agent-to-bricks-plugin-X.X.X.zip` from the [latest GitHub release](https://github.com/nerveband/agent-to-bricks/releases/latest).

In your WordPress admin:

1. Go to **Plugins > Add New > Upload Plugin**
2. Upload the zip file and click **Install Now**
3. Activate the plugin

Then generate your API key:

1. Go to **Settings > Agent to Bricks**
2. Click **Generate API Key**
3. Copy the key somewhere safe. You'll need it to connect the CLI

The API key authenticates all requests from the CLI to your site. Keep it private.

## 2. Install the CLI

Download the binary for your platform from the [latest release](https://github.com/nerveband/agent-to-bricks/releases/latest):

| Platform | File |
|----------|------|
| Mac (Apple Silicon) | `agent-to-bricks_X.X.X_darwin_arm64.tar.gz` |
| Mac (Intel) | `agent-to-bricks_X.X.X_darwin_amd64.tar.gz` |
| Linux (x86_64) | `agent-to-bricks_X.X.X_linux_amd64.tar.gz` |
| Windows (x86_64) | `agent-to-bricks_X.X.X_windows_amd64.zip` |

### Mac and Linux

Extract the archive and move the binary into your PATH:

```bash
tar xzf agent-to-bricks_*.tar.gz
sudo mv bricks /usr/local/bin/
```

Verify it works:

```bash
bricks version
```

### Windows

1. Unzip the downloaded file
2. Move `bricks.exe` to a directory in your PATH (e.g., `C:\Users\YourName\bin\`)
3. Or add the extracted folder to your PATH environment variable

Open a new terminal and run:

```powershell
bricks version
```

### Build from source

If you prefer to compile it yourself, you'll need Go 1.22 or higher.

**Mac / Linux:**

```bash
cd cli
go build -o bricks .
sudo mv bricks /usr/local/bin/
```

Or use the Makefile (Mac / Linux only):

```bash
make build      # outputs to bin/bricks
make install    # copies to /usr/local/bin
```

**Windows (PowerShell):**

```powershell
cd cli
go build -o bricks.exe .
Move-Item bricks.exe C:\Users\YourName\bin\
```

## 3. Connect the CLI to your site

The fastest way is the interactive setup wizard:

```bash
bricks config init
```

It will prompt you for your site URL and the API key you copied from the plugin settings.

If you'd rather set values directly:

```bash
bricks config set site.url https://your-site.com
bricks config set site.api_key YOUR_API_KEY
```

This writes to `~/.agent-to-bricks/config.yaml`.

## 4. Verify the connection

```bash
bricks site info
```

You should see output like:

```
Site:       https://your-site.com
Bricks:     1.11.1
WordPress:  6.7.2
PHP:        8.2.27
Plugin:     1.2.0
```

If you get a connection error, double-check the URL (make sure it includes `https://`) and confirm the API key matches what's in your plugin settings.

## 5. Install the GUI (optional)

The desktop GUI is a Tauri app that manages AI coding agent sessions. Skip this if you only need the CLI.

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- [Rust](https://www.rust-lang.org/tools/install) (required by Tauri)
- At least one AI coding tool: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex](https://github.com/openai/codex), or [OpenCode](https://github.com/opencode-ai/opencode)

### Development mode

```bash
cd gui
npm install
npm run tauri dev
```

This launches the app with hot reload for development.

### Build a standalone app

```bash
cd gui
npm run tauri build
```

The compiled binary lands in `gui/src-tauri/target/release/bundle/`.

## Updating

The CLI can update itself and the plugin in one go:

```bash
bricks update              # update both CLI and plugin
bricks update --check      # check for updates without installing
bricks update --cli-only   # update just the CLI
```

## Next steps

With the plugin and CLI installed, head to the [Quick start](/getting-started/quick-start/) to pull your first page and generate content.
