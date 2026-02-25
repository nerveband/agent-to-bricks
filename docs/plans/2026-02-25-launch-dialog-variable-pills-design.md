# Launch Dialog & Variable Pills Design

**Date:** 2026-02-25
**Status:** Approved

## Overview

Two features plus a cleanup:

1. **Tool Launch Modal** — When clicking a tool in the sidebar, show a modal dialog with Working Directory, Flags, and an editable System Context Prompt before launching the session.
2. **Variable Pills** — All variable-like tokens ({curly_brace}, @mentions, {{double_curly}}) in the prompt builder and system prompt editor are rendered as highlighted, pill-shaped, clickable inline elements with popover editing.
3. **Remove sidebar theme toggle** — Delete the light/dark mode button from the sidebar bottom bar (already in Settings).

## Feature 1: Tool Launch Modal

### Behavior

- Clicking a tool in the sidebar opens a `LaunchDialog` modal instead of immediately launching.
- The modal shows three fields:
  - **Working Directory** — text input + browse button, pre-filled from `toolWorkingDirsAtom[slug]`
  - **Flags** — text input, pre-filled from `toolCustomFlagsAtom[slug]`
  - **System Context Prompt** — a `VariableEditor` (see Feature 2) showing the `sessionPrePromptAtom` template with variables rendered as pills
- "Launch" persists changes to atoms and calls `useSessionLauncher.launch()`.
- "Cancel" closes without side effects.
- The right-click context menu on tools remains for quick flag/path editing without launching.

### New Components & Atoms

- `gui/src/components/LaunchDialog.tsx` — the modal component
- `launchDialogToolAtom` (in `app.ts`) — `Tool | null`, controls modal open/close

### Data Flow

```
Tool Click → set launchDialogToolAtom
  → LaunchDialog opens (pre-populated from atoms)
  → User edits fields
  → "Launch" clicked
  → Persist to toolWorkingDirsAtom, toolCustomFlagsAtom, sessionPrePromptAtom
  → call launch(tool, { cwd, flags })
  → buildSiteContextPrompt() uses the edited template
  → Session starts
```

## Feature 2: Variable Pills with Inline Editing

### Variable Types

| Pattern | Examples | Pill Color |
|---------|----------|------------|
| `{curly_brace}` | `{site_url}`, `{description}`, `{filePath}` | Gold/accent |
| `@type` / `@type query` | `@page`, `@section Home`, `@class container` | Type-specific colors (existing MentionPill palette) |
| `{{double_curly}}` | Future custom user variables | Teal |

### New Components

- `gui/src/components/prompt/VariableEditor.tsx` — `contentEditable`-based rich text input that:
  - Parses text for variable patterns
  - Renders matches as inline `<span>` pills (rounded, colored, labeled)
  - Preserves normal text editing for non-variable content
  - Emits `onChange(plainText)` with the raw text representation

- `gui/src/components/prompt/VariablePillPopover.tsx` — small popover on pill click:
  - Shows variable name
  - Shows current resolved value (read-only)
  - Input field to override the value
  - Apply / Cancel buttons

- `gui/src/hooks/useVariableParser.ts` — parses text into segments:
  - Input: raw string
  - Output: `Array<{ type: "text" | "variable"; value: string; varName?: string; varType?: "curly" | "mention" | "double_curly" }>`

### Where Used

1. **LaunchDialog** — system context prompt textarea becomes VariableEditor
2. **PromptPane / MentionInput** — prompt textarea becomes VariableEditor
3. **PresetList** — preset descriptions show pills (read-only)

### Click-to-Edit Flow

```
User clicks pill
  → VariablePillPopover opens, anchored to pill
  → Shows: variable name, current value, editable input
  → "Apply" updates the variable value in the text
  → Popover closes, pill updates
```

## Feature 3: Remove Sidebar Theme Toggle

Delete the theme toggle button (Sidebar.tsx lines 483-491) and associated imports (`useTheme`, `Moon`, `SunDim`). The toggle already exists in SettingsDialog.

## Persistence

All values are persisted via the existing `useConfigPersistence` hook to `~/.agent-to-bricks/config.yaml`:
- `toolWorkingDirsAtom` — per-tool working directories
- `toolCustomFlagsAtom` — per-tool custom flags
- `sessionPrePromptAtom` — system context template

## Files Changed

### New Files
- `gui/src/components/LaunchDialog.tsx`
- `gui/src/components/prompt/VariableEditor.tsx`
- `gui/src/components/prompt/VariablePillPopover.tsx`
- `gui/src/hooks/useVariableParser.ts`

### Modified Files
- `gui/src/atoms/app.ts` — add `launchDialogToolAtom`
- `gui/src/components/Sidebar.tsx` — tool click opens LaunchDialog, remove theme toggle
- `gui/src/components/PromptPane.tsx` — replace MentionInput textarea with VariableEditor
- `gui/src/components/prompt/MentionInput.tsx` — integrate VariableEditor for inline pill rendering
- `gui/src/hooks/useSessionLauncher.ts` — accept prompt template override in launch()
