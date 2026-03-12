# Agent-Native Workflow Engine — Design Spec

**Date:** 2026-03-12
**Status:** Approved
**Approach:** Redesign CLI around three agent activity layers with progressive disclosure, class-aware JSON mutations, compound commands, and TDD against live staging.

## Problem

A fresh AI agent using the bricks CLI took 5+ minutes to do a basic task (append a tri-panel section after a specific element on the homepage). The root causes:

1. **19 of 64 agent workflows are RED** — missing CLI commands for append, delete, batch, page listing, ability execution, remote template CRUD, class update/show.
2. **The workflows section references a dead command** — `bricks generate` was removed in v1.6.0 but `agent context` still tells agents to use it.
3. **No "edit existing page" workflow exists** — the most common agent task has no documented path.
4. **No class awareness on JSON mutations** — agents writing raw element JSON use inline CSS instead of the 2700+ available ACSS utility classes because only `convert html` resolves classes.
5. **Error messages don't guide** — agents hit errors and have no breadcrumbs to the correct approach.
6. **Multiple tool calls for simple operations** — appending a section requires 5+ separate commands (pull, find, construct JSON, curl the API, verify).

### What the agent did wrong (and why it's our fault)

The agent bypassed `convert html` (the class-aware path) and built raw element JSON with inline `_padding`, `_gridTemplateColumns`, `_borderRadius` instead of using ACSS classes like `padding--xl`, `grid--auto-3`, `radius--m`. This happened because:
- No `site append` CLI command exists, so it dropped to raw REST API calls
- No `convert html --append` flag exists, so it couldn't use the class-aware path for partial page updates
- The `agent context` workflows section never mentions editing existing pages
- Nothing in the CLI warned about inline styles having ACSS equivalents

### Git history context

| Version | Date | Event |
|---------|------|-------|
| v1.5 | 2026-02-21 | `bricks generate` + `agent context` created. `AppendElements()` added to client. |
| v1.6 | 2026-02-26 | `generate` removed (742 lines). Pivot to "bring your own AI." **Workflows section never updated.** |
| v1.9 | 2026-03-04 | `schema.json` + LLM-friendliness features. No new commands. |
| v2.1 | 2026-03-10 | Current. `AppendElements()` still in client, still no CLI command. |

The CLI was designed with `generate` as the primary UX. When that was removed, the agent-facing surface was left incomplete.

### Agent DX CLI Scale score: 9/21 (Agent-tolerant)

| Axis | Current | Target |
|------|---------|--------|
| Machine-Readable Output | 1 | 2 |
| Raw Payload Input | 2 | 3 |
| Schema Introspection | 1 | 2 |
| Context Window Discipline | 1 | 2 |
| Input Hardening | 1 | 2 |
| Safety Rails | 1 | 2 |
| Agent Knowledge Packaging | 2 | 3 |
| **Total** | **9** | **16 (Agent-first)** |

**Input Hardening note:** The class resolution pipeline (resolving human-readable names to IDs, rejecting invalid class names, auto-creating missing classes instead of silently failing) is a form of input hardening specific to this domain — it defends against agent hallucination of class names. Target raised from 1→2.

---

## Architecture

### Three Agent Activity Layers

The CLI serves agents across three layers. All three must be first-class.

**Layer 1: Site Navigation & Discovery**
Finding pages, media, templates, products, site capabilities.

**Layer 2: Page Content (Create & Edit)**
Two sub-modes:
- Create: HTML with ACSS classes → `convert html` → push/append
- Edit: Read Bricks JSON → modify settings/structure → patch/push back

**Layer 3: Site-Wide Operations**
SEO, WooCommerce, forms, media, menus — anything plugins expose via WordPress Abilities API.

### Progressive Disclosure — Every Surface Is a Guide

LLMs don't read manuals. They try things, read output, adjust. Every CLI surface exploits this by embedding guidance at the point of contact.

**Five places hints live:**

1. **Error responses** — always include `hint` (what went wrong + expected format) and `see_also` (the command to run to fix it)
2. **Success responses** — include `next_steps` array with 1-2 logical follow-up commands on non-obvious operations
3. **Help text** — each command gets a `When to use:` line and `Instead of:` redirects
4. **Schema introspection** — `bricks schema` includes a `workflows` key with the decision tree
5. **Validation warnings** — non-fatal warnings on write operations when inline styles have ACSS equivalents

