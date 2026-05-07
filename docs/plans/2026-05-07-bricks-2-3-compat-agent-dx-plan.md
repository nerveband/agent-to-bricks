# Bricks 2.3 Compatibility and Agent DX Improvement Plan

Date: 2026-05-07
Branch: `codex/bricks-2-3-compat-plan`
Status: implemented for v2.3.0

## Context

The user provided a local Bricks Builder zip at:

`/Users/nerveband/Desktop/3504-bricks.zip`

Inspection showed:

- Bricks Builder theme zip version: `2.3.4`
- `style.css` version: `2.3.4`
- `BRICKS_VERSION`: `2.3.4`
- Bricks content meta key remains `_bricks_page_content_2`

TS staging was checked with the current local CLI and reported:

- Site: `https://ts-staging.wavedepth.com`
- Bricks version: `2.3`
- Agent to Bricks plugin version: `2.2.0`
- WordPress version: `6.9.4`
- PHP version: `8.4.20`
- Content meta key: `_bricks_page_content_2`
- Runtime element type count: `85`

Existing verification before planning:

```bash
cd cli && go test ./...
find plugin -name "*.php" -exec php -l {} \;
```

Both passed.

The worktree already had unrelated/unreviewed local changes before this plan was created. Do not revert them. When implementing in cloud, start by inspecting `git status` and the branch diff.

## Bricks 2.3 Findings

Bricks 2.3.4 keeps the same content meta key, so this is not primarily a storage-key migration. The main compatibility pressure is around richer runtime structures and discovery.

Important Bricks 2.3.x signals from the zip:

- Components and nested components use `cid`, `parentComponent`, and `instanceId` heavily.
- Component slots use `slotChildren`.
- CSS generation and query IDs depend on `instanceId` and `parentComponent`.
- Hidden frontend elements use `_hideElementFrontend`.
- `bricks_style_manager`, `bricks_global_queries`, and `bricks_global_queries_categories` exist and should be discoverable.
- Element loading now fires `bricks/load_elements/after` in a `finally` block.
- Query filters, filter range/select/radio behavior, Choices.js integrations, and WooCommerce query behavior changed across 2.3.x.

## Agent DX Re-Audit

Using the `agent-dx-cli-scale` skill, current score is **15/21**: agent-ready, close to agent-first.

Scores:

- Machine-readable output: `2/3`
- Raw payload input: `2/3`
- Schema introspection: `2/3`
- Context window discipline: `1/3`
- Input hardening: `2/3`
- Safety rails: `2/3`
- Agent knowledge packaging: `2/3`

Main gaps:

- JSON is not the default in non-TTY contexts.
- Update/version mismatch notices can add stderr noise during JSON workflows.
- `bricks schema` is static and command-oriented, not a full live runtime contract.
- Read commands do not consistently support `--fields`, `--limit`, `--page`, `--page-all`, or `--ndjson`.
- Mutating commands do not all have `--dry-run`.
- CLI-side ID/path/query hardening is not centralized.
- Agent skill docs exist, but are not yet a complete versioned command-specific skill library.

## Implementation Plan

### 1. Bricks 2.3.4 compatibility tests

- Add fixture tests for flat element arrays containing:
  - component instances with `cid`
  - nested component instances
  - slot roots and `slotChildren`
  - `parentComponent`
  - `instanceId`
  - `_hideElementFrontend`
  - query/filter elements from Bricks 2.3
- Add plugin tests that read, patch, append, and replace these structures without dropping required fields.
- Add staging smoke coverage for at least one page/component fixture when staging env is configured.

Expected files:

- `tests/plugin/*`
- `plugin/agent-to-bricks/includes/class-elements-api.php`
- `plugin/agent-to-bricks/includes/class-element-validator.php`
- `cli/internal/client/client_test.go`

### 2. Runtime-driven element validation

- Replace or supplement the static `$valid_types` list in `ATB_Element_Validator` with runtime data from `\Bricks\Elements::$elements` when Bricks is loaded.
- Keep a static fallback for public clones and isolated tests.
- Ensure unknown third-party element types warn but remain lossless where possible.
- Add missing native 2.3 element names to fallback:
  - `slot`
  - `text`
  - `dropdown`
  - `toggle`
  - `toggle-mode`
  - `icon-box`
  - `social-icons`
  - `map-leaflet`
  - `map-connector`
  - `html`
  - `logo`
  - `facebook-page`
  - `breadcrumbs`
  - `rating`
  - `back-to-top`
  - `image-gallery`
  - `query-results-summary`
  - `search`
  - `shortcode`
  - `post-*`
  - `filter-*`

