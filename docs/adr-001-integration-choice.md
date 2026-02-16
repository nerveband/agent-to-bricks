# ADR-001: Integration Architecture Choice

> Status: **Accepted** | Date: 2026-02-15

## Context

We need to build an AI-powered assistant that can read, transform, and write Bricks Builder element data. Three integration strategies are possible:

1. **Extension-only** — Chrome extension with content scripts
2. **Plugin-only** — WordPress plugin with REST endpoints
3. **Hybrid** — Chrome extension for UX + WP plugin for safe commits

## Decision

**Hybrid architecture** (Chrome extension + WordPress plugin).

## Scoring

| Dimension | Extension-only | Plugin-only | Hybrid |
|-----------|:---:|:---:|:---:|
| Reliability against Bricks UI changes | 3/5 | 4/5 | **5/5** |
| Write safety (validation, rollback) | 2/5 | 5/5 | **5/5** |
| Speed to prototype | **5/5** | 3/5 | 3/5 |
| Maintainability | 3/5 | 4/5 | **4/5** |
| Security / key handling | 2/5 | **5/5** | **5/5** |
| Observability / rollback | 2/5 | **5/5** | **5/5** |
| UX / developer experience | **5/5** | 2/5 | **5/5** |
| **Total** | **22** | **28** | **32** |

## Analysis

### Extension-only (Score: 22/35)

**Pros:**
- Fastest to prototype — `builderTest` API provides direct runtime access
- Selection, clone, insert, delete all work via JS injection
- No server-side code needed
- Can leverage existing `bricksData.nonce` for auth

**Cons:**
- No server-side validation — malformed JSON can corrupt pages
- No rollback mechanism
- Nonce/session management is fragile (expires, no refresh)
- Can't intercept saves for validation
- API keys (for LLM) must be stored client-side
- Breaks if Bricks renames internal functions (they're minified)

### Plugin-only (Score: 28/35)

**Pros:**
- Full server-side validation and schema enforcement
- Built-in rollback via WordPress revisions
- Proper nonce/capability checks
- API keys stored server-side
- Can use WP REST API with proper auth
- Survives Bricks frontend changes

**Cons:**
- No builder context — can't read current selection or live state
- UX limited to admin pages or iframe
- Can't interact with builder in real-time
- Requires separate UI for element inspection

### Hybrid (Score: 32/35) — **SELECTED**

**Pros:**
- Extension reads live builder state (selection, tree, classes)
- Extension provides floating panel UX within the builder
- Plugin validates all writes before committing
- Plugin manages API keys, snapshots, rollback
- Clear separation of concerns (read = extension, write = plugin)
- Extension can degrade gracefully if plugin unavailable
- Plugin can work independently via REST API

**Cons:**
- Two codebases to maintain
- More complex deployment (extension + plugin install)
- Messaging protocol between extension and plugin needs design

## Risks

| Risk | Mitigation |
|------|-----------|
| `builderTest` removed in future Bricks versions | Fall back to DOM scraping; advocate for official API |
| Internal function signatures change | Version-pin; maintain adapter layer per Bricks version |
| Extension store review delays | Self-hosted CRX for development; store for production |
| Plugin conflicts with other WP plugins | Namespace everything; minimal footprint |

## Consequences

1. Extension handles: selection reading, UI panel, AI interaction, JSON preview
2. Plugin handles: validation, commit, rollback, API key storage, snapshot logging
3. Communication via: `window.postMessage` (content script ↔ page) + REST API (extension ↔ plugin)
4. Element writes always go through plugin validation gate before save
