# E2E Testing with tauri-plugin-mcp — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate tauri-plugin-mcp into the GUI and run comprehensive E2E tests against the real app + live staging site using TDD (red/green).

**Architecture:** Add tauri-plugin-mcp as a debug-only Rust plugin + JS guest binding. Configure Claude Code project-scoped MCP server via `.mcp.json`. Launch app in dev mode, then use MCP tools (take_screenshot, query_page, click, type_text, execute_js) to interact with the real webview and verify all features work.

**Tech Stack:** Tauri 2, tauri-plugin-mcp (Rust + TS), MCP protocol, ts-staging.wavedepth.com

---

### Task 1: Add tauri-plugin-mcp Rust dependency

**Files:**
- Modify: `gui/src-tauri/Cargo.toml:14-29`

**Step 1: Add the dependency**

Add `tauri-plugin-mcp` to the `[dependencies]` section of `gui/src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-sql = { version = "2.3.2", features = ["sqlite"] }
tauri-plugin-pty = "0.2.1"
dirs = "6.0.0"
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
tokio = { version = "1", features = ["macros"] }
urlencoding = "2"
tauri-plugin-dialog = "2.6.0"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
which = "7"
tauri-plugin-mcp = { git = "https://github.com/P3GLEG/tauri-plugin-mcp", optional = true }
```

Note: we make it `optional = true` so production builds don't include it.

**Step 2: Add a `dev-debug` feature**

Add a features section to `gui/src-tauri/Cargo.toml` (after `[dependencies]`):

```toml
[features]
dev-debug = ["tauri-plugin-mcp"]
```

**Step 3: Verify it compiles**

Run: `cd gui && cargo check --manifest-path src-tauri/Cargo.toml --features dev-debug`
Expected: Compiles (downloads and builds tauri-plugin-mcp)

**Step 4: Commit**

```bash
git add gui/src-tauri/Cargo.toml
git commit -m "chore: add tauri-plugin-mcp as optional dev dependency"
```

---

### Task 2: Register MCP plugin in debug builds

**Files:**
- Modify: `gui/src-tauri/src/lib.rs:759-795`

**Step 1: Add conditional plugin registration**

In `gui/src-tauri/src/lib.rs`, modify the `run()` function. The current builder chain at line 765 is:

```rust
tauri::Builder::default()
    .manage(HttpClient(Arc::new(client)))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_pty::init())
    // ...
    .plugin(tauri_plugin_process::init())
    .invoke_handler(...)
    .run(...)
```

Change the `run()` function to use a mutable builder so we can conditionally add the MCP plugin:

```rust
pub fn run() {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("Failed to create HTTP client");

    let mut builder = tauri::Builder::default()
        .manage(HttpClient(Arc::new(client)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    // MCP debugging plugin — only in debug builds with dev-debug feature
    #[cfg(feature = "dev-debug")]
    {
        builder = builder.plugin(
            tauri_plugin_mcp::init_with_config(
                tauri_plugin_mcp::PluginConfig::new("agent-to-bricks".to_string())
                    .start_socket_server(true)
                    .socket_path("/tmp/tauri-mcp-atb.sock"),
            ),
        );
    }

    builder
        .invoke_handler(tauri::generate_handler![
            detect_environment,
            detect_tool,
            get_shell_env,
            get_platform_shell,
            search_pages,
            test_site_connection,
            get_page_elements,
            search_elements,
            get_global_classes,
            get_site_styles,
            get_site_variables,
            get_components,
            get_templates,
            get_media,
            get_abilities,
            config::read_config,
            config::write_config,
            config::config_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 2: Verify it compiles without feature (production path)**

Run: `cd gui && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles with no warnings about unused imports

**Step 3: Verify it compiles with feature (debug path)**

Run: `cd gui && cargo check --manifest-path src-tauri/Cargo.toml --features dev-debug`
Expected: Compiles with MCP plugin included

**Step 4: Commit**

```bash
git add gui/src-tauri/src/lib.rs
git commit -m "feat(gui): register tauri-plugin-mcp in debug builds"
```

---

### Task 3: Add JS guest bindings

**Files:**
- Modify: `gui/package.json`

**Step 1: Install the tauri-plugin-mcp npm package**

Run: `cd gui && npm install tauri-plugin-mcp`