Expected files:

- `plugin/agent-to-bricks/includes/class-element-validator.php`
- `tests/plugin/test-element-validator-runner.php`

### 3. Preserve component/slot invariants in mutation APIs

- Audit `PATCH`, `POST`, `PUT`, `DELETE`, and batch mutations for parent/child consistency.
- Ensure sanitization does not strip Bricks metadata needed by 2.3 components:
  - `cid`
  - `slotChildren`
  - `parentComponent`
  - `instanceId`
  - `ajaxLocalId`
  - `global`
  - `global_settings_checked`
  - `is_frontend`
- Add explicit tests that roundtrip these fields.
- For append/delete operations, verify parent `children` and slot references stay coherent.

Expected files:

- `plugin/agent-to-bricks/includes/class-elements-api.php`
- `plugin/agent-to-bricks/includes/class-element-validator.php`
- `tests/plugin/test-elements-runner.php`

### 4. Add Bricks 2.3 discovery surfaces

- Extend site discovery to expose:
  - Bricks Style Manager: `bricks_style_manager`
  - Global Queries: `bricks_global_queries`
  - Global Query Categories: `bricks_global_queries_categories`
  - Component count and component metadata summary
  - Element manager status if available
- Add CLI commands or extend existing commands:
  - `bricks styles manager --json`
  - `bricks site global-queries --json`
  - or include these in `bricks discover --json` under stable keys.
- Keep `bricks discover --json` compact by default and add field controls for verbose sections.

Expected files:

- `plugin/agent-to-bricks/includes/class-site-api.php`
- `plugin/agent-to-bricks/includes/class-styles-api.php`
- `cli/internal/client/client.go`
- `cli/cmd/discover.go`
- `cli/cmd/styles.go`
- `cli/schema.json`
- `website/src/content/docs/cli/*`

### 5. Make discovery output easier for agents

- Add a stable top-level summary to `bricks discover --json`, for example:

```json
{
  "summary": {
    "bricksVersion": "2.3.4",
    "pluginVersion": "2.2.0",
    "wpVersion": "6.9.4",
    "contentMetaKey": "_bricks_page_content_2",
    "elementTypeCount": 85
  }
}
```

- Preserve existing nested keys for compatibility.
- Document the canonical machine-readable discovery shape.

Expected files:

- `cli/cmd/discover.go`
- `cli/internal/agent/context.go`
- `cli/schema.json`
- `README.md`
- `website/src/content/docs/cli/*`

### 6. Improve CLI context window controls

- Add consistent read-command flags:
  - `--fields`
  - `--limit`
  - `--page`
  - `--page-all`
  - `--ndjson` where useful
- Apply to large outputs:
  - `site pull`
  - `patch --list`
  - `search elements`
  - `search pages`
  - `classes list`
  - `templates list/search/show`
  - `elements types`
  - `abilities list`
  - `discover`
- Ensure docs tell agents to request narrow fields before large payloads.

Expected files:

- `cli/cmd/*`
- `cli/internal/output/*`
- `cli/internal/client/client.go`
- `plugin/agent-to-bricks/includes/*`
- `cli/schema.json`

### 7. Centralize CLI input hardening

- Add a shared validation package for:
  - numeric page IDs
  - Bricks element IDs
  - class IDs
  - route path params
  - URL/query fragments
  - output paths
- Reject:
  - control characters
  - `../`
  - percent-encoded traversal like `%2e`
  - embedded `?` or `#` in resource IDs
  - absolute or parent-traversing output paths unless explicitly allowed
- Ensure HTTP path segments are percent-encoded instead of string-concatenated where needed.

Expected files:

- `cli/internal/security` or `cli/internal/validation`
- `cli/internal/client/client.go`
- `cli/cmd/*`
- corresponding tests

### 8. Universal dry-run and safety rails

- Add `--dry-run` to all mutating commands:
  - `site push`
  - `site patch`
  - `patch`
  - `convert html --push`
  - `classes create/delete`
  - `media upload`
  - `templates import`
  - update/plugin-affecting commands where practical
- Dry-run should emit the exact request payload and target endpoint without side effects.
- Keep automatic pre-mutation snapshots for page content mutations.
- Consider `--require-snapshot` or default snapshot behavior for full replace.

