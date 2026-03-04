---
title: Installation
description: Install the plugin, CLI, and optional GUI
---

Agent to Bricks has three components: a **WordPress plugin** (required), a **Desktop App**, and a **CLI**. You only need the plugin plus whichever client fits your workflow:

- **Desktop App only** — If you want a visual interface for managing AI agent sessions (Claude Code, Codex, etc.). No terminal needed.
- **CLI only** — If you prefer the terminal for page operations, HTML conversion, search, and templates.
- **Both** — Install both for maximum flexibility. They share the same config and connect to the same plugin.

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

## 2. Install the Desktop App (optional)

The Desktop App is a visual session manager for AI coding tools (Claude Code, Codex, etc.). Download the installer for your platform from the [latest release](https://github.com/nerveband/agent-to-bricks/releases/latest):

| Platform | File |
|----------|------|
| Mac (Apple Silicon) | `Agent.to.Bricks_X.X.X_aarch64.dmg` |
| Mac (Intel) | `Agent.to.Bricks_X.X.X_x64.dmg` |
| Windows | `Agent.to.Bricks_X.X.X_windows_x64-setup.exe` |
| Windows (MSI) | `Agent.to.Bricks_X.X.X_windows_x64_en-US.msi` |
| Linux (deb) | `Agent.to.Bricks_X.X.X_amd64.deb` |
| Linux (AppImage) | `Agent.to.Bricks_X.X.X_amd64.AppImage` |

### macOS

1. Download the `.dmg` file for your chip (Apple Silicon = `aarch64`, Intel = `x64`)
2. Open the DMG and drag **Agent to Bricks** into your Applications folder
3. On first launch, macOS may show a Gatekeeper warning — right-click the app and choose **Open** to bypass it

### Windows

1. Download the `.exe` installer (or `.msi` for enterprise deployment)
2. Run the installer — it installs to `C:\Program Files\Agent to Bricks\`
3. Launch from the Start Menu

### Linux

```bash
# Debian/Ubuntu
sudo dpkg -i Agent.to.Bricks_*.deb

# Or use the AppImage (no install needed)
chmod +x Agent.to.Bricks_*.AppImage
./Agent.to.Bricks_*.AppImage
```

The app checks for updates automatically. You do not need the CLI installed to use the Desktop App — it connects directly to the plugin REST API.

## 3. Install the CLI (optional)

The CLI is a terminal tool for page operations, search, HTML conversion, and templates. Download the **CLI binary** for your platform from the [latest release](https://github.com/nerveband/agent-to-bricks/releases/latest):

:::note
The CLI files are named `agent-to-bricks_X.X.X_...` (lowercase with underscores). The Desktop App files are named `Agent.to.Bricks_X.X.X_...` (title case with dots). Make sure you download the right one.
:::

| Platform | File |
|----------|------|
| Mac (Apple Silicon) | `agent-to-bricks_X.X.X_darwin_arm64.tar.gz` |
| Mac (Intel) | `agent-to-bricks_X.X.X_darwin_amd64.tar.gz` |
| Linux (x86_64) | `agent-to-bricks_X.X.X_linux_amd64.tar.gz` |
| Windows (x86_64) | `agent-to-bricks_X.X.X_windows_amd64.zip` |

### macOS

Extract the archive and move the binary somewhere in your PATH:

```bash
tar xzf agent-to-bricks_*.tar.gz

# Apple Silicon (Homebrew default)
mv bricks /opt/homebrew/bin/

# Intel Mac
mv bricks /usr/local/bin/
```

Verify it works:

```bash
bricks version
```

### Linux

```bash
tar xzf agent-to-bricks_*.tar.gz
mkdir -p ~/.local/bin
mv bricks ~/.local/bin/
```

Make sure `~/.local/bin` is in your PATH. Most distros include it by default, but if not:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Windows

1. Unzip `agent-to-bricks_X.X.X_windows_amd64.zip` (this is the CLI, not the Desktop App)
2. Move `bricks.exe` to a directory in your PATH, for example:

```powershell
# Create a bin folder if it doesn't exist
New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\Programs\bricks"
Move-Item bricks.exe "$env:LOCALAPPDATA\Programs\bricks\"

# Add to PATH (persistent, current user only)
$binDir = "$env:LOCALAPPDATA\Programs\bricks"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
}
```

Open a **new** terminal and run:

```powershell
bricks version
```

### Build from source

If you prefer to compile it yourself, you'll need Go 1.22 or higher.

**Mac / Linux:**

```bash
make build      # outputs to bin/bricks
make install    # auto-detects best install dir, no sudo needed
```

Or manually:

```bash
cd cli
go build -o bricks .
mv bricks ~/.local/bin/    # Linux
mv bricks /opt/homebrew/bin/  # macOS (Apple Silicon)
```

**Windows (PowerShell):**

```powershell
cd cli
go build -o bricks.exe .
Move-Item bricks.exe "$env:LOCALAPPDATA\Programs\bricks\"
```

## 4. Connect to your site

**Desktop App:** Open the app, click the site switcher in the bottom status bar, then "Add Site". Enter your site URL and the API key from step 1.

**CLI:** Run the interactive setup wizard:

```bash
bricks config init
```

It will prompt you for your site URL and the API key you copied from the plugin settings.

Or set values directly:

```bash
bricks config set site.url https://your-site.com
bricks config set site.api_key YOUR_API_KEY
```

Both the Desktop App and CLI write to `~/.agent-to-bricks/config.yaml` and share the same site configuration.

## 5. Verify the connection

**Desktop App:** The status bar shows a green dot and your site name when connected. Open Settings > About to confirm the plugin version.

**CLI:**

```bash
bricks site info
```

You should see output like:

```
Site:       https://your-site.com
Bricks:     1.11.1
WordPress:  6.7.2
PHP:        8.2.27
Plugin:     1.8.0
```

If you get a connection error, double-check the URL (make sure it includes `https://`) and confirm the API key matches what's in your plugin settings.

## Updating

The CLI can update itself and the plugin in one go:

```bash
bricks update              # update both CLI and plugin
bricks update --check      # check for updates without installing
bricks update --cli-only   # update just the CLI
```

## Next steps

With the plugin and CLI installed, head to the [Quick start](/getting-started/quick-start/) to pull your first page and generate content.