### No Wrong Door

No matter how an agent enters the CLI, it gets redirected to the right path:

- `bricks --help` → first line says `AI agents: run "bricks agent context --format prompt"`
- Random subcommand `--help` → includes `When to use:` and `Instead of:` redirects
- Error from wrong command → hints the correct command + mentions `agent context`
- `bricks schema` → includes `workflows` map before command details
- `llms.txt` → says "your first command is `bricks agent context --format prompt`"
- `bricks agent context` → opens with decision tree, not class lists

---

## New Commands

### Layer 1: Site Navigation & Discovery

#### `bricks pages list` (NEW)

```
bricks pages list                          # all pages
bricks pages list --search "pricing"       # search by title
bricks pages list --json                   # structured output
```

Wraps existing `GET /pages` endpoint (plugin already supports this). The plugin returns a bare JSON array; the CLI wraps it into the structured response below for consistency with other commands. Returns page ID, title, slug, status.

**When to use:** Finding page IDs before any content operation.

**Success output (JSON):**
```json
{"pages": [{"id": 13, "title": "Homepage", "slug": "home", "status": "publish"}, ...],
 "count": 12}
```

**Implementation note:** The `ListPages()` client method receives `[]map[string]interface{}` from the API and wraps it into `{"pages": [...], "count": len(...)}` before returning to the command layer.

#### `bricks abilities run` (NEW)

```
bricks abilities run agent-bricks/list-pages --input '{"search":"home"}'
bricks abilities run agent-bricks/upload-media --input '{"filename":"hero.jpg",...}'
```

Executes any WordPress Ability discovered via `abilities list`. Readonly abilities use GET, write abilities use POST. Input is validated against the ability's schema before sending.

**Implementation note:** This command uses the `wp-abilities/v1` REST namespace (NOT `agent-bricks/v1`). A new `RunAbility()` method must be added to `client.go` that targets this different namespace. The method must construct the URL as `/wp-json/wp-abilities/v1/<ability-name>/run` rather than using the standard ATB base path (matching the pattern used by existing `abilities describe` output at `abilities.go:149`).

**When to use:** Any site operation beyond page content — SEO, WooCommerce, forms, media, or anything third-party plugins expose.

**Error on unknown ability:**
```json
{"error": {"code": "ABILITY_NOT_FOUND", "message": "ability 'yoast/set-meta' not found",
  "hint": "Run: bricks abilities list  # see all available abilities",
  "see_also": "bricks abilities describe <name>  # check schema before calling"}}
```

### Layer 2: Page Content — Create

#### `convert html --append --after` (CHANGED)

```
# Existing: create new page (full replace)
bricks convert html page.html --push 42

# NEW: append to existing page
bricks convert html section.html --append 42
bricks convert html section.html --append 42 --after xottyu
bricks convert html section.html --append 42 --after xottyu --snapshot
```

