# Agent to Bricks -- agent guide

Instructions for AI agents (Claude Code, Codex, etc.) working on this project.

## Project structure

```
agent-to-bricks/
  cli/              Go CLI (cobra, bubbletea TUI)
  gui/              Tauri desktop app
  plugin/           WordPress plugin (PHP)
  website/          Website / marketing
  docs/             Documentation and reference data
    plans/          Design docs and implementation plans
    test-data/      452 Frames templates (gitignored)
    agents/         Agent reference data (gitignored)
  tests/            Test suites
    snippets/       JS browser snippet tests
  schema/           JSON schema definitions
  scripts/          Deploy and build scripts
  Makefile          build / test / install / deploy-staging
```

## Build and test

```bash
make build          # builds bin/bricks
make test           # runs all Go tests
make test-verbose   # verbose test output
make lint           # go vet
```

The CLI binary is at `bin/bricks` after build. Tests live next to the code they test (`_test.go` files).

## CLI architecture

Go module at `cli/`. Entry point is `cli/main.go`. Commands are in `cli/cmd/`. Core libraries are in `cli/internal/`.

Key packages:
- `internal/client/` -- REST API client for the WordPress plugin
- `internal/convert/` -- HTML-to-Bricks converter, class registry, style parser
- `internal/agent/` -- LLM context builder (md/json/prompt output)
- `internal/templates/` -- template catalog, Frames format loader, composer
- `internal/config/` -- YAML config at `~/.agent-to-bricks/config.yaml`

## Plugin architecture

PHP plugin at `plugin/agent-to-bricks/`. REST API namespace: `agent-bricks/v1`.

Auth: `X-ATB-Key` header with API key (generated in WP Admin > Settings > Agent to Bricks).

Key classes:
- `class-elements-api.php` -- GET/PUT/PATCH/DELETE page elements
- `class-classes-api.php` -- global class CRUD
- `class-snapshots-api.php` -- snapshot and rollback
- `class-site-api.php` -- site info, framework detection
- `class-api-auth.php` -- API key auth (hashed storage, X-ATB-Key header)

## Versioning

CLI and plugin share one semver. Both must show the same major.minor version.

- CLI version: injected via ldflags at build time (`-X main.version=X.Y.Z`)
- Plugin version: `AGENT_BRICKS_VERSION` constant + `Version:` header in `agent-to-bricks.php`

When making changes, bump both in the same commit.

## Release process

Each release is one atomic unit: CLI binaries + plugin zip, same version.

### Steps

1. Bump version in these files:
   - `plugin/agent-to-bricks/agent-to-bricks.php` -- both the `Version:` header comment AND the `AGENT_BRICKS_VERSION` constant
   - Version is injected into CLI via git tag + ldflags, no file to edit

2. Commit and tag:
   ```bash
   git commit -am "release: vX.Y.Z"
   git tag vX.Y.Z
   git push && git push --tags
   ```

3. GoReleaser builds CLI binaries (runs via `goreleaser release` or GitHub Actions):
   - Builds for linux/darwin/windows, amd64/arm64
   - Creates GitHub Release with changelog
   - Config: `cli/.goreleaser.yaml`

4. Build and attach plugin zip:
   ```bash
   cd plugin && zip -r ../agent-to-bricks-plugin-X.Y.Z.zip agent-to-bricks/
   gh release upload vX.Y.Z agent-to-bricks-plugin-X.Y.Z.zip
   ```

### What the release contains

- `agent-to-bricks_X.Y.Z_darwin_arm64.tar.gz` -- CLI binary (macOS ARM)
- `agent-to-bricks_X.Y.Z_darwin_amd64.tar.gz` -- CLI binary (macOS Intel)
- `agent-to-bricks_X.Y.Z_linux_amd64.tar.gz` -- CLI binary (Linux)
- `agent-to-bricks_X.Y.Z_windows_amd64.zip` -- CLI binary (Windows)
- `agent-to-bricks-plugin-X.Y.Z.zip` -- WordPress plugin
- `checksums.txt` -- SHA256 checksums

## Update system

CLI leads updates. `bricks update` does:
1. Self-updates CLI binary from GitHub Releases (matches OS/arch)
2. Calls `POST /site/update` to trigger plugin self-update on the connected WordPress site

Plugin checks GitHub every 6 hours and shows a WP admin notice if a new version exists, directing users to run `bricks update` from CLI.

Version mismatch enforcement: every API response includes `X-ATB-Version` header. CLI warns if versions differ, hard-blocks on major version mismatch.

## REST API endpoints

All require `X-ATB-Key` header.

| Endpoint | Method | What it does |
|----------|--------|--------------|
| `/site/info` | GET | Bricks version, WP version, element types |
| `/site/frameworks` | GET | ACSS tokens, framework detection |
| `/site/update` | POST | Trigger plugin self-update from GitHub |
| `/classes` | GET | All global classes (ACSS + Frames) |
| `/classes/<id>` | GET | Single class definition |
| `/pages/<id>/elements` | GET | Page elements + contentHash |
| `/pages/<id>/elements` | PUT | Full replace (requires If-Match header) |
| `/pages/<id>/elements` | PATCH | Patch specific elements |
| `/pages/<id>/elements` | POST | Append elements |
| `/pages/<id>/snapshots` | GET | List snapshots |
| `/pages/<id>/snapshots` | POST | Create snapshot |
| `/pages/<id>/rollback` | POST | Rollback to snapshot |

PUT requires `If-Match: <contentHash>` header. GET elements first to get the hash.

## Bricks element format

Flat array with parent references (not nested). Each element:

```json
{
  "id": "abc123",
  "name": "section",
  "parent": 0,
  "children": ["def456"],
  "settings": {
    "_cssGlobalClasses": ["acss_import_section__l"],
    "_typography": {"font-size": "var(--h2)"},
    "_padding": {"top": "var(--space-xl)"},
    "tag": "section"
  }
}
```

ACSS class IDs start with `acss_import_`. Frames class IDs do not.

## Conventions

- Go code follows standard go fmt / go vet
- Tests use table-driven patterns where appropriate
- CLI output: user-facing messages to stderr, data to stdout (so piping works)
- Config path: `~/.agent-to-bricks/config.yaml`
- Template cache: `~/.agent-to-bricks/templates/`
- Class registry cache: `~/.agent-to-bricks/class-registry.json`
- Update check cache: `~/.agent-to-bricks/update-check.json`
