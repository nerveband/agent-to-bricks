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
