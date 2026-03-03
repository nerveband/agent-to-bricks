# E2E Testing with tauri-plugin-mcp — Design

## Goal

Integrate `tauri-plugin-mcp` into the GUI so Claude Code can programmatically launch, interact with, screenshot, and test the real Tauri app. Write red/green TDD E2E tests covering all UI features including the new WordPress Abilities API integration, verified against ts-staging.wavedepth.com.

## Architecture

### Plugin Integration (debug builds only)

```
Claude Code → MCP Server (npx tauri-plugin-mcp-server)
                ↓ Unix socket
            tauri-plugin-mcp (Rust plugin in app)
                ↓ Guest JS bridge
            Real webview DOM + native APIs
```

- Plugin registered with `#[cfg(debug_assertions)]` — zero production impact
- Socket: `/tmp/tauri-mcp-atb.sock`
- MCP config scoped to project `.claude/settings.json`

### Files Changed

| File | Change |
|------|--------|
| `gui/src-tauri/Cargo.toml` | Add `tauri-plugin-mcp` git dependency |
| `gui/src-tauri/src/lib.rs` | Register plugin in debug builds |
| `gui/package.json` | Add `tauri-plugin-mcp` JS guest bindings |
| `.claude/settings.json` | Add `tauri-mcp` MCP server (project-scoped) |

### New Files

| File | Purpose |
|------|---------|
| `gui/e2e/README.md` | Test runner instructions |
| `gui/e2e/tests/*.md` | Test scripts (human-readable, MCP tool sequences) |

## Test Coverage

### App Lifecycle
- Window opens with correct dimensions and title
- Dark theme applied by default
- Tool detection loading screen renders
- Bricks CLI detected → main UI shown

### Sidebar
- Tools list renders (Bricks CLI, Claude Code, Codex, OpenCode)
- Sessions list visible (empty initially)
- Sidebar collapses/expands
- Add Tool button opens dialog

### Site Management
- Add site via Settings dialog (URL + API key)
- Test connection button → success for ts-staging
- Site appears in site switcher
- Invalid credentials show error

### Page & Content Browsing (live staging)
- Pages load from ts-staging (Style Guide, About Us, etc.)
- Page search filters results
- Page elements fetch for page 1338 (22 elements)

### Abilities (new feature, live staging)
- Abilities load from WP 6.9 endpoint
- 22 ATB abilities displayed
- Categories shown correctly
- Third-party abilities separated
- Graceful fallback for WP < 6.9

### Prompt Composer
- Pre-prompt template renders with variables
- Abilities block injected into session prompt
- @-mention autocomplete triggers on typing
- Preset list shows built-in templates

### Session Launch
- Launch tool opens LaunchDialog
- Working directory selector works
- Session starts → terminal renders
- Context prompt auto-injected

### Settings & UI
- Settings dialog opens/closes
- Theme toggle works (dark ↔ light)
- Keyboard shortcuts (Cmd+K palette, Cmd+, settings)
- Resize handles work (sidebar, prompt pane)

## TDD Approach

Each test:
1. **Red**: Write assertion, take screenshot showing failure/missing state
2. **Green**: Verify the assertion passes with screenshot proof

Tests run against the real app with real staging data — no mocks.

## Staging Details

- Server: ts-staging.wavedepth.com
- API key: stored in memory (not committed)
- Test page: 1338
- Expected: 22 ATB abilities, 2 core abilities, 7 categories
