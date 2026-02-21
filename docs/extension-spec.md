# Chrome Extension Spec — Agent to Bricks

> Version: 0.1.0 | Date: 2026-02-15 | Manifest: MV3

---

## Overview

Chrome extension that provides a floating control panel within the Bricks Builder editor for AI-assisted element creation, modification, and inspection. Communicates with the WP plugin for validated writes.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│ Chrome Extension (MV3)                                │
│                                                        │
│  ┌──────────────┐   ┌──────────────┐                  │
│  │ Background    │   │ Content      │                  │
│  │ Service       │◄─►│ Script       │                  │
│  │ Worker        │   │ (injected)   │                  │
│  │               │   │              │                  │
│  │ - Auth coord  │   │ - Floating   │                  │
│  │ - REST calls  │   │   panel UI   │                  │
│  │ - State sync  │   │ - Runtime    │                  │
│  │               │   │   probes     │                  │
│  └──────┬───────┘   │ - Selection  │                  │
│         │            │   observer   │                  │
│         │            └──────┬───────┘                  │
│         │                   │                           │
│         │    window.postMessage                         │
│         │                   │                           │
│         │            ┌──────▼───────┐                  │
│         │            │ Page Script  │                  │
│         │            │ (injected)   │                  │
│         │            │              │                  │
│         │            │ - builderTest│                  │
│         │            │   access     │                  │
│         │            │ - State read │                  │
│         │            │ - Element    │                  │
│         │            │   CRUD       │                  │
│         │            └──────────────┘                  │
│         │                                              │
│         │  REST API                                    │
│         ▼                                              │
│  ┌──────────────┐                                      │
│  │ WP Plugin    │                                      │
│  │ /agent-bricks/  │                                      │
│  │ v1/          │                                      │
│  └──────────────┘                                      │
└──────────────────────────────────────────────────────┘
```

---

## Messaging Protocol

### Content Script ↔ Page Script (via `window.postMessage`)

All messages use the format:
```json
{
  "source": "agent-to-bricks",
  "type": "REQUEST|RESPONSE",
  "action": "ACTION_NAME",
  "requestId": "uuid",
  "payload": { ... }
}
```

### Actions

#### `GET_SELECTION`
Read currently selected element(s).

**Request:** `{}`
**Response:**
```json
{
  "activeId": "705598",
  "activeElement": {
    "id": "705598",
    "name": "heading",
    "label": "Heading",
    "parent": "4fdc64",
    "children": [],
    "settings": { "text": "The quick brown fox...", "tag": "h1", "_cssGlobalClasses": ["alq0tl"] }
  },
  "selectedElements": [],
  "ancestors": ["4fdc64", "3c38c0", "640f4e"]
}
```

#### `GET_SUBTREE`
Read element and all descendants.

**Request:** `{ "elementId": "640f4e" }`
**Response:**
```json
{
  "root": { "id": "640f4e", "name": "section", ... },
  "elements": [ /* flattened subtree */ ],
  "globalClasses": [ /* referenced classes */ ]
}
```

#### `GET_CONTEXT`
Read builder context (classes, palette, breakpoint, etc.)

**Request:** `{}`
**Response:**
```json
{
  "postId": "1297",
  "bricksVersion": "2.2",
  "nonce": "1cc7a1bedd",
  "globalClasses": [ ... ],
  "colorPalette": [ ... ],
  "breakpointActive": { ... },
  "elementTypes": [ "section", "container", "block", "heading", ... ]
}
```

#### `PREVIEW_PATCH`
Apply a patch temporarily (no save) for visual preview.

**Request:**
```json
{
  "patch": {
    "patchMode": "insert",
    "targetParent": "97a22e",
    "targetIndex": 0,
    "nodes": [ { "name": "heading", "settings": { "text": "Preview", "tag": "h2" } } ]
  }
}
```
**Response:** `{ "previewElementIds": ["tmp_abc"], "success": true }`

#### `REVERT_PREVIEW`
Remove preview elements, restore original state.

**Request:** `{ "previewElementIds": ["tmp_abc"] }`
**Response:** `{ "success": true }`

#### `COMMIT_PATCH`
Validate via plugin, then apply and save.

**Request:**
```json
{
  "patch": { ... },
  "reason": "AI: Added hero heading"
}
```
**Response:** `{ "success": true, "snapshotId": "snap_xxx", "newElementIds": ["abc"] }`

#### `SELECT_ELEMENT`
Programmatically select an element in the builder.

**Request:** `{ "elementId": "705598" }`
**Response:** `{ "success": true }`

#### `SET_ACTIVE_ELEMENT`
Implementation of selection:
```javascript
const state = builderTest._getBricksState();
state.activeId = elementId;
builderTest._getBricksInternalFunctions().$_setActiveElement();
```

---

## Floating Panel UI

### Layout

```
┌─────────────────────────────────┐
│ 🧱 Agent to Bricks     [−] [×] │
├─────────────────────────────────┤
│ Selected: Heading (h1)     [📋] │
│ ID: 705598 | Parent: 4fdc64    │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ What would you like to do?  │ │
│ │                             │ │
│ │ [text input area]           │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Preview] [Apply] [Export JSON] │
├─────────────────────────────────┤
│ History:                        │
│  • snap_001: Added heading      │
│  • snap_002: Modified styles    │
│  [Rollback ▼]                   │
└─────────────────────────────────┘
```

### Panel Features

1. **Element Inspector** — Shows selected element details, settings, classes
2. **AI Prompt Input** — Natural language instruction for modifications
3. **Preview Mode** — Apply changes temporarily before committing
4. **Export JSON** — Download normalized element subtree
5. **History** — List snapshots with one-click rollback
6. **Class Browser** — Browse ACSS and global classes

### Panel Behavior

- Draggable, resizable, collapsible
- Remembers position via `chrome.storage.local`
- Auto-updates when selection changes in builder
- Shows connection status (plugin reachable / nonce valid)
- Keyboard shortcut: `Ctrl+Shift+B` to toggle

---

## Content Script Injection

### Manifest Permissions

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["*://*/*?*bricks=run*"],
  "content_scripts": [
    {
      "matches": ["*://*/*?*bricks=run*"],
      "js": ["content-script.js"],
      "css": ["panel.css"],
      "run_at": "document_idle"
    }
  ]
}
```

