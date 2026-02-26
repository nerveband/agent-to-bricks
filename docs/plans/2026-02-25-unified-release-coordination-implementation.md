# Unified Release, Auto-Update & Cross-Project Coordination — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the release pipeline, add GUI auto-updates, create cross-project CLAUDE.md files with hard checklists, rewrite the README, and add cross-component install awareness.

**Architecture:** Single `VERSION` file drives all versions. GitHub Actions builds CLI+GUI+Plugin on tag push. Tauri updater plugin pulls from GitHub Releases. CLAUDE.md in each subfolder enforces cross-project checks. Each component detects the others and links to agentstobricks.com for install guides.

**Tech Stack:** Go (CLI), Rust/Tauri 2/React 19/TypeScript (GUI), PHP 8.0+ (Plugin), Astro/Starlight (Website), GitHub Actions (CI/CD), GoReleaser (CLI builds), tauri-plugin-updater (GUI updates)

---

### Task 1: Create Root CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write the CLAUDE.md file**

```markdown
# Agent to Bricks

Monorepo with 4 components: CLI (Go), GUI (Tauri/React), Plugin (WordPress/PHP), Website (Astro/Starlight).

## Version Rule

Single source of truth: `/VERSION` file. ALL component versions MUST match.
Every release bumps ALL versions, even if only one component changed.

- Run `make sync-version` after changing VERSION
- Run `make check-version` to verify (CI gate on every PR)

## Components

| Component | Path | Language | Build | Test |
|-----------|------|----------|-------|------|
| CLI | `cli/` | Go 1.22+ | `make build` | `cd cli && go test ./...` |
| GUI | `gui/` | Rust + React/TS | `cd gui && npm run tauri build` | `cd gui && npm run build` (type-check) |
| Plugin | `plugin/agent-to-bricks/` | PHP 8.0+ | `./scripts/build-plugin-zip.sh` | (manual endpoint tests) |
| Website | `website/` | Astro/TS | `cd website && npm run build` | `cd website && npm run build` |

## Cross-Component Dependencies

| If you change... | Also check/update... |
|-----------------|---------------------|
| Plugin REST endpoint | CLI client (`cli/internal/client/`), GUI Rust backend (`gui/src-tauri/src/lib.rs`), API docs (`website/src/content/docs/plugin/rest-api.md`) |
| Plugin auth mechanism | CLI client, GUI HTTP headers |
| CLI command or flag | CLI docs (`website/src/content/docs/cli/`), README |
| GUI feature | GUI docs (`website/src/content/docs/gui/`), README |
| Any user-facing behavior | Website docs, README |
| Config format | CLI config (`cli/internal/config/`), GUI config (`gui/src-tauri/src/config.rs`), config docs |

## Documentation

All documentation lives at [agentstobricks.com](https://agentstobricks.com). The website/ folder is the source of truth. README.md is a concise portal that links to the website.

## Release Process

1. Update `VERSION` file
2. `make sync-version`
3. Commit: `chore: bump version to X.Y.Z`
4. `git tag vX.Y.Z && git push origin vX.Y.Z`
5. GitHub Actions builds everything → draft release
6. Review and publish

## Auth

All components use `X-ATB-Key` custom header (not Authorization). API key stored in `~/.agent-to-bricks/config.yaml`.

## Staging

- Server: ts-staging.wavedepth.com (23.94.202.65)
- After deploy: `chown -R runcloud:runcloud` plugin dir + restart PHP-FPM
- Test page ID: 1338
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add root CLAUDE.md with project-wide rules"
```

---

### Task 2: Create Per-Component CLAUDE.md Files

**Files:**
- Create: `cli/CLAUDE.md`
- Create: `gui/CLAUDE.md`
- Create: `plugin/CLAUDE.md`
- Create: `website/CLAUDE.md`

**Step 1: Create `cli/CLAUDE.md`**

