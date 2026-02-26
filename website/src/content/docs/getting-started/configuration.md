---
title: Configuration
description: Config file reference and environment variables
---

The CLI stores its configuration in `~/.agent-to-bricks/config.yaml`. The `bricks config` commands read and write this file, but you can also edit it directly.

## Config file reference

Here's a complete config file with every available option:

```yaml
site:
  url: https://your-site.com
  api_key: atb_a3b7c9d2e8f4...
```

### Site settings

| Key | Description | Example |
|-----|-------------|---------|
| `site.url` | Your WordPress site URL, including the protocol | `https://your-site.com` |
| `site.api_key` | API key from **Settings > Agent to Bricks** in WordPress | `atb_a3b7c9d2e8f4...` |

## Setting values

Use `bricks config set` to update individual keys:

```bash
bricks config set site.url https://your-site.com
bricks config set site.api_key atb_a3b7c9d2e8f4
```

Or run the interactive wizard to set everything at once:

```bash
bricks config init
```

## Environment variables

You can override any config value with an environment variable. This is useful for CI pipelines, Docker containers, or keeping API keys out of the config file.

The pattern is `ATB_` followed by the config key in uppercase with underscores replacing dots:

| Config key | Environment variable |
|------------|---------------------|
| `site.url` | `ATB_SITE_URL` |
| `site.api_key` | `ATB_SITE_API_KEY` |

Environment variables take precedence over the config file. Example:

```bash
ATB_SITE_URL=https://staging.your-site.com \
ATB_SITE_API_KEY=atb_staging_key_here_here \
bricks site info
```

This connects to your staging site without modifying `config.yaml`.

## Multiple site configurations

The config file supports a single site by default. To work with multiple sites, use environment variables to switch between them:

```bash
# Production
ATB_SITE_URL=https://your-site.com \
ATB_SITE_API_KEY=atb_prod_key_here \
bricks site info

# Staging
ATB_SITE_URL=https://staging.your-site.com \
ATB_SITE_API_KEY=atb_staging_key_here \
bricks site info
```

For convenience, wrap these in shell aliases or a small script:

**Mac / Linux** — add to your `.bashrc` or `.zshrc`:

```bash
alias bricks-prod='ATB_SITE_URL=https://your-site.com ATB_SITE_API_KEY=atb_prod_key_here bricks'
alias bricks-staging='ATB_SITE_URL=https://staging.your-site.com ATB_SITE_API_KEY=atb_staging_key_here bricks'
```

**Windows** — add to your PowerShell profile (`$PROFILE`):

```powershell
function bricks-prod { $env:ATB_SITE_URL='https://your-site.com'; $env:ATB_SITE_API_KEY='atb_prod_key_here'; bricks @args }
function bricks-staging { $env:ATB_SITE_URL='https://staging.your-site.com'; $env:ATB_SITE_API_KEY='atb_staging_key_here'; bricks @args }
```

Then use them like any other command:

```bash
bricks-staging site info
bricks-prod site pull 1460
```

## Config file location

The config file lives at `~/.agent-to-bricks/config.yaml` on all platforms:

| Platform | Path |
|----------|------|
| Mac / Linux | `~/.agent-to-bricks/config.yaml` |
| Windows | `C:\Users\YourName\.agent-to-bricks\config.yaml` |

The CLI creates this directory and file automatically the first time you run `bricks config init` or `bricks config set`.

## Viewing current config

To see what's currently configured:

```bash
bricks config list
```

This prints the active configuration with API keys partially redacted.