### Detection Logic

Content script activates when:
1. URL contains `bricks=run`
2. `window.bricksData` exists
3. `window.builderTest` is accessible
4. `#bricks-builder-iframe` is present

### Page Script Injection

Content scripts can't access page JS globals directly. Inject a page script via `<script>` tag:

```javascript
// content-script.js
const script = document.createElement('script');
script.src = chrome.runtime.getURL('page-script.js');
document.head.appendChild(script);

// Communication via window.postMessage
window.addEventListener('message', (event) => {
  if (event.data?.source === 'agent-to-bricks') {
    // Handle response from page script
  }
});
```

---

## Selection Observer

The page script watches for selection changes:

```javascript
// page-script.js
let lastActiveId = null;

setInterval(() => {
  const state = window.builderTest._getBricksState();
  if (state.activeId !== lastActiveId) {
    lastActiveId = state.activeId;
    window.postMessage({
      source: 'agent-to-bricks',
      type: 'EVENT',
      action: 'SELECTION_CHANGED',
      payload: {
        activeId: state.activeId,
        activeElement: state.activeElement ? {
          id: state.activeElement.id,
          name: state.activeElement.name,
          label: state.activeElement.label,
          parent: state.activeElement.parent,
          settings: state.activeElement.settings
        } : null
      }
    }, '*');
  }
}, 250);
```

---

## Error States

| State | UI Behavior |
|-------|-------------|
| Plugin not installed | Banner: "Install Agent to Bricks plugin for write access" |
| Nonce expired | Banner: "Session expired — reload builder" |
| Validation failed | Show errors inline, highlight invalid fields |
| Save failed | Show error, offer retry or rollback |
| `builderTest` missing | Banner: "Bricks version not supported" |
| Network error | Show offline indicator, queue operations |

---

## Graceful Degradation

| Plugin Status | Available Features |
|---------------|-------------------|
| Plugin active | Full: read, preview, validate, commit, rollback |
| Plugin inactive | Read-only: inspect, export JSON, copy classes |
| Plugin missing | Read-only: inspect selection, view element tree |