**Step 2: Verify the build still passes**

Run: `cd gui && npm run build`
Expected: TypeScript type-check + Vite build succeed

**Step 3: Commit**

```bash
git add gui/package.json gui/package-lock.json
git commit -m "chore(gui): add tauri-plugin-mcp JS guest bindings"
```

---

### Task 4: Configure project-scoped MCP server

**Files:**
- Create: `.mcp.json` (project root)

**Step 1: Create the MCP config file**

Create `.mcp.json` in the project root (NOT inside `gui/`, at the repo root):

```json
{
  "mcpServers": {
    "tauri-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "tauri-plugin-mcp-server"],
      "env": {
        "TAURI_MCP_IPC_PATH": "/tmp/tauri-mcp-atb.sock"
      }
    }
  }
}
```

**Step 2: Add dev launch script to gui/package.json**

Add a `dev:mcp` script that enables the dev-debug feature:

In `gui/package.json`, add to `"scripts"`:

```json
"dev:mcp": "CARGO_FLAGS='--features dev-debug' tauri dev"
```

Note: Tauri CLI passes `CARGO_FLAGS` to cargo during the build step.

**Step 3: Commit**

```bash
git add .mcp.json gui/package.json
git commit -m "feat: add project-scoped MCP server config for E2E testing"
```

---

### Task 5: Launch app in dev mode and verify MCP connection

**Step 1: Start the app with MCP enabled**

Run in a background terminal:
```bash
cd gui && npm run tauri dev -- -- --features dev-debug
```

Wait for the app to compile and launch (~30-60s first time).

**Step 2: Verify the MCP socket exists**

Run: `ls -la /tmp/tauri-mcp-atb.sock`
Expected: Socket file exists

**Step 3: Take a screenshot to verify MCP tools work**

Use MCP tool: `take_screenshot`
Expected: Screenshot of the app window (tool detection loading screen or main UI)

**Step 4: Query the page DOM**

Use MCP tool: `query_page` with mode "map"
Expected: DOM tree of the React app

This task has no commit — it's a verification step.

---

### Task 6: E2E Test — App Launch & Tool Detection

**RED phase — write assertions that describe expected state:**

**Step 1: Screenshot the loading state**

Use MCP tool: `take_screenshot`
Verify: Loading screen visible with tool detection log entries

**Step 2: Query for tool detection elements**

Use MCP tool: `query_page` with mode "element" to find tool detection UI
Expected: Elements showing Bricks CLI detection status

**Step 3: Wait for detection to complete**

Use MCP tool: `wait_for` with condition: text "bricks" appears in the tools list
Expected: Tool detection completes, main UI renders

**GREEN phase — verify app state after detection:**

**Step 4: Screenshot the main UI**

Use MCP tool: `take_screenshot`
Verify: Main app layout visible — sidebar with tools list, terminal area, prompt pane

**Step 5: Query sidebar tools**

Use MCP tool: `execute_js` with script:
```javascript
JSON.stringify(Array.from(document.querySelectorAll('[data-tool-slug]')).map(el => ({
  slug: el.getAttribute('data-tool-slug'),
  text: el.textContent
})))
```
Expected: Returns array with tool entries (bricks, claude-code, codex, opencode or subset)

**Step 6: Document results**

Save screenshots to `gui/e2e/results/` for review.

---

### Task 7: E2E Test — Site Connection (live staging)

**RED phase — no site configured yet:**

**Step 1: Screenshot — no site state**

Use MCP tool: `take_screenshot`
Verify: No site connected (site switcher shows empty or default)

**Step 2: Open Settings dialog**

Use MCP tool: `click` on Settings button (gear icon in sidebar)
OR use `execute_js`: `document.querySelector('[data-settings-trigger]')?.click()` or similar

**Step 3: Screenshot Settings dialog**

Use MCP tool: `take_screenshot`
Verify: Settings dialog open, site management section visible

**GREEN phase — add staging site:**

**Step 4: Add staging site via JS**

Use MCP tool: `execute_js` to programmatically set the site:
```javascript
// Access Jotai store to set site directly
// The atoms are managed internally, so we inject via config
window.__TEST_SITE = {
  url: 'https://ts-staging.wavedepth.com',
  api_key: process.env.ATB_STAGING_API_KEY,
  name: 'TS Staging'
};
```

