# Unified Release, Auto-Update & Cross-Project Coordination

Date: 2026-02-25

## Problem

The project has four components (CLI, GUI, Plugin, Website) that must stay version-synchronized. The GUI lacks auto-update capability. There are no CLAUDE.md files to guide AI agents working in any single component to check the others. Documentation is scattered between the README and website. The release process is manual and error-prone.

## Goals

1. **Unified release pipeline** — one git tag builds CLI, GUI, and Plugin, uploads all assets to one GitHub Release
2. **GUI auto-updater** — Tauri built-in updater with GitHub Releases, code-signed on macOS (Apple Developer) and Windows (SignPath Foundation when available)
3. **Cross-component awareness** — each component detects the others, offers install help when missing
4. **CLAUDE.md architecture** — hard checklists in every component ensuring cross-project consistency
5. **README as portal** — concise README routing to agenttobricks.com for all documentation
6. **Version lock-step** — every release bumps ALL component versions, even if only one changed

## Design

### 1. Unified Release Pipeline

**Workflow:** `.github/workflows/release.yml`
**Trigger:** Push tag matching `v*`

**Jobs (parallel):**

| Job | Tool | Outputs |
|-----|------|---------|
| `build-cli` | GoReleaser | 6 binaries (linux/darwin/windows x amd64/arm64), checksums.txt |
| `build-gui` | tauri-apps/tauri-action (matrix: macOS, Linux, Windows) | .dmg + .app.tar.gz (macOS), .AppImage (Linux), .exe/.msi (Windows), .sig files, latest.json |
| `build-plugin` | scripts/build-plugin-zip.sh | agent-to-bricks-plugin-VERSION.zip |
| `verify` | Custom (runs after all builds) | Validates all expected assets present |

**Code signing:**
- **Tauri update signing:** Mandatory, free. Ed25519 keypair generated via `npx tauri signer generate`. Private key in GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`. Public key in `tauri.conf.json`.
- **macOS:** Apple Developer ID. Secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`.
- **Windows:** SignPath Foundation (free for open source). Optional — workflow checks for `SIGNPATH_*` secrets and skips if not configured. When available: `SIGNPATH_API_TOKEN`, `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG`.

**Release process:**
1. Update `VERSION` file
2. `make sync-version` (patches all component files)
3. Commit: `chore: bump version to X.Y.Z`
4. `git tag vX.Y.Z && git push origin vX.Y.Z`
5. GitHub Actions builds everything → draft release
6. Review assets, publish
7. Auto-updaters (CLI, GUI, Plugin) pick up new version

### 2. GUI Auto-Updater

**Dependencies added:**
- `tauri-plugin-updater` (Cargo + npm)
- `tauri-plugin-process` (for relaunch)

**Config (`tauri.conf.json`):**
```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "<generated-tauri-public-key>",
      "endpoints": [
        "https://github.com/nerveband/agent-to-bricks/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**Capabilities:** Add `"updater:default"` and `"process:relaunch"` to `default.json`.

**Frontend:**
- `useAutoUpdater.ts` hook — checks for updates on launch (background, non-blocking)
- `UpdateNotification.tsx` component — toast: "v1.5.0 available — [Update Now] [Later]"
- Settings dialog: "Check for Updates" button next to version display
- Download progress bar during update install
- Auto-relaunch after install

**UX flow:**
1. App launch → background check → no update → nothing
2. Update available → toast notification
3. User clicks "Update Now" → progress bar → relaunch
4. User clicks "Later" → dismiss, remind next launch

### 3. Cross-Component Awareness

**GUI → CLI:**
- Already detects via `which bricks` (useToolDetection.ts)
- **New:** When CLI not found, show sidebar banner: "Bricks CLI not found. [Download] | [Installation guide]"
- Download links to correct platform asset from GitHub Releases
- Installation guide links to `agenttobricks.com/getting-started/installation/`
- When found but version mismatches GUI: warning with update instructions

**GUI → Plugin:**
- Already detects via `/site/info` (404 = not installed)
- **New:** When 404, show inline message: "Plugin not detected. [Installation guide]"
- Link: `agenttobricks.com/getting-started/installation/#wordpress-plugin`
- When version mismatch: "Plugin out of date. Update via: `bricks update`"

**CLI → Plugin:**
- Already warns on version mismatch in `bricks version` and `bricks site info`
- **New:** When plugin unreachable/404: "Plugin not detected. Install: agenttobricks.com/getting-started/installation/"

**CLI → GUI:**
- No active detection needed (independent tools)
- Help/about output mentions: "Desktop App: agenttobricks.com"

**Plugin → CLI/GUI:**
- Settings page links updated from GitHub to docs site:
  - "Get the CLI: agenttobricks.com/getting-started/installation/"
  - "Get the Desktop App: agenttobricks.com/gui/overview/"
- Admin update notice: "Update via CLI (`bricks update`) or download from agenttobricks.com"

### 4. CLAUDE.md Architecture