Expected files:

- `cli/cmd/*`
- `cli/internal/client/client.go`
- tests for every mutating command

### 9. JSON workflow cleanup

- Keep user-facing status messages on stderr.
- Avoid noisy update/version notices during JSON workflows unless:
  - user asks for diagnostics
  - command is interactive/human output
  - notice is included as structured metadata
- Consider structured warnings in JSON responses:

```json
{
  "data": {},
  "warnings": []
}
```

Do this carefully to avoid breaking existing JSON consumers.

Expected files:

- `cli/cmd/root.go`
- `cli/internal/output/output.go`
- `cli/internal/client/client.go`
- `cli/internal/errors/errors.go`

### 10. Schema and agent knowledge packaging

- Update `cli/schema.json` after every command/flag change.
- Make `bricks schema` more runtime-aware where possible:
  - include live plugin capabilities
  - include runtime element controls
  - include WordPress Abilities schemas
- Update generated skill docs:
  - `.claude/skills/agent-to-bricks/SKILL.md`
  - `.claude/skills/agent-to-bricks/references/*`
- Add explicit agent guardrails:
  - use `--json` for machine output
  - use `--fields` for large reads
  - GET first to obtain `contentHash`
  - use `--dry-run` before mutating
  - preserve component metadata fields
  - snapshot before full-page replace

Expected files:

- `cli/schema.json`
- `.claude/skills/agent-to-bricks/SKILL.md`
- docs under `website/src/content/docs/cli/`
- `AGENTS.md` if workflow expectations change

## Verification Gate

Run locally:

```bash
make build
cd cli && go test ./...
cd cli && go run . schema --validate
find plugin -name "*.php" -exec php -l {} \;
```

Run staging when credentials are configured:

```bash
set -a && source .env && set +a
./scripts/verify-staging-release.sh
```

At minimum, staging should verify:

- `bricks site info --json`
- `bricks discover --json`
- `bricks elements types --controls --json`
- component listing and component show
- pull/patch/undo against a scratch page
- component/slot fixture mutation without structure loss
- frontend render/CSS smoke after mutation

## Cloud Codex Prompt

Use this prompt when moving work to cloud Codex:

```text
You are working in the agent-to-bricks repo. Continue from branch `codex/bricks-2-3-compat-plan`.

Read `AGENTS.md` and `docs/plans/2026-05-07-bricks-2-3-compat-agent-dx-plan.md` first. The user wants Bricks Builder 2.3.4 compatibility and Agent DX CLI improvements, not a release version bump unless explicitly requested.

Important context:
- Local Bricks zip inspected on the Mac was `/Users/nerveband/Desktop/3504-bricks.zip`.
- It was Bricks Builder `2.3.4`.
- TS staging reported Bricks `2.3`, Agent to Bricks plugin `2.2.0`, WP `6.9.4`, PHP `8.4.20`, and `_bricks_page_content_2`.
- Current audit score from `agent-dx-cli-scale` was `15/21`.
- Existing worktree had uncommitted local changes before this plan branch was created. Do not revert user changes.

Start by checking:
1. `git status --short`
2. `git diff --stat`
3. `docs/plans/2026-05-07-bricks-2-3-compat-agent-dx-plan.md`
4. Current command/schema state with `cd cli && go run . schema --validate`

Implementation priority:
1. Add Bricks 2.3.4 compatibility tests around `cid`, `slotChildren`, `parentComponent`, `instanceId`, `_hideElementFrontend`, and query/filter elements.
2. Make element validation runtime-driven from `\Bricks\Elements::$elements`, with static fallback.
3. Preserve component/slot metadata through all element mutation APIs.
4. Add discovery for Style Manager, Global Queries, Global Query Categories, and stable top-level `discover` summary.
5. Improve CLI Agent DX: `--fields`, pagination/NDJSON where useful, centralized input hardening, universal `--dry-run`, quieter JSON workflows.
6. Update `cli/schema.json`, docs, tests, and agent skill docs together.

Verification required before reporting done:
- `cd cli && go test ./...`
- `cd cli && go run . schema --validate`
- `find plugin -name "*.php" -exec php -l {} \;`
- staging gate or targeted staging smoke if credentials are available

Keep implementation scoped. Do not bump `VERSION` unless the user explicitly asks for a release.
```
*** End Patch
 
