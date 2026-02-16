# Risk Register

> Last updated: 2026-02-15

## Critical Risks

### R1: `builderTest` API Removal
- **Likelihood:** Medium (it's a debug/test object, not documented)
- **Impact:** High — all runtime read operations depend on it
- **Mitigation:**
  - Build adapter layer that abstracts access
  - Maintain fallback: scan `window` for Vue app instance → traverse `$store` / Pinia
  - The Vue reactive state is always accessible via `document.querySelector('.brx-body').__vue_app__`
  - Monitor Bricks changelog for breaking changes

### R2: Internal Function Signature Changes
- **Likelihood:** High (functions are minified, names like `$_addNewElement` may change)
- **Impact:** High — insert/clone/delete operations break
- **Mitigation:**
  - Version-pin adapter per Bricks major version
  - Use function body heuristics to identify renamed functions
  - Fall back to save-via-AJAX approach (POST full content array)
  - Consider using `$_savePost` only (most stable entry point)

### R3: Nonce Expiration / Session Timeout
- **Likelihood:** High (nonces expire, sessions time out)
- **Impact:** Medium — save operations fail silently or with 403
- **Mitigation:**
  - Monitor `bricksData.nonce` freshness
  - Intercept 403 responses and trigger nonce refresh
  - Bricks has `bricksRegenerateNonceAndResubmit` — can leverage this
  - Show clear error state in extension UI

### R4: Data Corruption from Invalid JSON
- **Likelihood:** Medium (AI-generated JSON may have structural errors)
- **Impact:** Critical — page becomes uneditable
- **Mitigation:**
  - **Never write without server-side validation (plugin gate)**
  - Validate against schema before any write
  - Enforce required fields: `id`, `name`, `parent`, `children`
  - Validate parent-child referential integrity
  - Create snapshot before every write
  - Test rollback flow in CI

### R5: Orphaned Elements
- **Likelihood:** Medium (parent deleted but children remain)
- **Impact:** Medium — Bricks shows "orphaned elements" warning
- **Mitigation:**
  - When deleting: recursively remove all children first
  - When inserting: validate all parent IDs exist
  - Use Bricks' built-in `$_checkForOrphanedElements` / `$_cleanupOrphanedElements`

## Moderate Risks

### R6: ACSS Global Class ID Conflicts
- **Likelihood:** Low-Medium
- **Impact:** Medium — elements lose styling
- **Mitigation:**
  - When importing elements, remap class IDs to match target site's ACSS classes
  - Match by class name, not ID (IDs are random hashes like `"alq0tl"`)
  - Plugin should maintain class name → ID mapping table

### R7: Media Reference Breakage
- **Likelihood:** Medium (images have absolute URLs and attachment IDs)
- **Impact:** Low-Medium — broken images
- **Mitigation:**
  - Strip/remap media URLs during import
  - Use placeholder images for preview
  - Queue media for upload and remap references after

### R8: Chrome Extension Store Rejection
- **Likelihood:** Low-Medium
- **Impact:** Low — delays distribution, not functionality
- **Mitigation:**
  - Follow MV3 best practices from the start
  - No remote code execution
  - Self-host CRX during development phase
  - Clear privacy policy for any data handling

### R9: Concurrent Editing Conflicts
- **Likelihood:** Low (single editor typical)
- **Impact:** Medium — data loss
- **Mitigation:**
  - Bricks has `globalClassesTimestamp` for conflict detection
  - Check `state.hasConflicts` before writing
  - Show warning if another session is active (`state.lockedUser`)

### R10: Performance Impact on Large Pages
- **Likelihood:** Medium (Demo page has 744 elements)
- **Impact:** Low-Medium — slow operations
- **Mitigation:**
  - Operate on subtrees, not full tree
  - Debounce operations
  - Use `$_forceRender` sparingly
  - Profile operations on large pages during testing

## Low Risks

### R11: Vue Version Upgrade Breaking State Access
- **Likelihood:** Low (Vue 3 is stable, Bricks unlikely to switch)
- **Impact:** High if it happens
- **Mitigation:** `__vue_app__` accessor is Vue 3 standard; test on each Bricks update

### R12: WordPress REST API Disabled
- **Likelihood:** Low
- **Impact:** Low — save uses admin-ajax.php, not REST API
- **Mitigation:** Plugin uses admin-ajax.php for critical paths, REST for optional features
