# Tauri GUI Companion -- Design Document

**Date:** 2026-02-24
**Status:** Approved
**Approach:** Terminal-First Companion (Approach A)

## Overview

A cross-platform Tauri 2.0 desktop app that demystifies AI coding CLI tools (Claude Code, Codex, OpenCode, and any custom tool) by wrapping them in a friendly GUI. The terminal is center-stage -- the app surrounds it with config management, session tracking, onboarding, and contextual help.

**Target users:** Progressive disclosure -- newcomers get guided setup and contextual tips, power users get a dashboard for managing multiple sessions, configs, and MCP servers.

**Design inspiration:** [Craft Agents OSS](https://github.com/lukilabs/craft-agents-oss) (three-panel layout, session management, onboarding flow) adapted for a terminal-first paradigm.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   TAURI SHELL                    │
│  ┌─────────────────────────────────────────────┐│
│  │              WEBVIEW (React)                 ││
│  │  ┌────────┬─────────────────┬──────────┐    ││
│  │  │Sidebar │   xterm.js PTY  │ Context  │    ││
│  │  │ (React)│   (Terminal)    │  Panel   │    ││
│  │  │        │                 │ (React)  │    ││
│  │  └────────┴─────────────────┴──────────┘    ││
│  └─────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────┐│
│  │             RUST BACKEND                     ││
│  │  - PTY process spawning (portable-pty)       ││
│  │  - CLI detection & health checks             ││
│  │  - Config file read/write + file watcher     ││
│  │  - Session persistence (SQLite)              ││
│  │  - Auto-update (tauri-plugin-updater)        ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Desktop frame | Tauri 2.0 | Cross-platform, ~5MB binary vs Electron ~150MB. Rust backend for process management. |
| Frontend | React 18 + Vite | Fast dev, huge ecosystem. |
| Terminal | xterm.js + xterm-addon-fit + xterm-addon-webgl | Battle-tested terminal emulator. WebGL renderer for performance. |
| PTY bridge | `portable-pty` (Rust crate) | Spawns real pseudo-terminals on macOS/Linux/Windows. Pipes I/O to xterm.js via Tauri IPC events. |
| Styling | Tailwind CSS v4 + OKLCH palette | Modern, themeable. |
| Components | Radix UI primitives (custom styled) | Accessible, unstyled. All custom-themed. |
| State | Jotai atom families | Per-session state isolation. |
| Persistence | SQLite via `tauri-plugin-sql` | Sessions, tool configs, history. Single file, portable. |
| Icons | Phosphor Icons | Clean, consistent. |
| Fonts | Manrope (app chrome) + Geist Mono (terminal) | Manrope matches Bricks Builder brand. |

### PTY Data Flow

```
xterm.js (keystrokes)
  -> Tauri IPC event ("pty:input", sessionId, bytes)
    -> Rust: write to PTY stdin

Rust: read PTY stdout
  -> Tauri IPC event ("pty:output", sessionId, bytes)
    -> xterm.js (render)
```

---

## Layout

Three-zone asymmetric grid (DESIGN_VARIANCE: 8, VISUAL_DENSITY: 4):

```
┌──────────────────────────────────────────────────────────┐
│  Agent to Bricks                          [_] [O] [X]   │
├────────┬─────────────────────────────────────┬───────────┤
│        │                                     │           │
│  240px │          FLEX: 1                    │   320px   │
│  SIDE  │                                     │  CONTEXT  │
│        │      xterm.js terminal              │           │
│  Tools │      (full PTY session)             │  Help     │
│  ----  │                                     │  Config   │
│  Sessns│      Dark bg: zinc-950              │  MCP      │
│  ----  │      Font: Geist Mono 14px          │  Docs     │
│  Sett. │                                     │           │
│  Help  │                                     │           │
├────────┼─────────────────────────────────────┼───────────┤
│        │ claude-code ● connected   opus 4    │  MCP: 3   │
└────────┴─────────────────────────────────────┴───────────┘
```

### Responsive Behavior

| Width | Sidebar | Context Panel | Terminal |
|-------|---------|---------------|----------|
| > 1000px | Expanded (240px) | Expanded (320px) | Flex: 1 |
| 700-1000px | Icon rail (56px) | Auto-hidden | Flex: 1 |
| < 700px | Hidden (hamburger) | Hidden | Full width |

---

## Color System (Bricks Builder Aligned)

OKLCH palette with Bricks' gold accent:

| Token | Light | Dark | Source |
|-------|-------|------|--------|
| `--bg` | `oklch(0.98 0.002 85)` | `oklch(0.14 0.005 265)` | Warm white / deep charcoal |
| `--surface` | `oklch(0.96 0.003 85)` | `oklch(0.18 0.005 265)` | Sidebar, panels |
| `--terminal` | -- | `oklch(0.10 0.005 265)` | Always dark |
| `--fg` | `oklch(0.25 0.01 265)` | `oklch(0.93 0.005 85)` | Primary text |
| `--fg-muted` | `oklch(0.50 0.01 265)` | `oklch(0.65 0.008 265)` | Secondary text |
| `--accent` | `oklch(0.82 0.16 85)` | `oklch(0.82 0.16 85)` | Bricks gold `hsl(46,96%,53%)` |
| `--accent-hover` | `oklch(0.76 0.14 85)` | `oklch(0.88 0.14 85)` | Gold hover state |
| `--border` | `oklch(0.90 0.003 265)` | `oklch(0.22 0.005 265)` | Dividers |
| `--destructive` | `oklch(0.55 0.22 27)` | `oklch(0.60 0.22 27)` | Errors |

### Accent Usage Rules

- Tool status dots: gold pulse when running
- Active sidebar item: gold left border (`border-l-2`)
- Primary buttons: gold bg with dark text (matches bricksbuilder.io CTAs)
- Links and interactive highlights: gold
- Terminal stays pure -- no gold inside the terminal itself

---

## Typography

| Element | Spec |
|---------|------|
| Sidebar headings | Manrope, 11px, `tracking-widest uppercase`, fg-muted |
| Sidebar items | Manrope, 13px, `tracking-tight`, fg |
| Terminal | Geist Mono, 14px, `leading-relaxed` |
| Context panel titles | Manrope, 15px, `font-semibold tracking-tight` |
| Context panel body | Manrope, 13px, `leading-relaxed text-fg-muted` |
| Status bar | Geist Mono, 12px, `tracking-tight` |

---

## Components

### Sidebar

```
┌──────────────────┐
│  > Agent to Bricks│  Gold diamond logo
│                  │
│  TOOLS           │  Section heading, muted uppercase
│  ● Claude Code   │  Gold dot = running
│  ○ Codex         │  Hollow dot = stopped
│  ○ OpenCode      │  Click to launch
│  + Add tool      │  Opens tool config dialog
│                  │
│  SESSIONS        │
│  fix auth bug    │  Recent sessions per tool
│  add dark mode   │
│  refactor api    │
│                  │
│  ─────────────── │
│  Settings        │
│  Help            │
│  Theme toggle    │
└──────────────────┘
```

Collapsed mode (icon rail, 56px): Only tool icons + settings gear. Expand with `Cmd+B` or hover-to-peek.

### Tool Launcher Flow

1. Click a tool in sidebar
2. If not installed: context panel shows install instructions with copy-paste commands
3. If installed but not configured: guided config (API keys, model selection)
4. If ready: spawns PTY session, xterm.js connects, tool launches

### Context Panel

Switches content based on active state:

| Context | Panel Content |
|---------|---------------|
| No tool running | Welcome screen with quick-start cards |
| Tool launching | Setup checklist (installed? configured? ready?) |
| Tool running | Contextual reference: slash commands, keyboard shortcuts, tips |
| Config selected | Visual form editors for config files, MCP servers, API keys |
| Docs selected | Searchable command reference for the active tool |

### Config Editors

Write directly to each tool's native config files (`~/.claude/settings.json`, `~/.config/codex/config.yaml`, etc.). No separate config layer -- what the GUI edits is what the CLI reads.

Key config surfaces:
- MCP server manager (list, add, edit, enable/disable)
- API key management (masked display, edit inline)
- Model selector (dropdown per tool)
- Permission mode toggle (explore / ask / auto)
- CLAUDE.md editor (syntax-highlighted textarea)

### Status Bar

```
┌────────────────────────────────────────────────────────┐
│ ● claude-code  │  opus-4-6  │  ask mode  │  MCP: 3/3  │
└────────────────────────────────────────────────────────┘
```

Geist Mono 12px. Gold dot for active tool. Parsed from config files.

### Add Tool Dialog

Any CLI that runs in a terminal can be added:
- Tool name (display label)
- Launch command (the shell command to run)
- Working directory (optional default)
- Config file path (optional, for GUI config editing)

---

## Onboarding (First Launch)

4-step fullscreen wizard:

**Step 1 -- Welcome:** App intro, gold "Get Started" CTA.

**Step 2 -- Tool detection:** Rust backend scans PATH for known CLIs (`which claude`, `which codex`, `which opencode`). Shows installed/missing with version info. Offers install links for missing tools.

**Step 3 -- Config check:** Per detected tool, verifies API keys, MCP servers, model selection. Surfaces existing config, offers to fill gaps. Does not replace or duplicate config -- reads the tool's own files.

**Step 4 -- Ready:** Quick-launch cards for each configured tool. Keyboard shortcut hints (`Cmd+B`, `Cmd+\`).

Wizard never shows again after completion. Incomplete tools show "Setup" instead of "Launch" in sidebar.

---

## State Management

### Jotai Atom Structure

```
atoms/
  app.ts           -> sidebarOpen, contextPanelOpen, theme, onboardingComplete
  tools.ts         -> toolsAtom (registered tools + install status)
  sessions.ts      -> sessionFamily(id) -> { toolSlug, ptyPid, status, startedAt }
  activeSession.ts -> activeSessionId (which terminal is visible)
  config.ts        -> configFamily(toolSlug) -> parsed config for each tool
```

### Session Lifecycle

1. User clicks tool -> Rust spawns PTY -> returns sessionId
2. React creates session atom, xterm.js attaches to PTY IPC stream
3. User exits or tool crashes -> Rust emits exit event
4. Session marked "ended," scrollback preserved in memory
5. Clicking old session shows read-only scrollback with restart option

### Config Sync

Rust file watcher monitors each tool's config files. GUI edits write to native config files. External edits trigger React state updates. Two-way sync, single source of truth (the tool's own files).

### SQLite (Our Data Only)

- Tool registry (name, command, icon, config path)
- Session history (id, tool, started, ended, working dir)
- Onboarding state
- Window position/size

---

## Error Handling

Every error state has an action -- no dead ends.

| Scenario | Behavior |
|----------|----------|
| Tool not installed | Context panel shows install commands with copy buttons + refresh |
| Tool crashes | Terminal shows raw error, status bar turns red, toast notification, restart button |
| API key missing | Context panel shows inline form for the specific key |
| Config file locked | Toast with explanation, read-only config editor, manual path shown |
| PTY spawn failure | Styled error in terminal area with PATH info, settings link, retry |
| Window too narrow | Progressive collapse: context -> icon rail -> hamburger menu |

Multiple sessions run simultaneously (each tool gets its own PTY). Switching sessions swaps xterm.js attachment; inactive PTYs keep running in background.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Toggle sidebar |
| `Cmd+\` | Toggle context panel |
| `Cmd+N` | New session (launches active tool) |
| `Cmd+W` | Close current session |
| `Cmd+1-9` | Switch to session by index |
| `Cmd+,` | Open settings |
| `Cmd+K` | Command palette |
| `Ctrl+Tab` | Next session |
| `Ctrl+Shift+Tab` | Previous session |
| `Escape` | Focus terminal |

All keyboard input passes through to xterm.js when terminal is focused. App shortcuts only fire from app chrome focus. No conflicts with CLI keybindings.

---

## Accessibility

- Radix UI primitives: ARIA roles, focus management, screen reader support
- Sidebar: arrow key navigation with roving tabindex
- High contrast: gold on zinc-950 meets WCAG AA (7.2:1 ratio)
- Landmark roles: `nav` (sidebar), `main` (terminal), `complementary` (context)

---

## Motion (MOTION_INTENSITY: 6)

- Sidebar expand/collapse: spring (`stiffness: 300, damping: 30`)
- Context panel slide: `translateX` with spring
- Tool status dot: breathing pulse (`opacity 0.4 -> 1.0`, 2s ease)
- Session list items: staggered fade-in (25ms per item)
- Radix overlay animations: disabled (`animation: none !important`) for instant feel
- All continuous animations isolated in their own client components