```markdown
# CLI — Agent to Bricks

Go CLI (`bricks`) for Bricks Builder page management. Uses Cobra for commands, Bubbletea for TUI.

## Build & Test

```bash
cd cli && go test ./...           # run all tests
cd cli && go vet ./...            # lint
make build                        # build binary → bin/bricks
make install                      # install to /usr/local/bin
```

## Key Paths

- Entry point: `main.go` (version injected via ldflags)
- Commands: `cmd/` (one file per command)
- API client: `internal/client/client.go`
- Self-updater: `internal/updater/`
- Config: `internal/config/config.go`

## Pre-Completion Checklist (MANDATORY)

Before completing ANY change in this component:

- [ ] `cd cli && go test ./...` passes
- [ ] `cd cli && go vet ./...` passes
- [ ] `make check-version` passes (from project root)
- [ ] If CLI command/flag changed → update `website/src/content/docs/cli/` relevant page
- [ ] If API client changed → verify GUI still compiles (`cd gui && npm run build`)
- [ ] If config format changed → update `website/src/content/docs/getting-started/configuration.md`
- [ ] If user-facing output changed → update README if affected

## Impact Map

- `cmd/*.go` → CLI docs (website), README examples
- `internal/client/client.go` → Must match plugin REST endpoints
- `internal/config/config.go` → Shared with GUI (`gui/src-tauri/src/config.rs`)
- `internal/updater/` → GitHub Release asset naming conventions
```

**Step 2: Create `gui/CLAUDE.md`**

```markdown
# GUI — Agent to Bricks Desktop App

Tauri 2 desktop app with React 19 + TypeScript frontend. Manages AI coding tool sessions.

## Build & Test

```bash
cd gui && npm install             # install dependencies
cd gui && npm run build           # TypeScript type-check + Vite build
cd gui && npm run tauri dev       # development mode
cd gui && npm run tauri build     # production build
```

## Key Paths

- Tauri backend: `src-tauri/src/lib.rs` (commands, HTTP client)
- Config I/O: `src-tauri/src/config.rs`
- React app: `src/App.tsx` → `src/components/AppShell.tsx`
- State: `src/atoms/` (Jotai atoms)
- Hooks: `src/hooks/` (tool detection, PTY, config persistence)
- Tauri config: `src-tauri/tauri.conf.json`

## Pre-Completion Checklist (MANDATORY)

Before completing ANY change in this component:

- [ ] `cd gui && npm run build` passes (TypeScript type-check)
- [ ] `make check-version` passes (from project root)
- [ ] If GUI feature changed → update `website/src/content/docs/gui/` relevant page
- [ ] If API calls changed → verify they match plugin REST endpoints
- [ ] If config read/write changed → verify CLI config compatibility
- [ ] If Tauri config changed → verify `src-tauri/capabilities/default.json` has needed permissions

## Impact Map

- `src-tauri/src/lib.rs` API calls → Must match plugin REST endpoints
- `src-tauri/src/config.rs` → Shared config format with CLI
- `src/atoms/tools.ts` → Tool detection (CLI binary name: `bricks`)
- `src-tauri/tauri.conf.json` → Version must match `/VERSION`, updater endpoint
- `package.json` → Version must match `/VERSION`
- `src-tauri/Cargo.toml` → Version must match `/VERSION`
```

**Step 3: Create `plugin/CLAUDE.md`**

```markdown
# Plugin — Agent to Bricks WordPress Plugin

PHP 8.0+ WordPress plugin providing REST API for Bricks Builder content management.

## Build & Test

```bash
./scripts/build-plugin-zip.sh     # package plugin ZIP
make check-version                # verify version consistency
```

## Key Paths

- Main file: `agent-to-bricks/agent-to-bricks.php` (version header + constant)
- REST endpoints: `agent-to-bricks/includes/class-*-api.php`
- Auth: `agent-to-bricks/includes/class-api-auth.php`
- Settings UI: `agent-to-bricks/includes/class-settings.php`
- Update system: `agent-to-bricks/includes/class-update-api.php`, `class-update-checker.php`
- Access control: `agent-to-bricks/includes/class-access-control.php`

## Pre-Completion Checklist (MANDATORY)

Before completing ANY change in this component:

- [ ] PHP lint: `for f in plugin/agent-to-bricks/**/*.php; do php -l "$f"; done` passes
- [ ] `make check-version` passes (from project root)
- [ ] If REST endpoint added/changed → update CLI client (`cli/internal/client/`)
- [ ] If REST endpoint added/changed → update GUI API calls (`gui/src-tauri/src/lib.rs`)
- [ ] If REST endpoint added/changed → update `website/src/content/docs/plugin/rest-api.md`
- [ ] If auth changed → update CLI and GUI auth headers
- [ ] If settings page changed → update `website/src/content/docs/plugin/settings.md`

## Impact Map

- `class-*-api.php` endpoints → CLI client types, GUI Rust backend, REST API docs
- `class-api-auth.php` → CLI auth headers, GUI X-ATB-Key header
- `class-settings.php` → Plugin settings docs, links to agentstobricks.com
- `class-update-api.php` → CLI update command, GitHub Release asset naming
- `agent-to-bricks.php` version → Must match `/VERSION`
```

