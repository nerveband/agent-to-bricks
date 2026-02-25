---
title: Configuration
description: Config file reference and LLM provider setup
---

The CLI stores its configuration in `~/.agent-to-bricks/config.yaml`. The `bricks config` commands read and write this file, but you can also edit it directly.

## Config file reference

Here's a complete config file with every available option:

```yaml
site:
  url: https://your-site.com
  api_key: atb_k1_a3b7c9d2e8f4...

llm:
  provider: openai
  api_key: sk-proj-abc123...
  model: gpt-4o
  base_url: ""
  temperature: 0.3
```

### Site settings

| Key | Description | Example |
|-----|-------------|---------|
| `site.url` | Your WordPress site URL, including the protocol | `https://your-site.com` |
| `site.api_key` | API key from **Settings > Agent to Bricks** in WordPress | `atb_k1_a3b7c9d2e8f4...` |

### LLM settings

| Key | Description | Default |
|-----|-------------|---------|
| `llm.provider` | The AI provider to use | (none) |
| `llm.api_key` | API key for the provider | (none) |
| `llm.model` | Model name | (none) |
| `llm.base_url` | Custom API endpoint URL | `""` (uses provider default) |
| `llm.temperature` | Controls randomness in generation (0.0 = deterministic, 1.0 = creative) | `0.3` |

## Setting values

Use `bricks config set` to update individual keys:

```bash
bricks config set site.url https://your-site.com
bricks config set site.api_key atb_k1_a3b7c9d2e8f4
bricks config set llm.provider anthropic
bricks config set llm.model claude-sonnet-4-20250514
bricks config set llm.temperature 0.2
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
| `llm.provider` | `ATB_LLM_PROVIDER` |
| `llm.api_key` | `ATB_LLM_API_KEY` |
| `llm.model` | `ATB_LLM_MODEL` |
| `llm.base_url` | `ATB_LLM_BASE_URL` |
| `llm.temperature` | `ATB_LLM_TEMPERATURE` |

Environment variables take precedence over the config file. Example:

```bash
ATB_SITE_URL=https://staging.your-site.com \
ATB_SITE_API_KEY=atb_k1_staging_key_here \
bricks site info
```

This connects to your staging site without modifying `config.yaml`.

## LLM provider setup

The CLI works with OpenAI, Anthropic, Cerebras, and any provider that exposes an OpenAI-compatible API.

### OpenAI

```bash
bricks config set llm.provider openai
bricks config set llm.api_key sk-proj-abc123...
bricks config set llm.model gpt-4o
```

Other OpenAI models that work well: `gpt-4o-mini` (faster, cheaper), `gpt-4-turbo`.

### Anthropic

```bash
bricks config set llm.provider anthropic
bricks config set llm.api_key sk-ant-api03-abc123...
bricks config set llm.model claude-sonnet-4-20250514
```

Anthropic models use a different API format than OpenAI. The CLI handles the translation automatically when you set the provider to `anthropic`.

### Cerebras

```bash
bricks config set llm.provider cerebras
bricks config set llm.api_key csk-abc123...
bricks config set llm.model llama-4-scout-17b-16e-instruct
```

Cerebras runs open-source models on custom hardware. Response times tend to be fast, which makes it a good option for iterating quickly.

### Custom / self-hosted providers

Any provider with an OpenAI-compatible API works. Set the provider to `openai` and point `base_url` at your endpoint:

```bash
bricks config set llm.provider openai
bricks config set llm.base_url http://localhost:11434/v1
bricks config set llm.api_key ollama
bricks config set llm.model llama3.1
```

This works with [Ollama](https://ollama.com/), [LM Studio](https://lmstudio.ai/), [vLLM](https://github.com/vllm-project/vllm), and similar tools. The `api_key` field still needs a value even if your local server doesn't require authentication -- just set it to any non-empty string.

### Together AI

```bash
bricks config set llm.provider openai
bricks config set llm.base_url https://api.together.xyz/v1
bricks config set llm.api_key your-together-key
bricks config set llm.model meta-llama/Llama-3-70b-chat-hf
```

### OpenRouter

```bash
bricks config set llm.provider openai
bricks config set llm.base_url https://openrouter.ai/api/v1
bricks config set llm.api_key your-openrouter-key
bricks config set llm.model anthropic/claude-sonnet-4-20250514
```

## Temperature

The `temperature` setting controls how creative or predictable the AI output is:

- **0.0 -- 0.2**: Very consistent output. Good for structured tasks like converting a specific layout description into HTML.
- **0.3 -- 0.5**: Balanced. The default of `0.3` works well for most generation tasks.
- **0.6 -- 1.0**: More varied output. Can produce more interesting copy but may also introduce unexpected structural choices.

```bash
bricks config set llm.temperature 0.2
```

## Multiple site configurations

The config file supports a single site by default. To work with multiple sites, use environment variables to switch between them:

```bash
# Production
ATB_SITE_URL=https://your-site.com \
ATB_SITE_API_KEY=atb_k1_prod_key \
bricks site info

# Staging
ATB_SITE_URL=https://staging.your-site.com \
ATB_SITE_API_KEY=atb_k1_staging_key \
bricks site info
```

For convenience, wrap these in shell aliases or a small script:

```bash
# In your .bashrc or .zshrc
alias bricks-prod='ATB_SITE_URL=https://your-site.com ATB_SITE_API_KEY=atb_k1_prod_key bricks'
alias bricks-staging='ATB_SITE_URL=https://staging.your-site.com ATB_SITE_API_KEY=atb_k1_staging_key bricks'
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
bricks config show
```

This prints the active configuration with API keys partially redacted.
