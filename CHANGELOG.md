# Changelog

All notable changes to Agent to Bricks are documented in this file.

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