**Step 4: Create `website/CLAUDE.md`**

```markdown
# Website — Agent to Bricks Documentation

Astro 5 + Starlight documentation site at agentstobricks.com.

## Build & Test

```bash
cd website && npm install         # install dependencies
cd website && npm run dev         # development server
cd website && npm run build       # production build (validates all pages)
```

## Key Paths

- Config: `astro.config.mjs`
- Homepage: `src/pages/index.astro`
- Documentation: `src/content/docs/` (37 Markdown pages)
- Styles: `src/styles/custom.css`
- Components: `src/components/home/`

## Documentation Structure

- `getting-started/` — installation, quick-start, configuration
- `cli/` — CLI command reference (11 pages)
- `gui/` — Desktop app guide (6 pages)
- `plugin/` — Plugin reference (6 pages)
- `guides/` — How-to guides (6 pages)
- `about/` — Philosophy, roadmap, contributing (4 pages)

## Pre-Completion Checklist (MANDATORY)

Before completing ANY change in this component:

- [ ] `cd website && npm run build` passes
- [ ] If CLI docs changed → verify accuracy against current CLI code (`cli/cmd/`)
- [ ] If plugin docs changed → verify accuracy against current plugin code (`plugin/`)
- [ ] If GUI docs changed → verify accuracy against current GUI code (`gui/src/`)
- [ ] If installation page changed → verify download links match GitHub Release assets
- [ ] Domain is `agentstobricks.com` everywhere (not agent-to-bricks.dev)

## Impact Map

- `src/content/docs/` → Must accurately reflect current code behavior
- `astro.config.mjs` → Site URL must be https://agentstobricks.com
- Homepage GetStartedSection → Install instructions must match current process
```

**Step 5: Commit**

```bash
git add cli/CLAUDE.md gui/CLAUDE.md plugin/CLAUDE.md website/CLAUDE.md
git commit -m "docs: add per-component CLAUDE.md with cross-project checklists"
```

---

### Task 3: Generate Tauri Signing Keys

This is a manual/interactive step that must happen before the GUI updater can work.

**Step 1: Generate the signing keypair**

Run from the `gui/` directory:

```bash
cd gui && npx tauri signer generate -w ~/.tauri/agent-to-bricks.key
```

This will:
- Create a private key at `~/.tauri/agent-to-bricks.key`
- Output the public key to stdout
- Optionally ask for a password (recommended for production)

**Step 2: Save the public key**

Copy the public key output (starts with `dW50cnVzdGVk...`). You'll need it for `tauri.conf.json` in the next task.

**Step 3: Store the private key as a GitHub Actions secret**