OR type into the settings form fields:
- Use `click` on the URL input field
- Use `type_text` to enter `https://ts-staging.wavedepth.com`
- Use `click` on the API key input field
- Use `type_text` to enter the API key
- Use `click` on "Test Connection" button

**Step 5: Verify connection success**

Use MCP tool: `wait_for` — wait for success message
Use MCP tool: `take_screenshot`
Expected: "Connected" or success indicator shown

**Step 6: Save the site**

Use MCP tool: `click` on save/close button

---

### Task 8: E2E Test — Abilities Loading (live staging)

This tests the new WordPress Abilities API feature against real data.

**RED phase — verify abilities section exists in UI:**

**Step 1: Check if abilities data loads**

Use MCP tool: `execute_js`:
```javascript
// Invoke the Tauri command directly to test the backend
window.__TAURI__.core.invoke('get_abilities', {
  siteUrl: 'https://ts-staging.wavedepth.com',
  apiKey: process.env.ATB_STAGING_API_KEY,
  category: ''
}).then(r => JSON.stringify({count: r.length, names: r.map(a => a.name)}))
```
Expected: 22 ATB abilities returned

**Step 2: Verify abilities include correct categories**

Use MCP tool: `execute_js`:
```javascript
window.__TAURI__.core.invoke('get_abilities', {
  siteUrl: 'https://ts-staging.wavedepth.com',
  apiKey: process.env.ATB_STAGING_API_KEY,
  category: ''
}).then(r => {
  const cats = [...new Set(r.map(a => a.category))];
  const annotations = r.map(a => ({name: a.name, readonly: a.annotations?.readonly}));
  return JSON.stringify({categories: cats, abilities_with_annotations: annotations});
})
```
Expected: 4 ATB categories, annotations promoted correctly from meta

**GREEN phase — verify all 22 abilities and their annotations:**

**Step 3: Verify readonly abilities**

Use MCP tool: `execute_js`:
```javascript
window.__TAURI__.core.invoke('get_abilities', {
  siteUrl: 'https://ts-staging.wavedepth.com',
  apiKey: process.env.ATB_STAGING_API_KEY,
  category: ''
}).then(r => {
  const readonly = r.filter(a => a.annotations?.readonly);
  const write = r.filter(a => !a.annotations?.readonly);
  return JSON.stringify({
    readonly_count: readonly.length,
    write_count: write.length,
    readonly_names: readonly.map(a => a.name),
    write_names: write.map(a => a.name)
  });
})
```
Expected: ~14 readonly, ~8 write abilities

**Step 4: Take screenshot showing abilities in context**

Use MCP tool: `take_screenshot`
Document the current UI state

---

### Task 9: E2E Test — Prompt Composer & Abilities Block

**RED phase — verify abilities block injection:**

**Step 1: Check pre-prompt template has abilities placeholder**

Use MCP tool: `execute_js`:
```javascript
// Check if the pre-prompt template contains the abilities block placeholder
const store = document.querySelector('[data-prompt-pane]');
// Or access the atom value directly
JSON.stringify({
  has_abilities_placeholder: document.body.innerHTML.includes('abilities_block') ||
    document.body.innerHTML.includes('abilities')
});
```

**Step 2: Open Launch Dialog for a tool**

Use MCP tool: `click` on a tool in the sidebar (e.g., Claude Code)
Use MCP tool: `take_screenshot`
Expected: Launch dialog opens with pre-prompt editor showing site context + abilities

**GREEN phase — verify abilities content in pre-prompt:**

**Step 3: Read the pre-prompt content**

Use MCP tool: `execute_js`:
```javascript
// Find the pre-prompt textarea/editor content
const editor = document.querySelector('textarea[data-preprompt], [data-prompt-editor]');
if (editor) {
  return editor.value || editor.textContent;
}
// Fallback: look for any textarea with abilities content
const textareas = Array.from(document.querySelectorAll('textarea'));
const match = textareas.find(t => t.value?.includes('abilit'));
return match ? match.value.substring(0, 500) : 'No abilities content found';
```
Expected: Pre-prompt contains abilities block with ATB ability names

**Step 4: Screenshot the launch dialog**

Use MCP tool: `take_screenshot`
Verify: Launch dialog shows pre-prompt with abilities section visible

---

