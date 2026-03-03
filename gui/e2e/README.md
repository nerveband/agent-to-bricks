# E2E Tests — Agent to Bricks GUI

End-to-end tests using `tauri-plugin-mcp` to programmatically interact with the real running Tauri app.

## Prerequisites

1. App running in dev mode with MCP enabled:
   ```bash
   cd gui && npm run tauri dev -- --features dev-debug
   ```
2. Wait for the MCP socket at `/tmp/tauri-mcp-atb.sock`
3. Node.js 18+

## Running Tests

```bash
node gui/e2e/run-tests.mjs
```

## Architecture

```
Test Runner (Node.js)
    ↓ Unix socket (/tmp/tauri-mcp-atb.sock)
tauri-plugin-mcp (Rust plugin, debug builds only)
    ↓ Tauri event system
JS Guest Bindings (webview, auto-loaded in dev)
    ↓ DOM access
Real App UI
```

## Test Categories (35 tests)

| Category | Tests | What's Tested |
|----------|-------|---------------|
| App Lifecycle | 4 | Name, version, window, URL |
| Theme | 1 | Dark theme default |
| Sidebar | 8 | Tools list, Add button, Sessions, nav |
| Site Management | 1 | Connected site display |
| Prompt Composer | 5 | Input, @-mentions, presets, save/copy |
| Staging Connection | 2 | Site info API, WP version |
| Page Browsing | 2 | Pages list, elements for page 1338 |
| Abilities API | 6 | List, categories, core, exec, input, POST rejection |
| UI Interactions | 2 | Settings dialog open/fields |
| Welcome | 1 | Welcome message |
| MCP Tools | 3 | Page map, state, screenshot |

## Files

- `mcp-client.mjs` — Socket client for tauri-plugin-mcp
- `run-tests.mjs` — Test suite
- `screenshots/` — Auto-captured during test runs
- `test-results.json` — Machine-readable results
