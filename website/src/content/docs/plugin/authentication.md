---
title: Authentication
description: How API keys work, how to generate and revoke them, and what the rate limits are
---

The plugin uses a custom `X-ATB-Key` header for authentication. This was a deliberate choice. The standard `Authorization` header gets stripped by many hosting providers (Nginx, LiteSpeed, some managed WordPress hosts). The `X-ATB-Key` header works everywhere.

## How it works

1. You generate an API key in the WordPress admin
2. The CLI (or any HTTP client) sends the key in the `X-ATB-Key` header with every request
3. The plugin validates the key, logs you in as the WordPress user who created it, and the request proceeds with that user's permissions

Keys are stored as SHA-256 hashes salted with your site's `auth` salt. The raw key is shown exactly once when you create it. If you lose it, revoke it and make a new one.

## Generating a key

In the WordPress admin:

1. Go to **Settings > Agent to Bricks**
2. Under **CLI & Agent API Keys**, type a label (e.g., "My laptop" or "CI/CD pipeline")
3. Click **Generate New Key**
4. Copy the key immediately. It won't be shown again

The key looks like this: `atb_xK9mP2vL7nQ4rT8wY1bF3hJ6...`

The `atb_` prefix is always there. The rest is 40 random characters.

## Using the key

### With the CLI

The fastest way is through the config wizard:

```bash
bricks config init
```

It will ask for your site URL and API key, then write them to `~/.agent-to-bricks/config.yaml`.

Or set it directly:

```bash
bricks config set site.api_key atb_xK9mP2vL7nQ4rT8wY1bF3hJ6...
```

### With curl

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/site/info \
  -H "X-ATB-Key: atb_xK9mP2vL7nQ4rT8wY1bF3hJ6..."
```

### In code

Any HTTP client works. Here's a Python example:

```python
import requests

resp = requests.get(
    "https://your-site.com/wp-json/agent-bricks/v1/site/info",
    headers={"X-ATB-Key": "atb_xK9mP2vL7nQ4rT8wY1bF3hJ6..."}
)
print(resp.json())
```

## Managing keys

The settings page shows all active keys with their prefix (first 8 characters), label, creation date, and when they were last used.

### Revoking a key

Click **Revoke** next to any key in the settings page. The key stops working immediately. Any CLI or agent using that key will get `401` errors until you give it a new one.

### Multiple keys

You can create as many keys as you need. Common setup:

- One key for your local CLI
- One key for a staging server's CI/CD pipeline
- One key for an AI agent running on a team member's machine

Each key is tied to the WordPress user who created it. API requests run with that user's permissions, so the user needs `edit_posts` capability at minimum. Admin-level endpoints (like managing global classes) need `manage_options`.

## Rate limits

The plugin enforces rate limiting on **authentication failures**: **10 failed attempts within 5 minutes** from the same IP address triggers a `429 Too Many Requests` response. This protects against brute-force API key guessing.

Most CLI workflows won't encounter rate limits. If you do see a `429`, verify your API key is correct. The limit resets automatically after 5 minutes.

If you're running batch operations, the `/pages/{id}/elements/batch` endpoint lets you combine multiple operations into a single request.

## Security layers

The authentication system has several protections built in:

**Hashed storage.** Keys are never stored in plain text. They're hashed with SHA-256 using your site's WordPress auth salt. Even if someone gets access to your `wp_options` table, they can't recover the keys.

**Per-user binding.** Each key is tied to a WordPress user account. The API request runs with that user's exact capabilities. A key created by an Editor can't do things that require Administrator access.

**Last-used tracking.** The plugin records when each key was last used. Check the settings page periodically. If you see a key that hasn't been used in months, revoke it.

**No Authorization header dependency.** The `X-ATB-Key` header bypasses the common problem where server configs strip the `Authorization` header before PHP sees it. This means the plugin works on cheap shared hosting just as well as on a VPS.

**WordPress nonce protection on admin actions.** Generating and revoking keys from the admin UI is protected by WordPress nonces, so these actions can't be triggered by cross-site request forgery.

## Troubleshooting

**Getting `401 Invalid API key`?** Double-check you copied the full key, including the `atb_` prefix. Keys are case-sensitive.

**Getting `403 Forbidden`?** The WordPress user who created the key doesn't have the right capabilities. Global class management needs `manage_options`. Page editing needs `edit_post` for that specific page.

**Key works with curl but not the CLI?** Make sure your config file has the right site URL. Run `bricks config show` to see what the CLI is using. The URL must include the protocol (`https://`).

**Behind a CDN or reverse proxy?** Most CDNs pass custom headers through without issue. If yours strips `X-ATB-Key`, add it to the allowed headers list in your CDN configuration.
