---
title: Keyboard shortcuts
description: All keyboard shortcuts available in the Agent to Bricks GUI, including command palette, panel toggles, session management, and prompt editing.
---

The app registers global keyboard shortcuts through a `useKeyboardShortcuts` hook that listens on the window. Most shortcuts use `Cmd` on macOS and `Ctrl` on Windows/Linux. Some shortcuts are suppressed when the terminal has focus to avoid conflicting with the AI tool's own key bindings.

## Quick reference

| Shortcut | Action | Works in terminal? |
|---|---|---|
| `Cmd/Ctrl+P` | Focus the prompt editor | Yes |
| `Cmd/Ctrl+B` | Toggle sidebar | No |
| `Cmd/Ctrl+N` | Launch new session with default tool | No |
| `Escape` | Return focus to terminal | No |

"Works in terminal?" means the shortcut fires even when the xterm terminal has focus. Shortcuts marked "No" only work when focus is outside the terminal (in the sidebar, context panel, or any dialog).

## Prompt editor focus

**`Cmd/Ctrl+P`** is the most-used shortcut. It moves focus to the prompt editor textarea so you can start writing a prompt without reaching for the mouse.

Inside the prompt editor and command palette:

| Key | Action |
|---|---|
| `Escape` | Close the palette / return to terminal |
| `Arrow Up / Arrow Down` | Navigate autocomplete results |
| `Tab` or `Enter` | Select highlighted autocomplete item |
| `Cmd/Ctrl+Enter` | Submit the prompt |

The command palette also handles app-level commands typed as plain text:

- `add site [name] at [url] key [api_key]`: Adds a new site
- `switch to [site name]`: Switches the active site
- `dark` / `light`: Changes the theme
- `save preset [name]`: Saves the current prompt as a preset
- `set api_key [value]`: Updates the active site's API key

## Panel toggles

**`Cmd/Ctrl+B`** toggles the sidebar. When the sidebar collapses, the terminal panel expands to fill the freed space. Useful when you want maximum terminal real estate.

## Session management

**`Cmd/Ctrl+N`** launches a new session immediately. The app picks the default tool (Claude Code if installed, otherwise the first installed tool it finds) and launches it without opening the LaunchDialog. Good for quickly spinning up another session when you already have your tool configured the way you want.

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
| `Cmd/Ctrl+Enter` | Submit the prompt |
| `@` (typed) | Triggers the autocomplete type picker |

## Shortcuts that live elsewhere

A few interactions are not global keyboard shortcuts but are worth knowing:

- **Inline flag editing** in the sidebar: press `Enter` or `Escape` to confirm or cancel.
- **Session renaming** in the sidebar: press `Enter` to confirm, `Escape` to cancel.
- **Working directory editing**: same pattern. `Enter` to save, `Escape` to discard.
- **Dialogs** (LaunchDialog, AddToolDialog, SettingsDialog): `Escape` closes them, handled by the Radix UI dialog primitive.

## Customizing shortcuts

There is no shortcut customization UI yet. The shortcuts are hardcoded in `gui/src/hooks/useKeyboardShortcuts.ts`. If you need to change them, edit that file directly. The hook is straightforward; it is a single `useEffect` with a `keydown` listener that checks modifier keys and the pressed key.
