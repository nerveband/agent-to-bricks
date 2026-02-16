# Bricks Builder Runtime Map

> Generated: 2026-02-15 | Bricks 2.2 | WordPress REST API v2 | Chrome 144

---

## Environment

| Item | Value |
|------|-------|
| Bricks Builder | 2.2 |
| WordPress | REST API v2 (`wp/v2/`) |
| Chrome | 144.0.0.0 |
| Site | `ts-staging.wavedepth.com` |
| Post ID (Demo) | 1297 |
| Framework | Vue.js 3 (SFC, reactive state) |
| Canvas | iframe (`#bricks-builder-iframe`) |
| Bundler | webpack (`webpackChunkbricks`) |
| CSS Framework | Automatic.css (ACSS) integrated via global classes |

---

## Global Objects

### `bricksData` (139 keys) — Configuration & Settings

Primary configuration object loaded at page init.

| Key | Type | Purpose |
|-----|------|---------|
| `version` | string | `"2.2"` |
| `nonce` | string | AJAX nonce for `bricks_save_post` |
| `ajaxUrl` | string | `/wp-admin/admin-ajax.php` |
| `restApiUrl` | string | `/wp-json/bricks/v1/` |
| `postId` | string | Current post ID |
| `postType` | string | `page`, `post`, etc. |
| `elements` | object | Registered element definitions |
| `controls` | object | Control type definitions |
| `controlOptions` | object | Control option enums |
| `themeStyles` | object | Active theme style settings |
| `breakpoints` | array | Responsive breakpoint definitions |
| `dynamicTags` | object | Dynamic data tag registry |
| `i18n` | object | Internationalization strings |
| `homeUrl` | string | Site home URL |
| `adminUrl` | string | WP admin URL |
| `isTemplate` | string | Whether editing a template |
| `autosave` | object | `{ disabled: false, interval: 60 }` |
| `fonts` | object | Font registry |
| `icons` | object | Icon set registry |
| `pageSettings` | object | Per-page settings |
| `templateSettings` | object | Template-level settings |

### `builderTest` (52 keys) — Public API Surface

Exposed test/debug API with direct access to builder internals.

**Getter Functions:**
| Method | Returns |
|--------|---------|
| `_getBricksState()` | Full reactive Vue state (227 keys) |
| `_getBricksElements()` | All registered elements (807 entries) |
| `_getBricksInternalFunctions()` | Internal API (213 functions + 20 reactive refs) |
| `_getActiveElement()` | Currently selected element |
| `_getElementById(id)` | Element by ID |
| `getElementTree()` | Element tree structure |
| `getIframeDocument()` | Canvas iframe document |
| `getCurrentElementId()` | Active element ID |
| `getActiveElementInternalId()` | Internal ID of active element |

**Class Management:**
| Method | Purpose |
|--------|---------|
| `addClass(name)` | Add class to element |
| `removeClass(name)` | Remove class |
| `renameClass(old, new)` | Rename class |
| `addClassToElement(cls, el)` | Assign class to element |
| `removeClassFromElement(cls, el)` | Remove class from element |
| `getActiveClassesAsArray()` | List active classes |
| `copyStylesFromClass(cls)` | Copy styles from class |
| `_getBricksGlobalClassById(id)` | Get global class by ID |
| `_getBricksGlobalClassByName(name)` | Get global class by name |

### `wpApiSettings` — WordPress REST API

| Key | Value |
|-----|-------|
| `root` | `https://ts-staging.wavedepth.com/wp-json/` |
| `nonce` | WP REST nonce (different from Bricks nonce) |
| `versionString` | `wp/v2/` |

---

## Vue Reactive State (`_getBricksState()`) — 227 Keys

### Critical State Properties

**Selection & Active Element:**
| Key | Type | Purpose |
|-----|------|---------|
| `activeId` | string/null | Currently selected element ID |
| `activeElement` | object/null | Full element object of selection |
| `selectedElements` | array | Multi-selection array |
| `selectionSource` | object | Source of selection event |
| `isChangingSelection` | boolean | Selection transition flag |

**Content & Components:**
| Key | Type | Purpose |
|-----|------|---------|
| `content` | array | **Page content elements (flat array, 744 elements)** |
| `header` | array | Header elements |
| `footer` | array | Footer elements |
| `components` | array | Component definitions |
| `componentNavigationStack` | array | Component editing breadcrumb |
| `activeComponent` | object/null | Currently edited component |

