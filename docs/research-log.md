# Bricks Builder — Research Log

## Environment

| Item | Version |
|------|---------|
| WordPress | REST API v2 |
| Bricks Builder | 2.2 |
| Chrome | 144.0.0.0 |
| Automatic.css | Integrated (via global classes + theme styles) |
| Date | 2026-02-15 |
| Site | ts-staging.wavedepth.com |
| Test Page | Demo (post ID 1297, Draft) |

---

## Phase 1 — Environment Setup

### Finding: Vue.js 3 Framework
- **Hypothesis:** Bricks uses a reactive JS framework for builder state
- **Test:** `window.__VUE__` check
- **Result:** `true` — Vue 3 confirmed
- **Confidence:** HIGH
- **Evidence:** `__VUE_INSTANCE_SETTERS__`, `__VUE_SSR_SETTERS__` present; Vue app root at `div.brx-body.main`

### Finding: `bricksData` Global (139 keys)
- **Hypothesis:** Bricks loads configuration into a global object
- **Test:** `'bricksData' in window`
- **Result:** Object with 139 keys including version, nonce, ajaxUrl, elements, controls
- **Confidence:** HIGH

### Finding: `builderTest` API (52 methods)
- **Hypothesis:** Bricks exposes a debug/test API
- **Test:** `Object.keys(window.builderTest)`
- **Result:** 52 methods including `_getBricksState`, `_getBricksElements`, `_getBricksInternalFunctions`
- **Confidence:** HIGH (but may be removed in production builds)

### Finding: 213 Internal Functions
- **Hypothesis:** Internal functions provide full CRUD capabilities
- **Test:** `Object.keys(builderTest._getBricksInternalFunctions())`
- **Result:** 213 functions + 20 reactive refs including `$_addNewElement`, `$_cloneElement`, `$_deleteElement`, `$_savePost`
- **Confidence:** HIGH

### Finding: Iframe Canvas
- **Hypothesis:** Builder renders content in an iframe
- **Test:** `document.getElementById('bricks-builder-iframe')`
- **Result:** iframe at `#bricks-builder-iframe` with src `?page_id=1297&bricks=run&brickspreview=true`
- **Confidence:** HIGH

---

## Phase 2 — State & Selection Model

### Finding: Flat Element Array (not tree)
- **Hypothesis:** Elements stored as nested tree
- **Test:** Inspected `state.content`
- **Result:** **Flat array** with `parent` references and `children` ID arrays. 744 elements, 25 root sections.
- **Confidence:** HIGH
- **Key insight:** Parent-child relationship is maintained via both `parent` field on each element AND `children` array on parents. Both must stay in sync.

### Finding: Element Schema
- **Test:** Inspected first 20 elements
- **Result:** `{ id, name, label, parent, children, settings }`
- **Confidence:** HIGH
- **Notes:**
  - `id`: 6-char hex or alpha string
  - `settings`: object with element-specific props, or empty `[]` (not `{}`)
  - `_cssGlobalClasses`: array of class IDs in settings

### Finding: Selection via `state.activeId`
- **Hypothesis:** Selection tracked via state property
- **Test:** Set `state.activeId = "705598"` then called `$_setActiveElement()`
- **Result:** **PASS** — element selected, panel updated, blue highlight appeared on canvas
- **Confidence:** HIGH
- **Method:**
  ```js
  const state = builderTest._getBricksState();
  state.activeId = elementId;
  builderTest._getBricksInternalFunctions().$_setActiveElement();
  ```

---

## Phase 3 — Network/API Pathways

### Finding: Save via admin-ajax.php (not REST)
- **Hypothesis:** Save uses REST API
- **Test:** Hooked XHR, triggered `$_savePost()`
- **Result:** `POST /wp-admin/admin-ajax.php` with action `bricks_save_post`
- **Confidence:** HIGH
- **Key payload params:** action, area, templateType, content (full JSON), components, globalClasses, globalClassesTrash, globalClassesLocked, globalClassesCategories, globalVariables, themeStyles, pageSettings, nonce, postId, bricks-is-builder
- **Auth:** nonce from `bricksData.nonce`, no WP REST nonce needed

### Finding: Save sends ENTIRE content array
- **Hypothesis:** Save is incremental/diff-based
- **Test:** Inspected save payload
- **Result:** **Full replace** — entire content array sent on every save
- **Confidence:** HIGH
- **Implication:** We can modify the content array and save without needing to track diffs

---

## Phase 4 — Mutation Tests

### Test 4.1: Clone Element — **PASS**
- **Method:** `$_cloneElement({ element: activeElement })`
- **Result:** Element count 744 → 745. Clone appeared in canvas and structure panel with new ID.
- **Rollback:** Deleted clone successfully

### Test 4.2: Insert New Element — **PASS**
- **Method:** `$_addNewElement({ element: { name: 'button', settings: { text: 'Hello from AI!', style: 'primary', size: 'lg' } }, parent: sectionId, index: 0 })`
- **Result:** Element count 745 → 746. Button inserted with generated ID `zbegxc`.
- **Rollback:** Deleted successfully

### Test 4.3: Delete Element — **PASS**
- **Method:** `$_deleteElement(elementObject)` (must pass full element object, not just ID)
- **Result:** Element removed from content array and canvas
- **Note:** `$_deleteElement()` without arguments shows confirmation dialog. Must pass element.

### Test 4.4: Save Post — **PASS**
- **Method:** `$_savePost({ force: true })`
- **Result:** XHR POST to admin-ajax.php, status 200, `{"success": true}`
- **Note:** `{ force: true }` saves all areas. Without `force`, only saves `unsavedChanges`.

### Test 4.5: Full Round-Trip — **PASS**
- **Flow:** Insert element → Save → Delete → Save
- **Result:** All operations succeeded. Element persisted after first save, removed after second save.
- **Final state:** 744 elements (original count), clean.

---

## Phase 5 — Context7 Docs Synthesis

### Bricks Builder Docs (academy.bricksbuilder.io)
- **Custom elements:** PHP API via `BricksElement` class, `bricks_register_element()`
- **Nestable elements:** `$nestable = true`, `get_nestable_children()` defines default children
- **Components:** Import/export as JSON, accessible from Components tab
- **Filters:** `bricks/get_element_data/maybe_from_post_id` for cross-template data
- **Post meta:** Element data stored as `_bricks_page_content_2`

### Automatic.css Docs (automaticcss.com)
- **Spacing variables:** `--space-m`, `--section-space-m`, `--gutter`
- **Typography variables:** `--heading-font-family`, `--heading-color`, `--h1` through `--h6`
- **Grid variables:** `--grid-2`, `--grid-3`, `--grid-gap`
- **Utility classes:** `.line-clamp--custom`, contextual classes
- **Integration:** ACSS classes imported as locked global classes in Bricks with `acss_import_` prefix
- **Category:** Global classes categorized under `{ id: "acss", name: "Automatic.css" }`

### Doc vs Runtime Conflicts
- **None found.** Runtime behavior matches documented element structure. Save mechanism uses admin-ajax.php as expected. Post meta key `_bricks_page_content_2` confirmed via save payload.
