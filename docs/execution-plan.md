# Bricks AI Savior — Execution Plan

## Objective

Enable an AI coder to independently:

1. Discover how Bricks Builder stores/updates element state in the builder.
2. Identify reliable insertion/copy pathways for JSON-driven automation.
3. Validate hypotheses with repeatable DevTools experiments.
4. Cross-reference findings with official docs (Context7 + Bricks docs).
5. Produce a build-ready plan for a hybrid system (Chrome extension + WP plugin).

---

## Success Criteria

By the end, the AI coder must deliver:

- A **map of Bricks runtime surfaces** (objects, events, state containers, network calls).
- A **tested method** to:
  - read selected element/tree data
  - create/duplicate/insert elements (or fallback via template import path)
  - copy/export normalized JSON
- A **risk-ranked integration strategy** (extension-only vs plugin-only vs hybrid).
- A **technical spec** with endpoints, schema, validation, rollback, and test suite.

---

## Phase 0 — Ground Rules for Autonomous Exploration

1. Work only in a staging site.
2. Pin exact versions:
   - WordPress version
   - Bricks version
   - Browser version
3. Keep a research log:
   - hypothesis
   - test snippet
   - observed result
   - confidence level
4. Never trust one signal. Confirm each finding through:
   - runtime introspection
   - network inspection
   - UI behavior correlation

---

## Phase 1 — Instrument the Environment

### 1.1 Set up a test harness page in Bricks

Create one page with:
- nested containers
- text, button, image
- classes/global styles
- at least one component/template inserted

This gives varied element structures for probing.

### 1.2 DevTools setup

In Chrome DevTools:
- Preserve log: ON
- Disable cache: ON
- Network filter presets: `fetch/xhr`, `ws`, `doc`
- Sources snippets: create reusable snippets folder:
  - `probe-runtime.js`
  - `probe-selection.js`
  - `probe-network-hooks.js`
  - `dom-observer.js`

### 1.3 Runtime snapshot snippet

Run a snippet that inventories candidate globals and object graphs.

---

## Phase 2 — Discover State and Selection Model

### 2.1 Identify selected element source of truth

For a manual click on an element in builder:
- watch DOM mutations
- watch network traffic
- inspect suspect global objects before/after click

Test pattern:
1. capture baseline snapshots of suspects
2. click element A
3. diff snapshots
4. click element B
5. diff again

Expected output: identify `selectedId`, active node, or equivalent.

### 2.2 Detect element tree structure

Goal: locate canonical tree JSON (not just rendered DOM).

---

## Phase 3 — Intercept Network/API Pathways

### 3.1 Capture CRUD operations

Perform UI actions manually:
- duplicate element
- paste element
- insert template/component
- save/update page

For each action, record:
- endpoint URL
- method
- request payload schema
- response schema
- anti-CSRF/nonces/auth tokens

### 3.2 Hook fetch/XHR (local instrumentation)

Inject wrappers to log payloads. Map which calls actually mutate builder state.

---

## Phase 4 — Controlled JS Mutation Tests

Run these tests in order, each with rollback page copy.

### 4.1 Read selected element JSON
Build a helper to extract selected node + subtree JSON.
Pass condition: same data reflects UI selection changes.

### 4.2 Duplicate selected node via runtime API
If direct method exists, call it.
Else simulate same payload as captured network request.
Pass condition: duplicated element appears and persists after save/reload.

### 4.3 Insert JSON node from external source
Try inserting minimal valid node payload.
Pass condition: element renders correctly and survives reload.

### 4.4 Copy/export normalization
Build function that strips volatile fields (ids, transient refs, runtime-only keys).
Pass condition: normalized JSON can be reinserted with deterministic result.

---

## Phase 5 — Context7 + Docs Synthesis

Query Context7 for:
1. Bricks template/component import/export docs
2. Bricks custom element extension points
3. WordPress REST API + nonce/auth best practices
4. Chrome extension MV3 messaging + content script injection + websocket behavior

Output required:
- "Doc-backed constraints list" vs "runtime-discovered behavior list"
- conflicts between docs and observed runtime

---

## Phase 6 — Architecture Decision Record

Compare:
- Extension-only
- Plugin-only
- Hybrid

Scoring dimensions:
- reliability against Bricks UI changes
- write safety
- speed to prototype
- maintainability
- security/key handling
- observability/rollback

Expected decision: **hybrid** (extension UX + plugin commit gate).

---

## Phase 7 — Implementation Blueprint

### 7.1 Chrome extension scope
- Content script: floating control panel, inspect selected element, stream AI suggestions
- Background/service worker: auth/session coordination
- Messaging: `GET_SELECTION`, `TRANSFORM_JSON`, `VALIDATE_JSON`, `COMMIT_PATCH`

### 7.2 WP/Bricks plugin scope
- REST endpoints: `/ai/transform`, `/ai/validate`, `/ai/commit`, `/ai/rollback`
- Server responsibilities: schema validation, nonce/capability checks, media/class remap, snapshot + diff logging

### 7.3 JSON contract (minimum)
- `meta` (version, source, timestamp)
- `node` (type, props, children)
- `assets` (media refs)
- `bindings` (global classes/variables)
- `patchMode` (`insert`, `replace`, `append`)

---

## Phase 8 — Test Plan

### 8.1 Functional tests
- read selection
- copy subtree
- insert subtree
- duplicate node
- undo/rollback works

### 8.2 Regression tests
- clean page
- large complex page
- page with components/global styles

### 8.3 Failure tests
- invalid JSON
- missing media refs
- unknown element types
- expired nonce/session

Expected behavior: hard fail + clear error + no partial corrupt writes.

---

## Phase 9 — Required Deliverables

1. `docs/runtime-map.md` — globals/events/endpoints discovered
2. `snippets/` — all DevTools scripts with comments
3. `schema/ai-bricks.schema.json` — canonical JSON schema
4. `docs/adr-001-integration-choice.md` — architecture decision record
5. `docs/plugin-spec.md` — endpoints, auth, validation, rollback
6. `docs/extension-spec.md` — panel UX, messaging, failure states
7. `docs/execution-plan.md` — phased build (this document)
8. `docs/risk-register.md` — DOM fragility, version lock, security, data loss