Go to GitHub repo → Settings → Secrets → Actions:
- `TAURI_SIGNING_PRIVATE_KEY` = contents of `~/.tauri/agent-to-bricks.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = the password you set (if any)

**Step 4: Commit (nothing to commit — keys are stored externally)**

---

### Task 4: Add GUI Auto-Updater — Rust Backend

**Files:**
- Modify: `gui/src-tauri/Cargo.toml`
- Modify: `gui/src-tauri/src/lib.rs`
- Modify: `gui/src-tauri/capabilities/default.json`
- Modify: `gui/src-tauri/tauri.conf.json`
- Modify: `gui/package.json`

**Step 1: Add Rust dependencies to `Cargo.toml`**

Add to `[dependencies]` section in `gui/src-tauri/Cargo.toml`:

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

**Step 2: Register plugins in `lib.rs`**

In `gui/src-tauri/src/lib.rs`, update the `run()` function to register the updater and process plugins:

```rust
pub fn run() {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("Failed to create HTTP client");

    tauri::Builder::default()
        .manage(HttpClient(Arc::new(client)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // ... existing handlers unchanged ...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Add permissions to `capabilities/default.json`**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "pty:default",
    "sql:default",
    "dialog:default",
    "updater:default",
    "process:relaunch"
  ]
}
```

**Step 4: Configure updater in `tauri.conf.json`**

Add `createUpdaterArtifacts` to bundle and `updater` to plugins. The public key placeholder `REPLACE_WITH_PUBLIC_KEY` must be replaced with the key from Task 3:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Agent to Bricks",
  "version": "1.4.0",
  "identifier": "com.agentobricks.gui",
  "build": { ... },
  "app": { ... },
  "bundle": {
    "active": true,
    "targets": "all",
    "category": "DeveloperTool",
    "shortDescription": "Build Bricks Builder pages with AI coding agents",
    "createUpdaterArtifacts": true,
    "icon": [ ... ],
    "linux": { ... }
  },
  "plugins": {
    "updater": {
      "pubkey": "REPLACE_WITH_PUBLIC_KEY",
      "endpoints": [
        "https://github.com/nerveband/agent-to-bricks/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**Step 5: Add npm dependencies to `package.json`**

```bash
cd gui && npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

**Step 6: Verify it compiles**

```bash
cd gui && npm run build
```

**Step 7: Commit**

```bash
git add gui/src-tauri/Cargo.toml gui/src-tauri/Cargo.lock gui/src-tauri/src/lib.rs gui/src-tauri/capabilities/default.json gui/src-tauri/tauri.conf.json gui/package.json gui/package-lock.json
git commit -m "feat(gui): add tauri-plugin-updater and tauri-plugin-process"
```

---

### Task 5: Add GUI Auto-Updater — React Frontend

**Files:**
- Create: `gui/src/hooks/useAutoUpdater.ts`
- Create: `gui/src/components/UpdateNotification.tsx`
- Modify: `gui/src/components/AppShell.tsx`
- Modify: `gui/src/components/SettingsDialog.tsx`

**Step 1: Create `gui/src/hooks/useAutoUpdater.ts`**

```typescript
import { useState, useEffect, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateState {
  checking: boolean;
  available: boolean;
  version: string | null;
  body: string | null;
  downloading: boolean;
  progress: number; // 0-100
  error: string | null;
}

const initialState: UpdateState = {
  checking: false,
  available: false,
  version: null,
  body: null,
  downloading: false,
  progress: 0,
  error: null,
};

export function useAutoUpdater() {
  const [state, setState] = useState<UpdateState>(initialState);
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = useCallback(async () => {
    setState((s) => ({ ...s, checking: true, error: null }));
    try {
      const result = await check();
      if (result) {
        setUpdate(result);
        setState((s) => ({
          ...s,
          checking: false,
          available: true,
          version: result.version,
          body: result.body,
        }));
      } else {
        setState((s) => ({ ...s, checking: false, available: false }));
      }
    } catch (e) {
      setState((s) => ({
        ...s,
        checking: false,
        error: e instanceof Error ? e.message : "Update check failed",
      }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update) return;
    setState((s) => ({ ...s, downloading: true, progress: 0, error: null }));
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              setState((s) => ({
                ...s,
                progress: Math.round((downloadedBytes / totalBytes) * 100),
              }));
            }
            break;
          case "Finished":
            setState((s) => ({ ...s, progress: 100 }));
            break;
        }
      });
      await relaunch();
    } catch (e) {
      setState((s) => ({
        ...s,
        downloading: false,
        error: e instanceof Error ? e.message : "Update failed",
      }));
    }
  }, [update]);

  const dismiss = useCallback(() => setDismissed(true), []);

  // Check on mount (background, non-blocking)
  useEffect(() => {
    const timer = setTimeout(() => checkForUpdates(), 2000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    dismissed,
    checkForUpdates,
    installUpdate,
    dismiss,
  };
}
```

**Step 2: Create `gui/src/components/UpdateNotification.tsx`**

```tsx
import { useAutoUpdater } from "../hooks/useAutoUpdater";

export function UpdateNotification() {
  const {
    available,
    version,
    downloading,
    progress,
    error,
    dismissed,
    installUpdate,
    dismiss,
  } = useAutoUpdater();

  if (!available || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-xl p-4 shadow-lg border"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
        maxWidth: 340,
      }}
    >
      {downloading ? (
        <div className="space-y-2">
          <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
            Updating to v{version}...
          </p>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-input)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: "var(--yellow)",
              }}
            />
          </div>
          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
            {progress}% — App will restart when done
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p
              className="text-[13px] font-medium"
              style={{ color: "var(--fg)" }}
            >
              Update available: v{version}
            </p>
            {error && (
              <p className="text-[11px] mt-1" style={{ color: "#ef4444" }}>
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={installUpdate}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{
                background: "var(--yellow)",
                color: "var(--bg)",
              }}
            >
              Update Now
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-[12px]"
              style={{ color: "var(--fg-muted)" }}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Mount `UpdateNotification` in `AppShell.tsx`**

Add import and render at the end of AppShell's return JSX:

```typescript
import { UpdateNotification } from "./UpdateNotification";
```

Add `<UpdateNotification />` as the last child inside the outermost `<div>` of AppShell's return.

**Step 4: Add "Check for Updates" to `SettingsDialog.tsx`**

In the About section of SettingsDialog (around line 531-538 where the version row is), add a "Check for Updates" button after the version display:

```typescript
import { check } from "@tauri-apps/plugin-updater";
```

Add a state variable and handler in the SettingsDialog component:

```typescript
const [updateStatus, setUpdateStatus] = useState<string>("");

const checkForUpdates = async () => {
  setUpdateStatus("Checking...");
  try {
    const result = await check();
    if (result) {
      setUpdateStatus(`v${result.version} available!`);
    } else {
      setUpdateStatus("Up to date");
    }
  } catch {
    setUpdateStatus("Check failed");
  }
  setTimeout(() => setUpdateStatus(""), 5000);
};
```

Add a row after the Version row:

```tsx
<div className="flex justify-between items-center text-[13px]">
  <span style={{ color: "var(--fg-muted)" }}>Updates</span>
  <button
    onClick={checkForUpdates}
    className="hover:underline text-[12px]"
    style={{ color: "var(--yellow)" }}
  >
    {updateStatus || "Check for Updates"}
  </button>
</div>
```

**Step 5: Verify build**

```bash
cd gui && npm run build
```

**Step 6: Commit**

```bash
git add gui/src/hooks/useAutoUpdater.ts gui/src/components/UpdateNotification.tsx gui/src/components/AppShell.tsx gui/src/components/SettingsDialog.tsx
git commit -m "feat(gui): add auto-updater UI with check-on-launch and manual check"
```

---

### Task 6: Fix Bricks CLI Install URL in Tools Atom

**Files:**
- Modify: `gui/src/atoms/tools.ts:54-62`

**Step 1: Update the `bricks` tool entry**

Change the `installInstructions` URL from the placeholder to the actual docs site:

```typescript
  {
    slug: "bricks",
    name: "Bricks CLI",
    command: "bricks",
    args: [],
    icon: "Bx",
    configPath: "~/.agent-to-bricks/config.yaml",
    installInstructions: {
      url: "https://agentstobricks.com/getting-started/installation/",
    },
  },
```

**Step 2: Commit**

```bash
git add gui/src/atoms/tools.ts
git commit -m "fix(gui): update bricks CLI install URL to docs site"
```

---

### Task 7: Enhance GUI Cross-Component Awareness

**Files:**
- Modify: `gui/src-tauri/src/lib.rs:379-401` (test_site_connection — already handles 404)

The existing `test_site_connection` function already returns appropriate messages for 404 (plugin not found) and 401/403 (invalid API key). The GUI `useToolDetection.ts` already detects CLI presence/absence. The `tools.ts` atom now has the correct install URL (Task 6).

No additional Rust changes needed. The existing behavior is sufficient — the GUI already:
- Detects CLI via `which bricks` and shows installed/not-installed status
- Shows "Plugin not found" when site returns 404
- Shows "Invalid API key" when site returns 401/403
- Links to install instructions from tools.ts

**Step 1: Verify no changes needed (read existing code)**

The install instructions URL was the only gap, fixed in Task 6.

**Step 2: No commit needed for this task**

---

### Task 8: Update Plugin Links to agentstobricks.com

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-settings.php:365-366`
- Modify: `plugin/agent-to-bricks/includes/class-update-checker.php:52-55`

**Step 1: Update settings page link**

In `class-settings.php`, find line 365-366:

```php
This plugin is designed to be paired with the Agent to Bricks CLI for AI-powered Bricks Builder workflows.<br>
Learn more and get the CLI at <a href="https://github.com/nerveband/agent-to-bricks" target="_blank">github.com/nerveband/agent-to-bricks</a>.
```

Replace with:

```php
This plugin is designed to be paired with the Agent to Bricks CLI and Desktop App.<br>
Get the CLI: <a href="https://agentstobricks.com/getting-started/installation/" target="_blank">agentstobricks.com/getting-started/installation</a><br>
Get the Desktop App: <a href="https://agentstobricks.com/gui/overview/" target="_blank">agentstobricks.com/gui/overview</a>
```

**Step 2: Update admin notice to mention docs site**

In `class-update-checker.php`, find line 52-55 (the notice HTML):

```php
<strong>Agent to Bricks v<?php echo esc_html( $remote_version ); ?></strong> is available
(you have v<?php echo esc_html( $local_version ); ?>).
Update from your CLI: <code>bricks update</code>
```

Replace with:

```php
<strong>Agent to Bricks v<?php echo esc_html( $remote_version ); ?></strong> is available
(you have v<?php echo esc_html( $local_version ); ?>).
Update via CLI: <code>bricks update</code> or download from
<a href="https://agentstobricks.com/getting-started/installation/" target="_blank">agentstobricks.com</a>.
```

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-settings.php plugin/agent-to-bricks/includes/class-update-checker.php
git commit -m "fix(plugin): update links to agentstobricks.com docs site"
```

---

### Task 9: Add Desktop App Mention to CLI Version Output

**Files:**
- Modify: `cli/cmd/version.go:51-52`

**Step 1: Add desktop app mention**

After the "Plugin: (no site configured)" else block (around line 52), add:

```go
func showVersion() error {
	fmt.Printf("CLI:       v%s (commit: %s, built: %s)\n", cliVersion, cliCommit, cliDate)

	if cfg != nil && cfg.Site.URL != "" && cfg.Site.APIKey != "" {
		c := newSiteClient()
		info, err := c.GetSiteInfo()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Plugin:    (unreachable: %v)\n", err)
		} else {
			fmt.Printf("Plugin:    v%s (on %s)\n", info.PluginVersion, cfg.Site.URL)

			if updater.MajorMinorMatch(cliVersion, info.PluginVersion) {
				fmt.Println("Status:    in sync")
			} else {
				fmt.Println("Status:    VERSION MISMATCH — run: bricks update")
			}

			fmt.Println()
			fmt.Printf("Bricks:    %s\n", info.BricksVersion)
			fmt.Printf("WordPress: %s\n", info.WPVersion)
			fmt.Printf("PHP:       %s\n", info.PHPVersion)
		}
	} else {
		fmt.Println("Plugin:    (no site configured)")
	}

	fmt.Println()
	fmt.Println("Docs:      https://agentstobricks.com")

	return nil
}
```

**Step 2: Run tests**

```bash
cd cli && go test ./cmd/... -run TestVersion -v
```

**Step 3: Commit**

```bash
git add cli/cmd/version.go
git commit -m "feat(cli): add docs link to version output"
```

---

### Task 10: Enhance CLI Plugin-Missing Message

**Files:**
- Modify: `cli/cmd/root.go:34-36` (or wherever plugin connection errors appear)
- Modify: `cli/cmd/version.go:35`

**Step 1: Update version.go plugin unreachable message**

Change line 35 from:

```go
fmt.Fprintf(os.Stderr, "Plugin:    (unreachable: %v)\n", err)
```

To:

```go
fmt.Fprintf(os.Stderr, "Plugin:    (unreachable: %v)\n", err)
fmt.Fprintf(os.Stderr, "           Install: https://agentstobricks.com/getting-started/installation/\n")
```

**Step 2: Run tests**

```bash
cd cli && go test ./...
```

**Step 3: Commit**

```bash
git add cli/cmd/version.go
git commit -m "feat(cli): add install link when plugin is unreachable"
```

---

### Task 11: Enhance Makefile with Release Targets

**Files:**
- Modify: `Makefile`

**Step 1: Add release-prep and tag-release targets**

Append to the Makefile:

```makefile
.PHONY: release-prep tag-release

