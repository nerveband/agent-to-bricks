# Auto-update design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this.

**Goal:** Lockstep versioning between CLI and plugin, with a single `bricks update` command that updates both sides.

**Architecture:** CLI checks GitHub Releases for new versions. On update, CLI replaces its own binary, then tells the plugin to pull its own update via a new REST endpoint. Plugin detects new versions independently but defers to the CLI as the single update path.

---

## 1. Version contract

CLI and plugin share one semver. A GitHub Release is one atomic unit:
- CLI binaries via GoReleaser (linux/darwin/windows, amd64/arm64)
- Plugin zip as an attached release asset (`agent-to-bricks-plugin-X.Y.Z.zip`)

### Version sources

- CLI: injected at build time via ldflags (`-X main.version=1.4.0`)
- Plugin: `AGENT_BRICKS_VERSION` constant + `Version:` header in `agent-to-bricks.php`

### Compatibility rule

Major.minor must match. Patch can differ (for hotfixes).

- CLI v1.4.0 + Plugin v1.4.2 = works
- CLI v1.4.0 + Plugin v1.3.0 = warning
- CLI v2.0.0 + Plugin v1.4.0 = hard error

### API enforcement

Every plugin REST response includes a new header:

```
X-ATB-Version: 1.4.0
```

The CLI reads this on every API call:

| Situation | Behavior |
|-----------|----------|
| Same major.minor | Silent |
| Plugin older | stderr warning (once per session): "Plugin v1.3.0 behind CLI v1.4.0. Run: bricks update" |
| CLI older | stderr warning: "CLI v1.3.0 behind plugin v1.4.0. Run: bricks update" |
| Major mismatch | Hard error, command aborts |

---

## 2. Update check (non-annoying notification)

### CLI side

On startup, before running any command, the CLI checks GitHub for a newer release.

- Cached to `~/.agent-to-bricks/update-check.json` with 24-hour TTL
- One line to stderr, does not interfere with stdout
- Shown once per session (not on every command in a script)
- Skipped for: `bricks update`, `bricks version`, `bricks help`, `bricks --version`

```
$ bricks site pull 1460

  Update available: v1.4.0 -> run: bricks update

Pulled 110 elements...
```

### Plugin side

Reuses the tailor-made GitHub Updater pattern: checks GitHub API every 6 hours via WordPress transient cache.

Does NOT hook into `pre_set_site_transient_update_plugins` (no WP admin "Update" button). Instead shows a dismissible admin notice on the dashboard and plugin settings page:

```
Agent to Bricks v1.4.0 is available (you have v1.3.0). Update from CLI: bricks update
```

Dismissible for 7 days, then reappears.

---

## 3. `bricks version` command

Shows both sides in one place:

```
$ bricks version

CLI:       v1.4.0 (commit: abc123, built: 2026-02-21)
Plugin:    v1.4.0 (on example.com)
Status:    in sync

Bricks:    1.12.1
WordPress: 6.7.2
PHP:       8.2.27
```

With `--changelog` flag, pulls release notes from GitHub Releases API:

```
$ bricks version --changelog

v1.4.0 (2026-02-22)
  - Add auto-update with lockstep versioning
  - Fix class registry cache invalidation

v1.3.0 (2026-02-21)
  - Add agent context self-discovery
  - ACSS-aware HTML converter
```

---

## 4. `bricks update` command

```
$ bricks update

Checking for updates...
  Latest: v1.4.0  (current CLI: v1.3.0, plugin: v1.3.0)

Updating CLI binary...  done (v1.4.0)
Updating plugin on example.com...  done (v1.4.0)

Both CLI and plugin are now v1.4.0.
```

### CLI self-update flow

1. Hit `https://api.github.com/repos/nerveband/agent-to-bricks/releases/latest`
2. Find the binary asset matching current OS/arch (e.g. `agent-to-bricks_1.4.0_darwin_arm64.tar.gz`)
3. Download to temp dir, extract, replace current binary in-place
4. Verify by running the new binary with `--version`

