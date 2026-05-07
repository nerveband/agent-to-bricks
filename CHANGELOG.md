# Changelog

All notable changes to Agent to Bricks are documented in this file.

## [2.3.0] - 2026-05-07

### Added

- Bricks Builder 2.3.x compatibility coverage for component metadata, slots, instance IDs, hidden frontend flags, and query/filter element names.
- Runtime-driven element type validation from `\Bricks\Elements::$elements`, with an expanded static fallback for offline tests and public clone workflows.
- Bricks Style Manager and Global Queries discovery in REST/CLI site context, surfaced through a stable `bricks discover --json` summary.
- Agent DX controls across large read commands: `--fields`, `--limit`, `--page`, `--page-all`, and `--ndjson` where useful.
- `--dry-run` support across mutating CLI commands so agents can inspect request targets and payloads before applying side effects.
- Centralized CLI input hardening for page IDs, resource IDs, output paths, and path-escaped REST route segments.

### Changed

- JSON and NDJSON workflows are quieter by default; update/version notices are suppressed during machine-readable command output.
- `bricks schema` now generates command, flag, Agent DX, and error-code metadata from the live Cobra command tree.
- Element mutation APIs preserve Bricks 2.3 component/slot fields such as `cid`, `slotChildren`, `parentComponent`, `instanceId`, and `_hideElementFrontend`.
- Staging verification retries GUI webview startup races and uses the current TS staging scratch page ID.

## [2.2.0] - 2026-03-23

### Added

- HTML-to-Bricks conversion: `bricks convert html` CLI command and `POST /convert` REST endpoint. Supports tag mapping, inline style parsing, CSS class resolution, and append/replace/return modes.
- `bricks patch` command for surgical element-level mutations (`--set`, `--rm`, `--list`) without full-page round-trips.
- `bricks discover` command for machine-readable site discovery (info, features, frameworks, classes, variables) in a single JSON payload for LLM context building.
- `bricks init` command that tests connection, installs `.bricks-skill.md`, and updates `CLAUDE.md` for AI agent self-discovery.
- Element validator enhancements in the plugin for stricter schema validation during conversion.

## [2.1.0] - 2026-03-10

### Added

- WooCommerce discovery surfaces across the stack: `bricks woo status`, `bricks woo products`, `bricks woo categories`, and `bricks woo tags`.
- Machine-readable site discovery for query-aware builds via `bricks site features` and `bricks site query-elements`.
- Query-aware GUI mentions for `@query`, `@product`, `@product-category`, and `@product-tag`, backed by live plugin routes.
- New plugin runner coverage for site feature discovery, WooCommerce routes, and query metadata search filters on `ts-staging`.

### Changed

- WordPress Abilities now include query/Woo discovery abilities under `agent-bricks-site` and `agent-bricks-commerce`.
- Search surfaces now expose Bricks query metadata end to end, including query object type, queried post types, and queried taxonomies.
- Staging SSH/deploy scripts now accept first-seen host keys automatically so the release gate can run cleanly on fresh machines once SSH signing is approved.

### Fixed

- `bricks abilities list --json` now tolerates empty-array schemas from the Abilities API instead of crashing decode.
- `bricks search elements --setting query --format json` no longer breaks when staging returns numeric `parentId` values.
- `bricks validate` now accepts exported Bricks payloads shaped as `bricksExport.content`, not just top-level `elements`.
- `ATB_Site_API` no longer emits implicit-nullable deprecation warnings on newer PHP versions.

## [2.0.0] - 2026-03-10

### Breaking

- Canonicalized page patch mutations to `patches` payloads only. The legacy `elements` patch alias is no longer accepted for `PATCH /pages/{id}/elements` or the matching CLI flows.

### Added

- Env-driven staging release gates for deploy verification, plugin runner coverage, CLI E2E, GUI E2E, and template smoke validation.
- Optional local/private corpus tests for proprietary Bricks template fixtures under `docs/test-data/`, with clean skip behavior for public clones.
- Local install verification that checks the built CLI, install target, and staging connectivity using a temporary config.

### Changed

- Synced version management now updates `cli/schema.json` alongside the plugin and GUI versioned artifacts.
- GUI session launch now avoids injecting raw site API keys into terminal bootstrap prompts.
- Plugin auth coverage now supports both `agent-bricks/v1` and `wp-abilities/v1` discovery flows needed by the GUI and staging tests.

### Fixed

- Single-file Frames imports now load correctly in the CLI template catalog.
- Staging deployment, plugin access control, snapshots, and template/component endpoints now match the current staging verification workflow.
- GUI MCP dev mode now builds with the required debug feature so E2E automation can attach reliably.
