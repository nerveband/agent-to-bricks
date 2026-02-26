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
- `class-settings.php` → Plugin settings docs, links to agenttobricks.com
- `class-update-api.php` → CLI update command, GitHub Release asset naming
- `agent-to-bricks.php` version → Must match `/VERSION`