# Sync versions, run all tests, then prompt for commit
release-prep: sync-version
	cd cli && go test ./...
	cd gui && npm run build
	@echo ""
	@echo "All versions synced and tests passed."
	@echo "Commit with: git commit -am 'chore: bump version to $(VERSION)'"

# Create and push a release tag from VERSION file
tag-release:
	@echo "Tagging v$(VERSION)..."
	git tag "v$(VERSION)"
	git push origin "v$(VERSION)"
	@echo "Tag v$(VERSION) pushed. GitHub Actions will build the release."
```

**Step 2: Commit**

```bash
git add Makefile
git commit -m "feat: add release-prep and tag-release Makefile targets"
```

---

### Task 12: Rewrite Root README.md

**Files:**
- Modify: `README.md`

**Step 1: Rewrite README as portal to docs site**

Replace the entire contents of `README.md` with:

```markdown
# Agent to Bricks

AI-powered page building for [Bricks Builder](https://bricksbuilder.io/) — CLI, Desktop App, and WordPress Plugin.

Write HTML using your site's CSS classes, convert it to Bricks elements, and push it to any page. Designed for both humans and AI coding agents.

## Components

| Component | Description |
|-----------|-------------|
| **CLI** | Terminal tool for page operations, AI generation, search, and templates |
| **Desktop App** | Visual session manager for AI coding tools (Claude Code, Codex, etc.) |
| **WordPress Plugin** | REST API bridge to your Bricks Builder site |
| **[Documentation](https://agentstobricks.com)** | Full guides, references, and tutorials |

## Quick Start

### 1. Install the plugin

Download the plugin ZIP from the [latest release](https://github.com/nerveband/agent-to-bricks/releases/latest) and upload it in WordPress under **Plugins > Add New > Upload Plugin**. Then go to **Settings > Agent to Bricks** and generate an API key.

### 2. Install the CLI

Download the binary for your platform from the [latest release](https://github.com/nerveband/agent-to-bricks/releases/latest):

```bash
# Mac / Linux
tar xzf agent-to-bricks_*.tar.gz
sudo mv bricks /usr/local/bin/
```

### 3. Connect

```bash
bricks config init          # interactive setup
bricks site info            # verify connection
```

### 4. Build something

```bash
bricks generate section "dark hero with CTA" --page 42 --snapshot
```

[Full installation guide](https://agentstobricks.com/getting-started/installation/) | [Quick start](https://agentstobricks.com/getting-started/quick-start/)

## Documentation

All documentation lives at **[agentstobricks.com](https://agentstobricks.com)**:

- [Getting Started](https://agentstobricks.com/getting-started/introduction/)
- [CLI Reference](https://agentstobricks.com/cli/site-commands/)
- [Desktop App Guide](https://agentstobricks.com/gui/overview/)
- [Plugin Reference](https://agentstobricks.com/plugin/rest-api/)
- [Guides](https://agentstobricks.com/guides/bring-your-own-agent/)

## Updating

```bash
bricks update              # update CLI + plugin
bricks update --check      # check without installing
```

The Desktop App checks for updates automatically on launch.

## Requirements

- WordPress 6.0+ with Bricks Builder 1.9+
- PHP 8.0+
- Optional: Automatic.css 3.x for design token support

## For Contributors

```bash
make build          # build CLI binary
make test           # run Go tests
make sync-version   # sync VERSION across all components
make check-version  # verify version consistency
```

[Contributing guide](https://agentstobricks.com/about/contributing/)

## License

GPL-3.0
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README as concise portal to docs site"
```

---

### Task 13: Fix Website Domain to agentstobricks.com

**Files:**
- Modify: `website/astro.config.mjs`

**Step 1: Update site URL**

Change:

```javascript
site: 'https://agent-to-bricks.dev',
```

To:

```javascript
site: 'https://agentstobricks.com',
```

**Step 2: Verify build**

```bash
cd website && npm run build
```

**Step 3: Commit**

```bash
git add website/astro.config.mjs
git commit -m "fix(website): update domain to agentstobricks.com"
```

---

### Task 14: Create GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the CI workflow**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  version-check:
    name: Version Consistency
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/sync-version.sh --check

  cli-tests:
    name: CLI Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: cli/go.mod
      - run: cd cli && go test ./...
      - run: cd cli && go vet ./...

  gui-typecheck:
    name: GUI Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd gui && npm ci
      - run: cd gui && npx tsc --noEmit

  plugin-lint:
    name: Plugin PHP Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: "8.2"
      - run: |
          find plugin/agent-to-bricks -name "*.php" -exec php -l {} \;

  website-build:
    name: Website Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd website && npm ci && npm run build
```

**Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/ci.yml
git commit -m "ci: add CI workflow with version gate and cross-component checks"
```

---

### Task 15: Create GitHub Actions Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Create the release workflow**

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  build-cli:
    name: Build CLI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-go@v5
        with:
          go-version-file: cli/go.mod
      - uses: goreleaser/goreleaser-action@v6
        with:
          distribution: goreleaser
          version: "~> v2"
          args: release --clean
          workdir: cli
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build-plugin:
    name: Build Plugin ZIP
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build plugin ZIP
        run: ./scripts/build-plugin-zip.sh
      - name: Upload to release
        uses: softprops/action-gh-release@v2
        with:
          files: agent-to-bricks-plugin-*.zip
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build-gui:
    name: Build GUI (${{ matrix.platform }})
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target aarch64-apple-darwin
          - platform: macos-latest
            args: --target x86_64-apple-darwin
          - platform: ubuntu-22.04
            args: ""
          - platform: windows-latest
            args: ""
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install GUI dependencies
        run: cd gui && npm ci

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # macOS code signing (optional — skipped if secrets not set)
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          projectPath: gui
          tauriScript: npx tauri
          tagName: ${{ github.ref_name }}
          releaseName: "Agent to Bricks ${{ github.ref_name }}"
          releaseBody: "See [Changelog](https://agentstobricks.com/about/roadmap/) for details."
          releaseDraft: true
          prerelease: false
          includeUpdaterJson: true
          args: ${{ matrix.args }}

  verify:
    name: Verify Release Assets
    needs: [build-cli, build-plugin, build-gui]
    runs-on: ubuntu-latest
    steps:
      - name: Check release has expected assets
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          TAG="${{ github.ref_name }}"
          VERSION="${TAG#v}"
          echo "Checking release assets for $TAG..."

          # Wait for assets to be available
          sleep 10

          ASSETS=$(gh release view "$TAG" --repo "${{ github.repository }}" --json assets -q '.assets[].name')
          echo "Assets found:"
          echo "$ASSETS"

          # Check for CLI binaries
          echo "$ASSETS" | grep -q "checksums.txt" || echo "WARNING: checksums.txt missing"

          # Check for plugin ZIP
          echo "$ASSETS" | grep -q "agent-to-bricks-plugin" || echo "WARNING: plugin ZIP missing"

          # Check for updater manifest
          echo "$ASSETS" | grep -q "latest.json" || echo "WARNING: latest.json missing"

          echo "Release verification complete."
```

**Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add unified release workflow for CLI, GUI, and Plugin"
```

---

### Task 16: Enhance sync-version.sh with Cargo.lock

**Files:**
- Modify: `scripts/sync-version.sh`

**Step 1: Add Cargo.lock regeneration after version sync**

After the "All versions synced" message at the end of the script (line 140), add:

```bash
# --- 6. Regenerate Cargo.lock if versions changed ---

if ! $CHECK_MODE; then
    if command -v cargo >/dev/null 2>&1; then
        echo "Regenerating Cargo.lock..."
        (cd "$ROOT_DIR/gui/src-tauri" && cargo generate-lockfile 2>/dev/null) || true
    fi
fi

echo ""
echo "All versions synced to $VERSION"
```

And remove the duplicate "All versions synced" line that was there before.

**Step 2: Verify**

```bash
./scripts/sync-version.sh --check
```

Expected: all OK.

**Step 3: Commit**

```bash
git add scripts/sync-version.sh
git commit -m "feat: add Cargo.lock regeneration to sync-version script"
```

---

### Task 17: Final Verification

**Step 1: Run version consistency check**

```bash
make check-version
```

Expected: All versions at 1.4.0, zero mismatches.

**Step 2: Run CLI tests**

```bash
cd cli && go test ./...
```

Expected: All tests pass.

**Step 3: Run GUI type check**

```bash
cd gui && npm run build
```

Expected: TypeScript compiles, Vite bundles.

**Step 4: Run plugin PHP lint**

```bash
find plugin/agent-to-bricks -name "*.php" -exec php -l {} \;
```

Expected: No syntax errors.

**Step 5: Run website build**

```bash
cd website && npm run build
```

Expected: Astro builds successfully.

**Step 6: Verify CLAUDE.md files exist**

```bash
ls CLAUDE.md cli/CLAUDE.md gui/CLAUDE.md plugin/CLAUDE.md website/CLAUDE.md
```

Expected: All 5 files present.

**Step 7: Verify GitHub workflows exist**

```bash
ls .github/workflows/ci.yml .github/workflows/release.yml
```

Expected: Both files present.

**Step 8: Review git log**

```bash
git log --oneline -15
```

Verify all commits are present and well-described.
