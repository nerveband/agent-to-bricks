# Agent-First Contract Hardening — Implementation Plan

**Date:** 2026-03-10
**Status:** In progress
**Authoring context:** Follow-up to the `agent-dx-cli-scale` review and comparison against [shiptypes.com](https://shiptypes.com/).

## Goal

Move Agent to Bricks from "agent-tolerant" toward "agent-ready" by making the contract between the CLI, plugin, GUI, docs, and tests explicit, typed, validated, and enforced in CI.

This plan covers the full remediation scope across:

- CLI machine-readable behavior
- Plugin contract and security hardening
- GUI agent surface quality
- Contract generation and CI enforcement
- Documentation and rollout

## Desired End State

The product should behave as if the contract is the source of truth, not the prose:

- One canonical contract defines page mutation payloads, outputs, error shapes, and capability metadata.
- CLI, plugin, GUI, and docs are generated from or validated against that contract.
- Agents can discover capabilities without scraping help text or prose docs.
- Mutating actions have consistent safety rails and predictable structured responses.
- Auth boundaries and access control are explicit and test-covered.
- CI fails on contract drift.
- Private/local developers can validate against real Bricks template exports, while public clones skip proprietary fixture checks cleanly.

## Summary Of Current Gaps

### 1. Contract drift exists today

- `site patch` in the CLI and Go client uses `elements`, while the plugin and docs expect `patches`.
- `bricks schema --validate` only checks command presence, not flag, payload, or output drift.
- Some WordPress Abilities schemas do not match actual returned payloads.

### 2. Structured behavior is inconsistent

- Several CLI commands expose `--format json` but still return human-oriented output or human-oriented errors.
- Raw payload input is only partially supported across mutating commands.
- Plugin responses vary by endpoint and are not uniformly enveloped.

### 3. Security and safety rails are uneven

- `X-ATB-Key` auth is not scoped to the plugin namespace.
- Per-key access control is inconsistently enforced across endpoints.
- Safety rails are strong for page element writes but much weaker for templates, media, plugin update, and LLM endpoints.

### 4. GUI remains PTY-first

- The GUI is a useful supervision surface, but most real agent work still happens through raw terminal text.
- Ability schemas and plugin capability metadata are fetched but not surfaced as first-class typed actions.
- Secrets are injected directly into tool sessions.

## Program Structure

The work is broken into seven workstreams.

1. Contract Canonicalization
2. CLI Consistency And Enforcement
3. Plugin Security And Contract Hardening
4. Abilities And Runtime Introspection
5. GUI Typed Agent Surface
6. Test Matrix And CI Hardening
7. Documentation, Migration, And Rollout

## Workstream 1: Contract Canonicalization

### Objective

Create a single canonical definition for ATB capability contracts that can be consumed by the CLI, plugin, GUI, and docs.

### Deliverables

- Add canonical contract artifacts under [`schema/`](/Users/nerveband/wavedepth%20Dropbox/Ashraf%20Ali/Mac%20(2)/Documents/GitHub/agent-to-bricks/schema)
- Define canonical JSON shapes for:
  - page read/write responses
  - `replace`, `append`, `patch`, `delete`, `snapshot`, `rollback`
  - class, component, template, media, styles, variables, abilities discovery
  - structured error shapes
  - safety metadata (`readonly`, `destructive`, `idempotent`, `requires_if_match`, `supports_dry_run`)
- Add a generator or validator that derives:
  - CLI schema sections
  - Plugin Abilities schema declarations
  - reference docs fragments

### Implementation Tasks

- Audit every plugin endpoint and normalize payload names.
- Choose canonical nouns:
  - `elements` for full arrays
  - `patches` for delta patch payloads
  - `ids` for delete payloads
  - `contentHash` in responses
  - `content_hash` only if required by external Abilities API conventions, with explicit translation
- Add a validation tool that compares:
  - canonical schema
  - `cli/schema.json`
  - plugin Abilities registration
  - docs examples

### Acceptance Criteria

- A patch payload mismatch like the current `elements` vs `patches` issue fails CI.
- Contract names and shapes are no longer duplicated by hand in multiple places without checks.

## Workstream 2: CLI Consistency And Enforcement

### Objective

Make the CLI uniformly machine-consumable and remove cases where flags imply behavior that the command does not actually honor.

### Deliverables

- Full `--format json` compliance for all JSON-capable commands
- Structured JSON errors for all commands under JSON mode
- Consistent raw payload stdin behavior across mutating commands
- Stronger `bricks schema --validate`

### Implementation Tasks

#### Phase 2A: Immediate parity fixes

- Fix `site patch` CLI and Go client to use `patches`
- Make `site push` and `site patch` honor `--format json`
- Update `cli/schema.json` outputs and examples accordingly
- Add tests for request payload shape and JSON output behavior

#### Phase 2B: Structured output completion

- Audit all commands for `--format json` vs actual output
- Migrate remaining `fmt.Errorf` paths to structured `CLIError` where appropriate
- Normalize success outputs into stable JSON objects
- Ensure user-facing prose goes to stderr and data goes to stdout

#### Phase 2C: Stronger schema validation

- Extend `schema --validate` to verify:
  - command existence
  - flags
  - stdin capability
  - declared output modes
  - examples present
- Optionally emit a generated schema snapshot from the live Cobra tree and diff it against `cli/schema.json`

#### Phase 2D: Context discipline

- Add paging/limit flags where read surfaces can grow large
- Add field selection or compact modes where sensible
- Document token-thrifty usage in `llms.txt` and agent docs

### Acceptance Criteria

- Every command that advertises JSON returns JSON in success and error cases.
- CLI schema validation catches flag drift and output drift, not just missing commands.

## Workstream 3: Plugin Security And Contract Hardening

### Objective

Fix auth boundary flaws and align plugin behavior with the advertised API contract.

### Deliverables

- Namespace-scoped `X-ATB-Key` authentication
- Consistent ATB access-control enforcement across all relevant endpoints
- Contract-aligned request/response bodies
- Explicit rate-limit behavior that matches docs

### Implementation Tasks

#### Phase 3A: Critical auth and access fixes

- Scope `ATB_API_Auth::authenticate()` to ATB routes only
- Audit all routes for `ATB_Access_Control`
- Apply ATB access checks to:
  - template lists
  - component lists
  - `generate`
  - `modify`
  - any post-scoped route missing key-based restrictions

#### Phase 3B: Response normalization

- Standardize error bodies across endpoints
- Decide on a stable success envelope strategy
- Ensure status codes and error codes are documented and test-covered

#### Phase 3C: Safety rails expansion

- Add dry-run support where possible for:
  - templates
  - plugin update
  - LLM generation/modify previews
- Decide where snapshot-before-write should be default
- Document and expose safety metadata in Abilities annotations or ATB schema

#### Phase 3D: Rate limiting truthfulness

- Either implement per-key request rate limiting as documented or update docs to reflect actual behavior
- Add tests for 401, 403, 409, 428, 429 surfaces

### Acceptance Criteria

- An `X-ATB-Key` header does not authenticate arbitrary non-ATB REST routes.
- ATB key restrictions are consistently honored for list and mutation endpoints.

## Workstream 4: Abilities And Runtime Introspection

### Objective

Make the plugin's runtime introspection surface trustworthy and complete enough for agents to rely on.

### Deliverables

- Correct Abilities schemas
- Better plugin route args for WordPress REST discovery
- Coverage for currently missing ATB surfaces

### Implementation Tasks

- Fix Abilities schema mismatches, including:
  - `list-pages`
  - snapshot payloads
  - any response-name drift
- Add request `args` to raw plugin routes where missing
- Decide whether these ATB surfaces should also get Abilities coverage:
  - `generate`
  - `modify`
  - `providers`
  - `site/update`
  - template CRUD
- Add tests that compare Abilities schema expectations against actual returned shapes

### Acceptance Criteria

- Agents can trust Abilities schemas as executable documentation.
- Schema drift is caught by automated tests.

## Workstream 5: GUI Typed Agent Surface

### Objective

Move the GUI from a PTY wrapper with helpful context to a more typed and machine-addressable agent surface.

### Deliverables

- First-class display of capability schemas and ATB/third-party abilities
- Safer credential handling
- Cleaner command argument handling
- Optional typed action execution for common ATB operations

### Implementation Tasks

#### Phase 5A: Safety and correctness

- Stop injecting raw API keys into every launched tool session by default
- Introduce safer context tokens or explicit opt-in secret insertion
- Fix argument parsing so quoted flags are preserved
- Audit PTY command construction for shell-safety

#### Phase 5B: Agent-visible capability surfacing

- Surface `input_schema` and `output_schema` in the GUI
- Wire up the currently dormant richer context/reference UI
- Make the abilities block generated from typed data, not prose-only summaries

#### Phase 5C: Typed ATB actions

- Add native GUI actions for common read operations first
- Evaluate native typed mutation flows for:
  - pull
  - patch
  - snapshot
  - rollback
- Keep terminal fallback, but stop making it the only meaningful execution model

### Acceptance Criteria

- GUI users can inspect and invoke ATB capabilities without relying solely on pasted shell commands.
- Secrets are no longer sprayed into session history by default.

## Workstream 6: Test Matrix And CI Hardening

### Objective

Convert the contract and security expectations into regression-resistant automated checks.

### Deliverables

- New CLI request/response tests
- Plugin auth/access tests
- Schema consistency tests
- Golden examples for docs and CLI schema output
- Optional local/private corpus validation for proprietary Bricks template fixtures

### Implementation Tasks

- Add CLI tests for:
  - `site push` JSON success output
  - `site patch` JSON success output
  - JSON error output for invalid inputs
  - request body serialization in `PatchElements`
- Add plugin tests for:
  - namespace auth scoping
  - access control on template/component list routes
  - `If-Match` required behavior
  - dry-run behavior if implemented
- Add contract-level tests that compare:
  - canonical schema
  - Abilities schemas
  - CLI schema entries
  - docs examples
- Expand CI to run any new plugin contract checks
- Treat `docs/test-data/` as an optional private fixture pack:
  - run full real-template corpus validation when the directory is present locally or in private CI
  - skip those checks with an explicit message in public clones where the proprietary fixtures are absent
  - keep public coverage through tracked fixtures, converter tests, and staging smoke tests

### Acceptance Criteria

- The present CLI/plugin patch mismatch would fail CI.
- The present auth scoping bug would fail CI.
- Public contributors can develop and test without proprietary fixtures, while private environments still exercise real Bricks exports.

## Workstream 7: Documentation, Migration, And Rollout

### Objective

Make the docs reflect the actual contract and support a safe rollout of any breaking or tightening changes.

### Deliverables

- Updated docs and examples
- Migration notes for users and agents
- Release notes guidance

### Implementation Tasks

- Update REST API docs to match actual contract behavior
- Update CLI docs and `llms.txt`
- Add a migration note if any payloads or auth semantics change
- Add release checklist items for contract regeneration and validation
- Document the local-only fixture workflow:
  - `docs/test-data/` remains gitignored and is not required for public development
  - `.env.example` defines the staging variables for local/private validation
  - proprietary corpus tests skip automatically when the fixture directory is absent

### Acceptance Criteria

- Prose docs are derived from or validated against the contract, not hand-waved copies.

## Execution Order

### Wave 1: Critical correctness and security

- Fix `site patch` contract drift
- Fix `site push` / `site patch` JSON output behavior
- Scope API key auth to ATB namespace
- Add tests for those fixes

### Wave 2: Contract enforcement

- Strengthen `schema --validate`
- Fix Abilities schema drift
- Add contract parity tests

### Wave 3: Access and safety completion

- Complete ATB access-control audit
- Expand dry-run and snapshot rails
- Resolve rate-limit truthfulness

### Wave 4: GUI upgrade

- Secret handling hardening
- Schema surfacing
- Typed action support

## Risks

- Tightening auth boundaries may affect undocumented user workflows.
- Standardizing response envelopes may require compatibility shims.
- Generated-contract work can sprawl if it is not kept narrow and incremental.

## Out Of Scope For Wave 1

- Full OpenAPI generation for every plugin route
- Replacing the PTY execution model entirely
- Large GUI redesign unrelated to typed surfacing

## Immediate Next Steps

1. Fix the patch payload mismatch in CLI/client/tests/schema.
2. Make `site push` and `site patch` actually emit JSON when JSON is requested.
3. Scope `X-ATB-Key` auth to the ATB namespace.
4. Update tests and docs affected by those changes.
