---
title: Config and update
description: Set up your site connection, configure LLM providers, and keep the CLI and plugin up to date.
---

The `bricks config` commands manage your connection settings and LLM configuration. The `bricks update` and `bricks version` commands handle self-updates and version info.

Configuration lives in `~/.agent-to-bricks/config.yaml`.

## Interactive setup

The fastest way to get started. Walks you through site URL, API key, and optional LLM configuration.

```bash
bricks config init
```

```
Agent to Bricks — Configuration

Site URL: https://example.com
API Key: ********-****-****-****-************

Testing connection... ✓ Connected
  Bricks 1.11.1 / WordPress 6.5.2 / PHP 8.2.18

Configure LLM provider? (y/n): y
Provider (openai/anthropic/cerebras): openai
API Key: sk-proj-...
Model (default: gpt-4o): gpt-4o

Configuration saved to ~/.agent-to-bricks/config.yaml
```

You can re-run `bricks config init` any time to reconfigure. It overwrites the existing config file.

## Set individual values

Change a single config key without touching everything else.

```bash
bricks config set <key> <value>
```

### Available keys

| Key | Description | Example |
|-----|-------------|---------|
| `site.url` | Your WordPress site URL | `https://example.com` |
| `site.api_key` | API key from the plugin settings page | `abcd1234-ef56-...` |
| `llm.provider` | LLM provider name | `openai`, `anthropic`, `cerebras` |
| `llm.api_key` | Your LLM API key | `sk-proj-...` |
| `llm.model` | Model name | `gpt-4o`, `claude-sonnet-4-20250514` |
| `llm.base_url` | Custom API endpoint (for self-hosted models) | `http://localhost:11434/v1` |
| `llm.temperature` | Generation temperature (0.0-1.0) | `0.3` |

### Examples

Switch to a different site:

```bash
bricks config set site.url https://staging.example.com
bricks config set site.api_key your-staging-api-key
```

Set up Anthropic instead of OpenAI:

```bash
bricks config set llm.provider anthropic
bricks config set llm.api_key sk-ant-...
bricks config set llm.model claude-sonnet-4-20250514
```

Point to a local model:

```bash
bricks config set llm.provider openai
bricks config set llm.base_url http://localhost:11434/v1
bricks config set llm.model llama3
bricks config set llm.api_key not-needed
```

Any provider with an OpenAI-compatible API works with the `openai` provider type and a custom `base_url`.

## The config file

Everything gets stored in `~/.agent-to-bricks/config.yaml`:

```yaml
site:
  url: https://example.com
  api_key: abcd1234-ef56-7890-abcd-ef1234567890

llm:
  provider: openai
  api_key: sk-proj-abc123...
  model: gpt-4o
  base_url: ""
  temperature: 0.3
```

You can edit this file directly if you prefer. The CLI reads it fresh on every command.

## Update

Update the CLI binary and the WordPress plugin.

```bash
bricks update
```

```
Checking for updates...
  CLI:    v0.8.2 → v0.9.0 (update available)
  Plugin: v0.8.2 → v0.9.0 (update available)

Downloading CLI v0.9.0... done
Downloading plugin v0.9.0... done
Updating plugin on https://example.com... done

Updated to v0.9.0
```

### Flags

| Flag | Description |
|------|-------------|
| `--check` | Check for updates without installing them |
| `--cli-only` | Only update the CLI, skip the plugin |
| `--force` | Force re-download even if already on the latest version |

### Check without installing

```bash
bricks update --check
```

```
CLI:    v0.9.0 (current)
Plugin: v0.8.2 → v0.9.0 (update available)
```

### Update just the CLI

```bash
bricks update --cli-only
```

Useful when you want to update the CLI on your local machine but aren't ready to update the plugin on production.

## Version info

See what versions you're running and whether the CLI and plugin are in sync.

```bash
bricks version
```

```
CLI:      v0.9.0
Plugin:   v0.9.0
Status:   in sync
Go:       1.22.5
Platform: darwin/arm64
```

### Show the changelog

```bash
bricks version --changelog
```

```
v0.9.0 (2026-02-20)
  - Added template learning from existing pages
  - Improved ACSS class resolution for v3.x utility names
  - Fixed snapshot rollback not preserving page settings
  - Added --compact flag to agent context

v0.8.2 (2026-02-10)
  - Fixed convert HTML handling of nested lists
  - Added --json flag to search results
  - Performance improvement for large page pulls
...
```

## Verify your connection

After configuring, run `bricks site info` to make sure everything works:

```bash
bricks site info
```

```
Site:       https://example.com
Bricks:     1.11.1
WordPress:  6.5.2
PHP:        8.2.18
ACSS:       3.0.2
Frames:     2.2.0
```

If this fails, double-check your `site.url` and `site.api_key` values. The URL should be the root of your WordPress site (no trailing slash, no `/wp-admin`). The API key comes from **Settings > Agent to Bricks** in your WordPress admin.

## Related commands

- [`bricks site info`](/cli/site-commands/): verify your connection after configuring
- [`bricks agent context`](/cli/agent-commands/): uses the site connection to export context