Extends existing `AppendElements()` client method — **signature must change** to add `insertAfter string` parameter. The current method at `client.go:230` has no `insertAfter` support; it must be added to the payload as `"insertAfter": "<element-id>"` (camelCase — matching the plugin's `$body['insertAfter']` at `class-elements-api.php:212`) when non-empty. Class resolution happens during HTML conversion, so appended elements always use `_cssGlobalClasses` correctly. `--after` maps to REST API's `insert_after` body parameter.

**When to use:** Adding new content to an existing page. Always prefer this over `site append` because it resolves ACSS classes from HTML automatically.

**Success output:**
```json
{"success": true, "contentHash": "abc123...", "added": ["ba63e6", "4020a6", "f42f9c"],
 "count": 81, "classes_resolved": 3}
```

### Layer 2: Page Content — Edit

#### `bricks site find` (NEW)

```
bricks site find 42 --type heading                    # all headings on page
bricks site find 42 --label "Hero"                    # by element label
bricks site find 42 --text "Knowledge"                # by text content
bricks site find 42 --type section --json             # sections with full details
```

Pulls the page and filters elements client-side. This is intentional — single-page filtering is fast and avoids adding a server-side search endpoint. For site-wide search across all pages, use `bricks search elements` instead. Returns element IDs, types, labels, text content, and parent chain. Eliminates the "pull 95 elements and parse in Python" pattern.

**When to use:** Finding element IDs before patching, deleting, or inserting after.

**Success output (table):**
```
ID       TYPE     LABEL              TEXT                PARENT
xottyu   section  About Tayseer                          (root)
dnktjl   heading  Title              Knowledge           tvrlvh
weamht   heading  Title              Spirituality        tvrlvh
meuedi   heading  Title              Activism            tvrlvh
```

**Success output (JSON):**
```json
{"elements": [{"id": "xottyu", "name": "section", "label": "About Tayseer", "parent": "0",
   "children": ["hehuxb", "nxaqbb", "qighxz"]}, ...],
 "count": 4, "contentHash": "abc123...",
 "next_steps": ["bricks site patch 42 --element <id> --set key=value  # edit an element"]}
```

#### `bricks site patch` shorthand (CHANGED)

```
# Existing JSON format still works
echo '{"patches":[...], "contentHash":"..."}' | bricks site patch 42

# NEW: quick single-element edit
bricks site patch 42 --element abc123 --set text="New heading"
bricks site patch 42 --element abc123 --set tag=h2
bricks site patch 42 --element abc123 --set-class "gap--m,padding--l"
```

`--set` takes `key=value` pairs and constructs the patch JSON automatically. Fetches contentHash internally so the agent doesn't need to. An optional `--content-hash` flag accepts a pre-fetched hash to preserve optimistic locking when the agent already has one (e.g., from a prior `site find` or `site pull`).

`--set-class` resolves human-readable ACSS class names to `_cssGlobalClasses` IDs using the class registry. Auto-creates classes that don't exist (see Class Resolution Pipeline below).

**When to use:** Changing specific settings on elements you've already identified. Get IDs from `bricks site find`.

**Error on invalid element ID:**
```json
{"error": {"code": "ELEMENT_NOT_FOUND", "message": "element 'abc999' not found on page 42",
  "hint": "Run: bricks site find 42  # list all element IDs on this page"}}
```

#### `bricks site delete` (NEW)

```
bricks site delete 42 --ids abc123,def456
bricks site delete 42 --ids abc123 --json
```

Wraps existing `DeleteElements()` client method. Fetches contentHash internally.

**When to use:** Removing specific elements. Get IDs from `bricks site find`.

#### `bricks site append` (NEW)

```
echo '{"elements":[...]}' | bricks site append 42
echo '{"elements":[...]}' | bricks site append 42 --after xottyu
bricks site append 42 --file new-section.json --after xottyu
```

Wraps existing `AppendElements()` client method. Unlike `convert html --append`, this takes raw Bricks element JSON — for when agents are in JSON editing mode. **Class names in `_cssGlobalClasses` are resolved automatically** (see Class Resolution Pipeline).

**When to use:** Adding pre-built element JSON to a page. Prefer `convert html --append` when creating from scratch (gets class resolution from HTML too).

#### `bricks site batch` (NEW)

```
echo '{"operations":[...]}' | bricks site batch 42
```

Wraps the batch endpoint (`POST /pages/{id}/elements/batch`). Atomic multi-operation writes. Supported operations: `append`, `patch`, `delete`. Class resolution applied to all append operations.

**When to use:** Multiple changes in one atomic write — e.g., delete old section + append new one + patch a heading.

### Layer 3: Site-Wide Operations

`bricks abilities run` (above) covers this layer. Any Ability registered by any plugin is executable via CLI.

---

## Class Resolution Pipeline

Applies to all JSON mutation commands: `site append`, `site patch`, `site push`, `site batch`, and `convert html`.

When the agent writes element JSON with `_cssGlobalClasses`, the CLI resolves human-readable class names before sending to the API.

### Resolution cascade

```
Agent writes class name
        │
        ▼
  1. ACSS lookup (acss_import_ prefix match)
        │ found → use "acss_import_<name>" ID
        │ not found ▼
  2. Frames lookup (exact name match)
        │ found → use existing ID
        │ not found ▼
  3. Existing global class lookup (exact name match)
        │ found → use existing ID
        │ not found ▼
  4. Auto-create new global class (POST /classes)
        → use newly created ID
        → report in response: classes_created array
        → warn: "New global class created with empty settings"
```

### Examples

```json
// Agent writes:
{"_cssGlobalClasses": ["gap--m", "card--featured", "byzuqt"]}

// CLI resolves:
{"_cssGlobalClasses": ["acss_import_gap--m", "card--featured-id", "byzuqt"]}
//                      ↑ ACSS resolved       ↑ auto-created      ↑ passthrough (already an ID)
```

### Inline style warnings

When the CLI detects inline style settings that have ACSS equivalents, it produces non-fatal warnings in the response:

```json
{"success": true, ...,
 "warnings": [
   {"element": "trp010", "issue": "inline_style",
    "message": "_padding has ACSS equivalent",
    "suggestion": "Use _cssGlobalClasses: [\"padding--xl\"] instead of _padding: {\"top\": \"50px\"}"},
   {"element": "trp004", "issue": "inline_style",
    "message": "_gridTemplateColumns has ACSS equivalent",
    "suggestion": "Use _cssGlobalClasses: [\"grid--auto-3\"] instead of _gridTemplateColumns: \"1fr 1fr 1fr\""}
 ]}
```

### Inline-to-class mapping table (built into CLI)

| Inline Setting | Value Pattern | ACSS Class Suggestion |
|---|---|---|
| `_padding` | `var(--space-xs)` to `var(--space-xxl)` | `padding--xs` to `padding--xxl` |
| `_gap` | `var(--space-*)` | `gap--xs` to `gap--xxl` |
| `_gridTemplateColumns` | `1fr 1fr` / `1fr 1fr 1fr` / etc. | `grid--auto-2` / `grid--auto-3` / etc. |
| `_borderRadius` | small/medium/large values | `radius--s` / `radius--m` / `radius--l` |
| `_background.color` | `var(--primary)` etc. | `bg--primary` etc. |

The hardcoded table above serves as a bootstrap fallback for offline/dry-run usage. At runtime, when connected to a site, the CLI enriches this table by querying the site's actual ACSS class registry (via `GET /classes?framework=acss`) to discover additional mappings and verify existing ones. This means the warning system works offline (with the bootstrap table) but is more accurate when connected.

### Opt-out

`--no-create-classes` flag skips auto-creation and warns instead.
`--no-class-warnings` flag suppresses inline style suggestions.

---

## `agent context` v2

The `bricks agent context --format prompt` output is restructured. The decision tree and class rules come first, before the 2700-line class reference.

### New section order

1. **Decision tree** — step-by-step workflow for find → create/edit → verify
2. **Class usage rules** — ALWAYS use ACSS classes, never inline styles; CLI resolves names; auto-creates unknown classes; common pattern cheatsheet; explicit DO NOT examples
3. **Element JSON reference** — compact schema of element structure and common settings by type (heading, image, button, section, div, text-basic)
4. **Design tokens** (existing, no change)
5. **Utility classes (ACSS)** (existing, moved after rules)
6. **Component classes (Frames)** (existing)
7. **Templates** (existing)
8. **WordPress Abilities** (existing, now executable via `abilities run`)

### Removed

- Workflow 3 "AI Generate" referencing dead `bricks generate` command
- "You are a web designer..." preamble (replaced by decision tree)

### Token budget

Decision tree + class rules + element reference adds ~80 lines (~1500 tokens). Class section unchanged. Net: more useful, marginally larger.

---

## Error System Enhancements

All errors gain `hint` and `see_also` fields. Key error paths:

| Error | hint | see_also |
|---|---|---|
| `INVALID_JSON` on patch | Expected format with example | `bricks site pull <page-id>` |
| `MISSING_CONTENT_HASH` (428) | Run site pull to get contentHash | `bricks site pull <page-id>` |

**Note:** HTTP 428 is not currently handled in `FromHTTPStatus()` (`internal/errors/errors.go`). It must be added:
```go
case 428:
    return &CLIError{Code: "MISSING_CONTENT_HASH", Message: "...", Hint: "Run: bricks site pull <page-id>  # to get the current contentHash", Exit: 6}
```
| `ELEMENT_NOT_FOUND` | Element ID not on this page | `bricks site find <page-id>` |
| `ABILITY_NOT_FOUND` | Ability name not registered | `bricks abilities list` |
| `CONFIG_MISSING_URL` | Site URL not configured | `bricks config init` |
| `API_FORBIDDEN` (403) | Check API key permissions | `bricks config list` |
| `CONTENT_CONFLICT` (409) | Page was modified since last pull | `bricks site pull <page-id>` |

### Help text format

Every command help includes:

```
When to use: <one line explaining when this command is the right choice>
Instead of:  <redirect to the better command if this one is commonly misused>
```

### Schema enhancements

`bricks schema` JSON gains a `workflows` key:

```json
{
  "workflows": {
    "start": "bricks agent context --format prompt",
    "find_page": "bricks pages list --search <name>",
    "find_elements": "bricks site find <page-id> --type <type>",
    "create_content": "bricks convert html <file> --push <page-id>",
    "add_to_page": "bricks convert html <file> --append <page-id> --after <element-id>",
    "edit_element": "bricks site patch <page-id> --element <id> --set key=value",
    "delete_elements": "bricks site delete <page-id> --ids <id1>,<id2>",
    "site_action": "bricks abilities run <name> --input '{...}'"
  },
  "commands": { ... },
  "errorCodes": { ... }
}
```

### `bricks --help` header

```
AI agents: run "bricks agent context --format prompt" for complete workflow guidance.

Build and manage Bricks Builder pages programmatically via AI agents.
```

---

## Test Strategy — TDD Against Live Staging

### Principle

No guessing. Every command developed test-first against real Bricks data from `ts-staging.wavedepth.com`.

### Dev toolbox

- **CLI binary** — `bricks` commands against staging
- **SSH** — `root@23.94.202.65` for WP-CLI: `wp post meta get 13 _bricks_page_content_2 --skip-plugins=ws-form-pro --allow-root`
- **Web search** — Bricks Builder docs, ACSS docs, WP Abilities API docs
- **Context7 MCP** — up-to-date library docs during implementation

### Three test layers

**1. Unit tests (Go, offline)**
- Class resolution pipeline logic
- JSON validation and warning generation
- Error formatting with hints
- Patch shorthand parsing (`--set`, `--set-class`)
- Fixtures extracted from staging, not invented

**2. Integration tests (Go, against staging)**
- All tests use page **1338** (CLI Test Page) to avoid touching real content
- Each test snapshots before, rolls back after
- Tests cover:
  - `pages list` returns real pages including page 13
  - `site find 13 --type heading --text "Knowledge"` returns element `dnktjl`
  - `convert html --append 1338 --after <element>` actually appends with correct classes
  - `site patch 1338 --element <id> --set text="Test"` changes text
  - `site delete 1338 --ids <id>` removes elements
  - `abilities run agent-bricks/list-pages` returns data
  - Class resolution: `["gap--m"]` stored as `["acss_import_gap--m"]` on server
  - Class auto-creation: new class created, verified via `classes list`, cleaned up

**3. Agent simulation tests (end-to-end, bash)**
- Simulate the failed workflow from this session:
  1. `pages list --search "home"` → finds page 13
  2. `site find 13 --type section` → finds section IDs
  3. `media list --search "istanbul"` → finds image 427
  4. Write HTML with ACSS classes
  5. `convert html --append 13 --after xottyu --dry-run` → verify `_cssGlobalClasses` not inline
- Simulate fresh agent experience:
  1. `bricks --help` → agent context hint in first 3 lines
  2. `bricks site push 1338` with no hash → error includes `site pull` hint
  3. `bricks schema` → `workflows` key exists

### Fixture extraction (before coding)

```bash
bricks site pull 13 -o cli/testdata/homepage-elements.json
bricks site pull 1338 -o cli/testdata/test-page-elements.json
bricks classes list --framework acss --json > cli/testdata/acss-classes.json
bricks elements types --json > cli/testdata/element-types.json
```

### Dev workflow per command

1. Extract fixtures from staging
2. Write failing unit tests
3. Write failing integration test against staging (page 1338)
4. Implement
5. Green on unit tests
6. Green on integration tests
7. Run agent simulation for relevant workflow
8. `bricks schema --validate` passes
9. Verify via SSH/WP-CLI when needed

---

## Files Changed

### New files

| File | Purpose |
|---|---|
| `cli/cmd/pages.go` | `pages list` command |
| `cli/cmd/pages_test.go` | Unit + integration tests |
| `cli/cmd/abilities_run.go` | `abilities run` command |
| `cli/cmd/abilities_run_test.go` | Tests |
| `cli/internal/classresolver/resolver.go` | Class resolution pipeline |
| `cli/internal/classresolver/resolver_test.go` | Unit tests with fixtures |
| `cli/internal/classresolver/warnings.go` | Inline-to-class suggestion engine |
| `cli/internal/hints/hints.go` | Error hint + next_steps generation |
| `cli/internal/hints/hints_test.go` | Tests |
| `cli/testdata/*.json` | Fixtures extracted from staging |
| `cli/tests/agent_simulation_test.sh` | End-to-end bash tests |

### Modified files

| File | Changes |
|---|---|
| `cli/cmd/site.go` | Add `site find`, `site delete`, `site append`, `site batch`. Add `--set`/`--set-class` to `site patch`. Wire class resolver into all mutating commands. |
| `cli/cmd/convert.go` | Add `--append` and `--after` flags to `convert html`. **`--snapshot` must be explicitly handled** when combined with `--append` (snapshot before appending, not after full replace). |
| `cli/internal/agent/context.go` | Rewrite `writeWorkflowsSection()`. **Also rewrite `RenderPrompt()` hardcoded workflow text** (lines 157-183 contain independent "Converting HTML to Bricks" and "Using Templates" guidance that duplicates and contradicts the workflows section — must be replaced with the decision-tree approach). Add `writeClassRulesSection()`, `writeElementReferenceSection()`. Reorder sections. Remove dead `generate` reference. |
| `cli/cmd/agent.go` | Pass new sections to context builder. |
| `cli/cmd/root.go` | Add agent context hint to root help text. |
| `cli/internal/client/client.go` | Add `ListPages()` (wraps bare array into structured response), `RunAbility()` (targets `wp-abilities/v1` namespace, not `agent-bricks/v1`), `BatchOperations()` (wraps `POST /pages/{id}/elements/batch`) methods. **Change `AppendElements()` signature** to add `insertAfter string` parameter and include it in request payload when non-empty. |
| `cli/schema.json` | Add new commands, `workflows` key, update examples. |
| `cli/cmd/schema.go` | Validate `workflows` key in schema. |
| `cli/internal/errors/errors.go` | Add `SeeAlso string` and `NextSteps []string` fields to `CLIError` struct. Add HTTP 428 (`Exit: 6`) to `FromHTTPStatus()`. Add hints to existing error codes (401, 403, 404, 409). Target struct shape: `CLIError{Code, Message, Hint, SeeAlso, NextSteps, Exit}`. |
| `website/public/llms.txt` | Update with "first command" guidance and new commands. |
| `website/src/content/docs/guides/bring-your-own-agent.md` | Update workflows section. |
| `website/src/content/docs/cli/site-commands.md` | Document new commands. |
| `website/src/content/docs/plugin/rest-api.md` | No change (API already supports everything). |

### Deployment considerations

- **Plugin:** No changes needed — all new CLI commands use existing REST API endpoints
- **PHP-FPM restart:** Not needed — no server-side changes
- **Schema validation:** `bricks schema --validate` must pass in CI after all changes
- **Version:** This is a feature release — bump minor version

---

## Execution Order

### Wave 1: Foundation (class resolver + fixtures + pages list)
- Extract test fixtures from staging
- Build `internal/classresolver` package with TDD
- Build `pages list` command
- Update error system with hints

### Wave 2: Core editing commands
- `site find`
- `site delete`
- `site append` (with class resolution)
- `site patch` shorthand (`--set`, `--set-class`)
- `site batch`

### Wave 3: Convert html append + abilities run
- `convert html --append --after`
- `abilities run`

### Wave 4: Agent context v2 + progressive disclosure
- Rewrite `agent context` workflows section
- Add class rules and element reference sections
- Update all help text with "When to use" / "Instead of"
- Update schema with `workflows` key
- Update `bricks --help` header
- Update `llms.txt`
- Update website docs

### Wave 5: Agent simulation tests + validation
- Write and run agent simulation tests
- Full integration test pass against staging
- `bricks schema --validate`
- Score against agent-dx-cli-scale (target: 15/21)

---

## Success Criteria

1. The failed workflow from this session completes in under 60 seconds with 2-3 commands
2. No inline CSS in agent-created elements — class resolution catches everything
3. A fresh agent reading `bricks --help` reaches the right workflow within 1 command
4. All errors include actionable hints with example commands
5. `bricks schema` includes workflows map usable by any LLM
6. Agent DX CLI Scale score reaches 15/21 (Agent-ready)
7. All tests pass — unit, integration against staging, agent simulation
8. `bricks schema --validate` passes in CI