**File structure:**
```
/CLAUDE.md              ← Project-wide rules
/cli/CLAUDE.md          ← CLI rules + cross-project checklist
/gui/CLAUDE.md          ← GUI rules + cross-project checklist
/plugin/CLAUDE.md       ← Plugin rules + cross-project checklist
/website/CLAUDE.md      ← Website rules + cross-project checklist
```

**Root `/CLAUDE.md` contains:**
- Project overview: monorepo with 4 components
- Version rule: single source of truth is `/VERSION`, ALL versions bump together
- Release rule: every bump runs `make sync-version`
- Testing rule: changes to any component verify other components' tests
- Documentation rule: behavior changes reflected in website docs
- Cross-reference table mapping component files to their dependents

**Per-component CLAUDE.md contains:**
1. Component context (tech stack, build commands, test commands)
2. **Pre-completion checklist (MANDATORY):**
   - Run `make check-version` from project root
   - Run tests in this component
   - If API changed: verify CLI client and GUI API calls
   - If behavior changed: update website docs
   - If command/flag changed: update CLI reference docs
   - Check README accuracy
3. **Impact map** showing what changes affect other components:
   - Plugin REST endpoint → CLI client types, GUI Rust backend, API docs
   - CLI command → CLI docs, GUI tool detection, README
   - GUI feature → GUI docs, README
   - Website content → verify accuracy against current code

### 5. README Strategy

Root `README.md` is a concise portal:
- One-paragraph description
- Components table with version badges
- Brief installation snippets with "Full guide →" links
- All detail lives at agenttobricks.com
- Links to: Getting Started, CLI Reference, GUI Guide, Plugin Reference, Contributing

**Rule:** README never duplicates docs. Every section links to the website.

### 6. Version Synchronization

**Source of truth:** `/VERSION` file (currently `1.4.0`)

**`scripts/sync-version.sh` patches:**
- Plugin PHP header (`* Version:`)
- Plugin constant (`AGENT_BRICKS_VERSION`)
- GUI `package.json` (`"version":`)
- GUI `tauri.conf.json` (`"version":`)
- GUI `Cargo.toml` (`version =`)
- Then runs `cargo generate-lockfile` in gui/src-tauri/

**Makefile targets:**
- `make sync-version` — patch all files
- `make check-version` — verify consistency (CI gate, non-zero exit on mismatch)
- `make release-prep` — sync-version + all tests + commit
- `make tag-release` — create and push git tag

**CI gate:** `.github/workflows/ci.yml` runs `make check-version` on every PR. Fails if any component version doesn't match `VERSION`.

**Key rule:** Every release bumps ALL versions. CLI v1.5.0 = GUI v1.5.0 = Plugin v1.5.0. No partial bumps. No compatibility confusion.

### 7. Website Domain Fix

Update `astro.config.mjs` site URL from `agent-to-bricks.dev` to `agenttobricks.com`. Update all hardcoded domain references across components.

## Files Modified/Created

### New files
- `.github/workflows/release.yml` — unified release pipeline
- `.github/workflows/ci.yml` — PR checks (version gate, tests)
- `/CLAUDE.md` — project-wide rules
- `/cli/CLAUDE.md` — CLI rules + checklist
- `/gui/CLAUDE.md` — GUI rules + checklist
- `/plugin/CLAUDE.md` — plugin rules + checklist
- `/website/CLAUDE.md` — website rules + checklist
- `gui/src/hooks/useAutoUpdater.ts` — update check logic
- `gui/src/components/UpdateNotification.tsx` — update UI

### Modified files
- `gui/src-tauri/tauri.conf.json` — updater config, createUpdaterArtifacts
- `gui/src-tauri/Cargo.toml` — add tauri-plugin-updater, tauri-plugin-process
- `gui/src-tauri/Cargo.lock` — dependency resolution
- `gui/src-tauri/src/lib.rs` — register updater + process plugins
- `gui/src-tauri/capabilities/default.json` — add updater + process permissions
- `gui/package.json` — add @tauri-apps/plugin-updater, @tauri-apps/plugin-process
- `gui/src/components/SettingsDialog.tsx` — "Check for Updates" button
- `gui/src/components/AppShell.tsx` — mount UpdateNotification
- `gui/src/hooks/useToolDetection.ts` — enhanced CLI-missing messaging
- `gui/src-tauri/src/lib.rs` — enhanced plugin-missing messaging
- `plugin/agent-to-bricks/includes/class-settings.php` — update links to agenttobricks.com
- `plugin/agent-to-bricks/includes/class-update-checker.php` — update notice links
- `cli/cmd/version.go` — mention desktop app in output
- `cli/cmd/root.go` — plugin-missing install link
- `/README.md` — rewrite as portal to docs site
- `scripts/sync-version.sh` — add Cargo.lock handling
- `Makefile` — add release-prep, tag-release targets
- `website/astro.config.mjs` — domain fix to agenttobricks.com