### Task 10: E2E Test — Page Browsing (live staging)

**RED phase — test page search API via Tauri command:**

**Step 1: Search pages**

Use MCP tool: `execute_js`:
```javascript
window.__TAURI__.core.invoke('search_pages', {
  siteUrl: 'https://ts-staging.wavedepth.com',
  apiKey: process.env.ATB_STAGING_API_KEY,
  query: '',
  perPage: 10
}).then(r => JSON.stringify({count: r.length, pages: r.map(p => ({id: p.id, title: p.title}))}))
```
Expected: Returns pages from staging (Style Guide, About Us, etc.)

**Step 2: Get elements for test page 1338**

Use MCP tool: `execute_js`:
```javascript
window.__TAURI__.core.invoke('get_page_elements', {
  siteUrl: 'https://ts-staging.wavedepth.com',
  apiKey: process.env.ATB_STAGING_API_KEY,
  pageId: 1338
}).then(r => JSON.stringify({
  element_count: r.count,
  content_hash: r.contentHash,
  first_element: r.elements?.[0]?.name
}))
```
Expected: 22 elements, valid content hash

**GREEN phase — verify correct data:**

**Step 3: Verify page data integrity**

The above calls should return real data from ts-staging. Cross-reference with the curl tests we already ran:
- Pages include "Style Guide", "About Us", "Academic Calendar"
- Page 1338 has 22 elements with content hash `a0633c86bf4a546d499e04feef969028`

---

### Task 11: E2E Test — Sidebar & UI Interactions

**Step 1: Test sidebar collapse/expand**

Use MCP tool: `click` on sidebar collapse button
Use MCP tool: `take_screenshot`
Verify: Sidebar collapsed to icon mode (~56px)

Use MCP tool: `click` on sidebar expand button
Use MCP tool: `take_screenshot`
Verify: Sidebar expanded (~240px)

**Step 2: Test keyboard shortcut — Cmd+K**

Use MCP tool: `execute_js`:
```javascript
document.dispatchEvent(new KeyboardEvent('keydown', {key: 'k', metaKey: true, bubbles: true}));
'dispatched'
```
Use MCP tool: `take_screenshot`
Verify: Command palette opens

**Step 3: Close command palette**

Use MCP tool: `execute_js`:
```javascript
document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
'dispatched'
```

**Step 4: Test theme toggle**

Open settings, find theme toggle, click it.
Use MCP tool: `take_screenshot`
Verify: Theme switches (light ↔ dark)

---

### Task 12: E2E Test — Session Launch & Terminal

**Step 1: Launch a tool session**

Use MCP tool: `click` on a tool's launch/play button in sidebar
Use MCP tool: Wait for LaunchDialog
Use MCP tool: `take_screenshot` — capture launch dialog
Use MCP tool: `click` on Launch/Start button

**Step 2: Verify terminal renders**

Use MCP tool: `wait_for` — wait for terminal canvas element
Use MCP tool: `take_screenshot`
Verify: xterm.js terminal visible with shell prompt or tool startup

**Step 3: Verify session appears in sidebar**

Use MCP tool: `execute_js`:
```javascript
JSON.stringify(Array.from(document.querySelectorAll('[data-session-id]')).map(el => ({
  id: el.getAttribute('data-session-id'),
  text: el.textContent
})))
```
Expected: At least one session entry

---

### Task 13: Write test results summary & commit

**Step 1: Create results directory**

```bash
mkdir -p gui/e2e/results
```

**Step 2: Create test summary document**

Create `gui/e2e/README.md` documenting:
- How to run E2E tests (start app with MCP, use Claude Code)
- Test inventory with pass/fail status
- Known issues found during testing

**Step 3: Final screenshot — full app with staging data**

Use MCP tool: `take_screenshot`
Capture the app in its fully configured state with staging site connected

**Step 4: Commit all test artifacts**

```bash
git add gui/e2e/
git commit -m "test(gui): add E2E test suite with tauri-plugin-mcp"
```

**Step 5: Run full verification**

```bash
cd gui && npm run build          # TypeScript still passes
cd cli && go test ./...          # Go tests still pass
cd cli && go vet ./...           # Go lint still passes
make check-version               # Version sync
```
Expected: All pass — no regressions from MCP plugin addition

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during E2E testing"
```