### Plugin remote update flow

1. CLI calls `POST /site/update` with `{"version": "1.4.0"}`
2. Plugin downloads its own zip from GitHub Releases (`agent-to-bricks-plugin-X.Y.Z.zip`)
3. Plugin uses WordPress `Plugin_Upgrader` class to install over itself
4. Returns `{"success": true, "version": "1.4.0"}`

### Flags

- `--cli-only` -- just update the CLI (useful if plugin site is unreachable)
- `--check` -- just check, don't install
- `--force` -- update even if already on latest (re-download)

### Edge cases

- Plugin update fails: CLI reports the error, but CLI itself is already updated. User reruns `bricks update` to retry just the plugin.
- No site configured: only update CLI.
- CLI is already latest but plugin is behind: skip CLI download, just update plugin.
- Multiple sites: `bricks update` updates the currently configured site. User switches config and runs again for other sites.

---

## 5. Plugin update endpoint

New REST endpoint:

```
POST /agent-bricks/v1/site/update
```

Request:
```json
{"version": "1.4.0"}
```

Response:
```json
{"success": true, "version": "1.4.0", "previousVersion": "1.3.0"}
```

Implementation:
1. Verify caller has `manage_options` capability
2. Download zip from `https://github.com/nerveband/agent-to-bricks/releases/download/v{version}/agent-to-bricks-plugin-{version}.zip`
3. Use `Plugin_Upgrader` with a silent skin (no HTML output)
4. Reactivate plugin after install
5. Return new version

Error response:
```json
{"success": false, "error": "Download failed: 404"}
```

---

## 6. Plugin version check (admin notice)

New file: `includes/class-update-checker.php`

Based on tailor-made's `class-github-updater.php` pattern:
- Checks `https://api.github.com/repos/nerveband/agent-to-bricks/releases/latest` every 6 hours (transient cache)
- Shows admin notice if remote version > local version
- Notice is dismissible (stored in user meta, expires after 7 days)
- Does not offer WP admin update button -- directs to CLI

---

## 7. Release process

Each release is one atomic action:

1. Bump version in:
   - `plugin/agent-to-bricks/agent-to-bricks.php` (both `Version:` header and `AGENT_BRICKS_VERSION` constant)
   - Optionally a `VERSION` file at repo root for scripting

2. Commit and tag:
   ```bash
   git commit -am "release: v1.4.0"
   git tag v1.4.0
   git push && git push --tags
   ```

3. GoReleaser runs (via GitHub Actions or manually):
   - Builds CLI binaries for all platforms
   - Creates the GitHub Release with changelog

4. Plugin zip built and attached to the release:
   - Script zips `plugin/agent-to-bricks/` as `agent-to-bricks-plugin-1.4.0.zip`
   - Attached via `gh release upload v1.4.0 agent-to-bricks-plugin-1.4.0.zip`

Future: a GitHub Action can automate step 4 as part of the GoReleaser workflow.

---

## Components summary

| Component | Location | What it does |
|-----------|----------|--------------|
| `cli/internal/updater/updater.go` | CLI | GitHub release checker, binary self-update, plugin update trigger |
| `cli/cmd/update.go` | CLI | `bricks update` command |
| `cli/cmd/version.go` | CLI | `bricks version` command with `--changelog` |
| Version check middleware | CLI | Reads `X-ATB-Version` header on every API call, warns on mismatch |
| Update check on startup | CLI | Cached GitHub check, one-line stderr notice |
| `includes/class-update-checker.php` | Plugin | GitHub release check, admin notice |
| `includes/class-update-api.php` | Plugin | `POST /site/update` endpoint, Plugin_Upgrader integration |
| `X-ATB-Version` header | Plugin | Added to all REST responses |
| `scripts/build-plugin-zip.sh` | Repo | Builds plugin zip for release |
| `.goreleaser.yaml` | Repo | Updated to include plugin zip in release |
