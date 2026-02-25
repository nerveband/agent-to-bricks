---
title: Keyboard shortcuts
description: All keyboard shortcuts available in the Agent to Bricks GUI -- command palette, panel toggles, session management, and prompt editing.
---

The app registers global keyboard shortcuts through a `useKeyboardShortcuts` hook that listens on the window. Most shortcuts use `Cmd` on macOS and `Ctrl` on Windows/Linux (referred to as `Mod` below). Some shortcuts are suppressed when the terminal has focus to avoid conflicting with the AI tool's own key bindings.

## Quick reference

| Shortcut | Action | Works in terminal? |
|---|---|---|
| `Mod+P` | Toggle command palette | Yes |
| `Mod+Shift+P` | Open command palette (always opens, never closes) | Yes |
| `Mod+B` | Toggle sidebar | No |
| `Mod+\` | Toggle context panel | No |
| `Mod+K` | Open context panel and focus prompt editor | No |
| `Mod+N` | Launch new session with default tool | No |
| `Escape` | Return focus to terminal | No |

"Works in terminal?" means the shortcut fires even when the xterm terminal has focus. Shortcuts marked "No" only work when focus is outside the terminal -- in the sidebar, context panel, or any dialog.

## Command palette

**`Mod+P`** is the most-used shortcut. It toggles the command palette on and off. The palette is a centered overlay with a prompt input, @mention support, quick-access chips, and recent history.

**`Mod+Shift+P`** always opens the palette. If it is already open, it stays open. Use this when you want to guarantee the palette appears without accidentally closing it.

Inside the command palette:

| Key | Action |
|---|---|
| `Escape` | Close the palette |
| `Arrow Up / Arrow Down` | Navigate autocomplete results |
| `Tab` or `Enter` | Select highlighted autocomplete item |
| `Mod+Enter` | Submit the prompt |

The palette also handles app-level commands typed as plain text:

- `add site [name] at [url] key [api_key]` -- Adds a new site
- `switch to [site name]` -- Switches the active site
- `dark` / `light` -- Changes the theme
- `save preset [name]` -- Saves the current prompt as a preset
- `set api_key [value]` -- Updates the active site's API key

## Panel toggles

**`Mod+B`** toggles the sidebar. When the sidebar collapses, the terminal panel expands to fill the freed space. Useful when you want maximum terminal real estate.

**`Mod+\`** (backslash) toggles the context panel on the right side. Same idea -- collapse it to give the terminal more room, bring it back when you need the prompt workshop or site preview.

**`Mod+K`** opens the context panel (if closed) and moves focus directly to the PromptWorkshop's textarea. This is the fastest way to start writing a prompt without reaching for the mouse. The app looks for the element matching `[data-prompt-workshop] textarea` and focuses it after a short delay.

## Session management

**`Mod+N`** launches a new session immediately. The app picks the default tool (Claude Code if installed, otherwise the first installed tool it finds) and launches it without opening the LaunchDialog. Good for quickly spinning up another session when you already have your tool configured the way you want.

## Terminal focus

**`Escape`** moves focus back to the active terminal's xterm textarea. If you have been typing in the sidebar search, editing a session name, or working in the context panel, pressing Escape drops you back into the terminal so you can keep interacting with the AI tool.

This only fires when focus is outside the terminal. When the terminal already has focus, Escape passes through to the tool running inside it.

## Autocomplete shortcuts (in prompt inputs)

When the @mention autocomplete dropdown is visible in either the PromptWorkshop or CommandPalette:

| Key | Action |
|---|---|
| `Arrow Down` | Move selection down in the list |
| `Arrow Up` | Move selection up in the list |
| `Tab` | Accept the highlighted item |
| `Enter` | Accept the highlighted item |
| `Escape` | Dismiss the autocomplete dropdown |

When autocomplete is not showing:

| Key | Action |
|---|---|
| `Mod+Enter` | Submit the prompt |
| `@` (typed) | Triggers the autocomplete type picker |

## Shortcuts that live elsewhere

A few interactions are not global keyboard shortcuts but are worth knowing:

- **Inline flag editing** in the sidebar: press `Enter` or `Escape` to confirm or cancel.
- **Session renaming** in the sidebar: press `Enter` to confirm, `Escape` to cancel.
- **Working directory editing**: same pattern -- `Enter` to save, `Escape` to discard.
- **Dialogs** (LaunchDialog, AddToolDialog, SettingsDialog): `Escape` closes them, handled by the Radix UI dialog primitive.

## Customizing shortcuts

There is no shortcut customization UI yet. The shortcuts are hardcoded in `gui/src/hooks/useKeyboardShortcuts.ts`. If you need to change them, edit that file directly. The hook is straightforward -- it is a single `useEffect` with a `keydown` listener that checks modifier keys and the pressed key.
