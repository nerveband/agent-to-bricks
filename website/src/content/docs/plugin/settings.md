---
title: Settings
description: Plugin configuration in the WordPress admin, wp_options keys, and LLM provider setup
---

The plugin settings live at **Settings > Agent to Bricks** in the WordPress admin. The page has two sections: API key management for CLI/agent access, and LLM provider configuration for AI generation.

## Admin UI overview

The top half of the settings page manages **CLI & Agent API Keys**. This is where you generate and revoke keys for external tools. See [Authentication](/plugin/authentication/) for the details.

The bottom half configures the **LLM Provider** used for AI generation (`/generate` and `/modify` endpoints). You pick a provider, enter its API key, choose a model, and set generation parameters.

## LLM provider settings

| Setting | Default | Description |
|---------|---------|-------------|
| Provider | Cerebras | Which LLM provider to use. Options: Cerebras, OpenAI, Anthropic, or Custom. |
| API Key | _(empty)_ | The provider's API key. Stored encrypted using AES-256-CBC with your site's auth salt. |
| Model | _(provider default)_ | Override the default model. Leave empty to use the provider's default. |
| Base URL | _(auto)_ | API endpoint URL. Auto-filled per provider. Only change this for custom/self-hosted providers. |
| Temperature | 0.7 | Controls randomness. Lower (0.1-0.3) for predictable output, higher (0.7-1.0) for more creative results. Range: 0 to 1.5. |
| Max Tokens | 4000 | Maximum response length. The plugin automatically bumps this to 8000+ for full-page generation. Range: 1000 to 16000. |

The provider dropdown updates the base URL and shows available models automatically.

## Experimental features

| Setting | Default | Description |
|---------|---------|-------------|
| Bricks Editor Panel | Off | Adds an AI generation panel inside the Bricks visual editor. This is experimental -- the CLI workflow is more reliable. |

## wp_options keys

The plugin stores its data in several WordPress options. You shouldn't need to edit these directly, but they're useful for debugging or if you're building integrations.

### `agent_bricks_settings`

Main settings object. Contains:

```php
[
    'provider'            => 'cerebras',      // LLM provider ID
    'api_key'             => '...',           // Encrypted provider API key
    'model'               => '',              // Model override (empty = provider default)
    'base_url'            => '',              // API base URL override
    'temperature'         => 0.7,             // Generation temperature
    'max_tokens'          => 4000,            // Max tokens per request
    'enable_editor_panel' => 0,               // Bricks editor panel toggle
]
```

The `api_key` value here is the LLM provider key (e.g., your OpenAI or Anthropic key), not the CLI authentication key. It's encrypted with AES-256-CBC. The plugin decrypts it when making LLM API calls.

### `agent_bricks_api_keys`

Array of CLI/agent API keys. Each entry:

```php
[
    'key_hash'   => '...',              // SHA-256 hash of the key
    'key_prefix' => 'atb_xK9m',        // First 8 chars (for display)
    'user_id'    => 1,                  // WordPress user who created it
    'label'      => 'My CLI',           // Human-readable label
    'created'    => '2026-02-25 14:00', // Creation timestamp
    'last_used'  => '2026-02-25 15:30', // Last API request timestamp
]
```

### `bricks_global_classes`

Bricks' native option. Array of global CSS classes. The plugin reads and writes to this for class management. See [Global classes](/plugin/global-classes/).

### `bricks_theme_styles`

Bricks' native option. Theme style definitions including typography, colors, and custom CSS. The plugin reads this for the `/styles` endpoint.

### `bricks_global_settings`

Bricks' native option. Contains the color palette and other global Bricks settings. Read-only from the plugin's perspective.

### `bricks_custom_properties`

Bricks' native option. CSS custom properties defined through the Bricks UI.

### `automatic_css_settings`

ACSS's native option. Read by the plugin for framework detection and design token extraction. Only present if ACSS is installed.

## Encryption

The LLM provider API key is encrypted before storage using:

- Algorithm: AES-256-CBC
- Key: WordPress `auth` salt (from `wp-config.php`)
- IV: First 16 bytes of MD5 of the `secure_auth` salt

This means the encrypted key is tied to your site's salt values. If you migrate your database to a different WordPress install with different salts, you'll need to re-enter the provider API key.

## Resetting settings

To start fresh, delete the options:

```sql
DELETE FROM wp_options WHERE option_name IN (
  'agent_bricks_settings',
  'agent_bricks_api_keys'
);
```

Or from WP-CLI:

```bash
wp option delete agent_bricks_settings
wp option delete agent_bricks_api_keys
```

This removes all plugin configuration and revokes all API keys. The Bricks-native options (`bricks_global_classes`, etc.) are untouched.

## Environment-specific configuration

If you manage staging and production environments, remember:

- **API keys are per-site.** A key generated on staging won't work on production.
- **LLM provider settings are per-site.** You might use a cheaper model on staging and a better one in production.
- **The CLI config file supports multiple sites.** Set up site profiles in `~/.agent-to-bricks/config.yaml` so you can target different environments without changing settings. See [Configuration](/getting-started/configuration/).