**History & Undo:**
| Key | Type | Purpose |
|-----|------|---------|
| `history` | array | Undo history stack |
| `historyIndex` | number | Current position in history |
| `historyInProgress` | boolean | History operation in progress |

**Global Styles:**
| Key | Type | Purpose |
|-----|------|---------|
| `globalClasses` | array | All global CSS classes |
| `globalClassesNew` | array | Newly created classes |
| `globalClassesLocked` | array | Locked (ACSS) classes |
| `globalClassesCategories` | array | Class category groups |
| `globalVariables` | array | CSS variable definitions |
| `themeStyles` | object | Theme style configuration |
| `colorPalette` | array | Color palette definitions |

**Builder State:**
| Key | Type | Purpose |
|-----|------|---------|
| `mode` | string | `"light"` or `"dark"` |
| `unsavedChanges` | array | List of changed areas (e.g. `["content"]`) |
| `isSaving` | boolean | Save in progress |
| `isPreviewing` | boolean | Preview mode active |
| `isInlineEditing` | boolean | Inline text editing active |
| `breakpointActive` | object | Current responsive breakpoint |
| `postId` | string | Current post ID |
| `postType` | string | Current post type |

---

## Element Schema

Each element in `state.content` follows this structure:

```json
{
  "id": "705598",
  "name": "heading",
  "label": "Heading",
  "parent": "4fdc64",
  "children": [],
  "settings": {
    "text": "The quick brown fox jumps over the lazy dog",
    "tag": "h1",
    "_cssGlobalClasses": ["alq0tl"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 6-char hex ID (e.g. `"705598"`) or generated alpha (e.g. `"ojhpez"`) |
| `name` | string | Element type: `section`, `container`, `block`, `heading`, `text-basic`, `button`, `image`, etc. |
| `label` | string | User-visible label in structure panel |
| `parent` | string/0 | Parent element ID, or `0` for root |
| `children` | array | Ordered list of child element IDs |
| `settings` | object/array | Element-specific settings (empty = `[]`) |

### Common Settings Keys

| Key | Used By | Description |
|-----|---------|-------------|
| `text` | heading, text-basic, button | Text content |
| `tag` | heading, text-basic | HTML tag (`h1`-`h6`, `p`, `div`) |
| `_cssGlobalClasses` | all | Array of global class IDs |
| `_hidden` | all | Hidden settings (not shown in UI) |
| `style` | button | Button style variant |
| `size` | button | Button size |
| `link` | button, image | Link configuration |

---

## Internal Functions (`_getBricksInternalFunctions()`) — 213 Functions

### Element CRUD

| Function | Signature | Tested | Notes |
|----------|-----------|--------|-------|
| `$_addNewElement` | `({ element, index, parent }, options, checkPerm)` | **PASS** | Creates new element in tree |
| `$_cloneElement` | `({ element, index? })` | **PASS** | Duplicates element + children |
| `$_deleteElement` | `(element)` | **PASS** | Removes element from tree |
| `$_copyElements` | `(elements, options)` | untested | Copies to clipboard |
| `$_pasteElements` | `(options)` | untested | Pastes from clipboard |
| `$_moveElement` | `(params)` | untested | Moves element in tree |
| `$_sortElement` | `(params)` | untested | Reorders element |

### Selection

| Function | Signature | Tested | Notes |
|----------|-----------|--------|-------|
| `$_setActiveElement` | `()` | **PASS** | Reads `state.activeId`, sets `state.activeElement` |
| `$_selectElements` | `(elements)` | untested | Multi-select |

### Persistence

| Function | Signature | Tested | Notes |
|----------|-----------|--------|-------|
| `$_savePost` | `({ force? })` | **PASS** | Saves via AJAX to `bricks_save_post` |
| `$_populateBuilder` | `(data)` | untested | Loads element data into builder |
| `$_exportAsJsonFile` | `(data)` | untested | Triggers JSON download |

### Component Management

| Function | Purpose |
|----------|---------|
| `$_setActiveComponent` | Enter component editing |
| `$_updateActiveComponent` | Update component data |
| `$_exitComponent` | Leave component editing |
| `$_getComponent` | Get component definition |
| `$_getComponentById` | Find component by ID |
| `$_getComponentChildren` | Get component children |

### Utilities

| Function | Purpose |
|----------|---------|
| `$_generateId` | Generate new element ID |
| `$_clone` | Deep clone object |
| `$_forceRender` | Force canvas re-render |
| `$_reloadCanvas` | Full canvas reload |
| `$_postMessage` | Send message to iframe |
| `$_http` | Internal HTTP helper |
| `$_getIframeDoc` | Get iframe document |
| `$_getIframeWindow` | Get iframe window |

---

## Network Endpoints

### Save Post (Primary)

```
POST /wp-admin/admin-ajax.php
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
```

**Payload Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `action` | string | `"bricks_save_post"` |
| `area` | string | `"content"` |
| `templateType` | string | `"content"` |
| `content` | JSON string | Full element array |
| `components` | JSON string | Component definitions |
| `colorPalette` | JSON string | Color palette |
| `globalClasses` | JSON string | Global CSS classes |
| `globalClassesTrash` | JSON string | Trashed classes |
| `globalClassesLocked` | JSON string | Locked classes (ACSS) |
| `globalClassesCategories` | JSON string | Class categories |
| `globalVariables` | JSON string | CSS variables |
| `globalVariablesRenamed` | JSON string | Renamed variables |
| `globalVariablesCategories` | JSON string | Variable categories |
| `globalElements` | JSON string | Global elements |
| `globalQueries` | JSON string | Query definitions |
| `globalQueriesCategories` | JSON string | Query categories |
| `pinnedElements` | JSON string | Pinned elements |
| `pseudoClasses` | JSON string | Active pseudo classes |
| `themeStyles` | JSON string | Theme styles |
| `pageSettings` | JSON string | Page settings |
| `templateSettings` | JSON string | Template settings |
| `globalClassesTimestamp` | string | Timestamp for conflict detection |
| `globalChanges` | JSON string | `{ added, deleted, modified }` |
| `nonce` | string | From `bricksData.nonce` |
| `postId` | string | From `bricksData.postId` |
| `bricks-is-builder` | string | `"1"` |

**Response:**
```json
{ "success": true, "data": { /* echoed params */ } }
```

### REST API Base

```
GET/POST https://ts-staging.wavedepth.com/wp-json/bricks/v1/
```

(Not used for save — save uses admin-ajax.php)

---

## ACSS Integration Points

Automatic.css integrates via:

- **Global Classes:** Locked classes with `acss_import_` prefix (e.g. `acss_import_btn--primary`)
- **Global Class Categories:** Category `{ id: "acss", name: "Automatic.css" }`
- **Theme Styles:** `acss_bricks_1.10.x` theme style preset
- **Color Palette:** ACSS color palette with CSS variable references (e.g. `var(--primary)`)
- **CSS Variables:** `--space-m`, `--section-space-m`, `--gutter`, `--heading-font-family`, etc.

---

## Page Structure (Demo Page)

25 root sections with 744 total elements:

| Section Label | ID | Children |
|---------------|-----|----------|
| Style Guide | 97a22e | 1 |
| Ui Typography Section Alpha | 640f4e | 2 |
| UI Color Section Alpha | 252218 | 3 |
| UI Buttons & Links Section Alpha | ab1e77 | 9 |
| UI Color Relationships Alpha | 072ebd | 3 |
| UI Spacing Section Alpha | 794a6e | 6 |
| Icons & Cards Alpha | ee72e0 | 5 |
| Components | f03b63 | 1 |
| _HERO | 7a1cc8 | 1 |
| Page Hero | 064343 | 2 |
| White Hero | 8d5b4a | 1 |
| Light Gray Hero | 31c84a | 1 |
| Light Gradient Hero | 1381cc | 1 |
| Deep Gradient Hero | 5e1d57 | 1 |
| Dark Gradient Hero | 78d8fd | 1 |
| _CARDS | bd5208 | 1 |
| Cards | a904f8 | 5 |
| _CONTENT EXAMPLES | da1c56 | 1 |
| Example of Counter Cards | f12d69 | 2 |
| Example of Fees | 5bccc1 | 2 |
| Example of Daily Schedule | cfad95 | 1 |
| Example of CTA Call Out | bed9cd | 1 |
| Example of Child's Learning Journey | 777d9b | 2 |
| Left Content | 5a6165 | 1 |
| Right Content | 418265 | 1 |
