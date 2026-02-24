# Smart Prompt Composer — Design Document

**Date:** 2026-02-24
**Status:** Approved
**Branch:** feat/tauri-gui-prototype

## Overview

Transform the Agent to Bricks GUI from a terminal wrapper into an intelligent prompt composition tool that helps users write better natural language instructions for Claude Code. Two surfaces — a quick Command Palette (Cmd+P) and a full Prompt Workshop (upgraded Bricks tab) — share a single prompt engine that resolves @-mention references against live WordPress/Bricks site data.

The GUI teaches users to become proficient Claude Code prompters through transparency, hints, and progressive disclosure — building competence, not dependency.

## Goals

1. Make every Bricks CLI capability accessible via natural language through a smart prompt builder
2. Auto-load site context (pages, sections, elements, styles, classes, components, media) so prompts are precise
3. Teach users what good prompts look like so they graduate to raw Claude Code
4. Eliminate friction around CLI configuration — prompt-driven setup, multi-site switching
5. GUI equivalents for all keyboard shortcuts — accessible to all users

## Architecture

### Two Surfaces, One Engine

Both the Command Palette and Prompt Workshop share a single prompt composition engine:

1. **@-mention resolution** — parses `@type(query)` tokens, queries WordPress API via Tauri backend, returns structured site data
2. **Context assembly** — resolves references + user text into a context-rich prompt with LLM-friendly element tree summaries
3. **Intent classification** — detects whether input is a site action (→ Claude Code) or app action (→ handled internally)
4. **Prompt injection** — sends composed prompt into the active terminal via ptyBridge

### Data Flow

```
User types "@page(demo)" in prompt builder
  → Frontend extracts mention token
  → Calls invoke("search_pages", {query: "demo"})
  → User picks from autocomplete dropdown
  → On submit: calls invoke("get_page_elements", {pageId: 42})
  → Context assembler transforms to readable tree:
      Page "Demo Page" (ID: 42):
      ├── [section] Hero
      │   ├── [heading] "Welcome"
      │   └── [button] "Get Started"
      └── [section] Features (3 columns)
  → Composes full prompt with context + user instruction
  → Injects into Claude Code terminal via writeToActivePty()
```

## Component Design

### 1. Command Palette (Cmd+P)

Floating modal centered near top of screen. Dark translucent backdrop.

- **Trigger:** Cmd+P keyboard shortcut OR clicking the Prompt button in sidebar
- **Input:** Auto-focused multiline text area, grows up to ~6 lines
- **Quick chips:** Row of @-mention type shortcuts below input (@page, @section, @class, @color, @component, @media)
- **Recent prompts:** Last 5 shown as clickable summaries below chips
- **Submit:** Cmd+Enter sends; shows context preview before injection
- **Close:** Escape or backdrop click

**@-mention autocomplete:** Typing `@` shows a type picker dropdown. After selecting type, inline search with live API results. Selected items appear as styled pills with × to remove.

**Context preview:** Expandable section showing what data will be attached — referenced pages with element counts, classes, token estimate. "Copy to Clipboard" button alongside "Send" for users who want to paste into Claude Code themselves.

**No-session guard:** If no Claude Code session is running, shows "Start Claude Code" one-click button that launches session then injects prompt.

**No-site guard:** If no site is configured, palette shows inline config form (URL + API key + Test & Connect) instead of normal prompt input.

### 2. Prompt Workshop (Upgraded Bricks Tab)

Replaces the current Bricks tab in the ContextPanel. Tab labeled "Prompts".

**Editor (top):** Same @-mention-enabled text area as palette, always visible, more spacious. Send (Cmd+Enter), Save as Preset, and Copy buttons below.

**Presets (middle, collapsible):** Built-in templates reworked as natural language prompt starters:

| Category | Presets |
|----------|---------|
| Build | Generate Section, Generate Full Page, Full Page Build |
| Edit | Modify Elements, Restyle Section, Convert HTML |
| Manage | Pull Page, Push Page, Snapshot, Rollback |
| Inspect | Inspect Page Structure, Search Elements, Check Styles |

Each preset: click to load into editor, fill @-mentions and variables, send. Custom presets created via "Save as Preset" flow.

**Context Inspector (bottom, collapsible):** Live preview of resolved references — pages with element counts, classes, token estimate. Expandable to show element tree summaries.

**Prompt History (toggle):** Past prompts with timestamps, one-click to re-run or load into editor.

### 3. @-Mention Resolution Engine

Shared hooks powering both surfaces.

**Reference types:**

| Type | API Call | Data in Prompt |
|------|----------|----------------|
| @page | search_pages → get_page_elements | Title, ID, element tree with section summaries |
| @section | get_page_elements → filter top-level | Section label, child types/counts, key settings |
| @element | search_elements | Element type, label, settings, parent context |
| @class | get_global_classes | Class name, CSS settings, framework tag |
| @color | get_site_styles | Color name, hex value, usage context |
| @variable | get_site_styles | Variable name, value, source |
| @component | get_components | Title, element tree summary |
| @media | get_media | Filename, URL, dimensions, mime type |

**Smart context trimming:** Element trees rendered as readable outlines, not raw JSON. Far more useful for Claude Code.

**Caching:** Resolved references cached in `resolvedContextAtom` keyed by type+ID. 5-minute TTL or manual refresh.

**Hook API:**
- `useMentionParser(text)` — returns parsed tokens with positions
- `useMentionSearch(type, query)` — debounced API search for autocomplete
- `useMentionResolver(mentions)` — resolves mentions to full context data
- `usePromptComposer(text, resolvedMentions)` — assembles final prompt string

### 4. Prompt-as-Universal-Interface

The prompt engine detects app actions via keyword/regex pattern matching:

| User Input | Detected Intent | Action |
|------------|----------------|--------|
| "Add a site called Production at mysite.com with key atb_xyz" | add-site | Creates site entry, tests, saves config |
| "Switch to staging" | switch-site | Matches by name, switches active site |
| "Change my API key to atb_new" | update-config | Updates key, re-tests |
| "Save this as 'Hero Builder'" | save-preset | Saves current prompt as named preset |
| "Set default tool to Codex" | update-setting | Updates tool preference |
| "Use dark mode" | theme | Switches theme |
| Everything else | site-action | Composes prompt → Claude Code |

App actions show results inline in the palette with Done/Undo buttons. Ambiguous inputs prompt the user to clarify.

### 5. Multi-Site Support

Config evolves from single site to site list:

```yaml
sites:
  - name: "Staging"
    url: "https://ts-staging.wavedepth.com"
    api_key: "atb_..."
  - name: "Production"
    url: "https://mysite.com"
    api_key: "atb_..."
active_site: 0
```

**Site switcher:** Dropdown in status bar showing active site. Click to switch, "Add Site" at bottom. Switching clears mention cache, re-verifies connection, updates pre-prompt.

**CLI sync:** Active site config writes to `~/.agent-to-bricks/config.yaml` so CLI always matches GUI.

### 6. Lightweight Onboarding

The 5-step wizard is replaced by contextual tooltip spotlights on first launch:

1. App opens directly into main UI (no gate)
2. Tooltip sequence highlights: sidebar tools, prompt button, Cmd+P hint, connection banner with inline config
3. "Next" / "Skip All" navigation. Progress dots.
4. Tool detection happens silently, populates sidebar

Stored as `onboarding_seen: true` in config.

### 7. Guided Learning & Prompt Refinement

**Prompt transparency:** Before injection, expandable "What Claude Code will receive" preview. Copy to Clipboard teaches users what composed prompts look like.

**Quality hints:** Real-time suggestions below input (pattern-matched, not AI):
- Vague language → suggest specifics
- Missing page reference → suggest @page
- No style guidance → suggest @section reference
- Good prompt → subtle green check, no nagging

**Post-action learn cards:** After prompt sent, card in workshop shows:
- CLI equivalent command
- Raw prompt equivalent (for use without GUI)
- Bricks concepts used (pull, push, ACSS classes, etc.)

**Progressive complexity:** Tracks prompt count, adjusts hint verbosity:
- Beginner (0-10): Full hints, preview expanded, learn cards shown
- Intermediate (10-50): Hints for vague prompts only, preview collapsed
- Advanced (50+): Hints off, learn cards on hover

Adjustable manually: "Show hints: Always / Sometimes / Never"

### 8. Session Bootstrap

**Pre-prompt injection:** When launching Claude Code, optionally injects site context:

```
You are working with a Bricks Builder WordPress site at {url}.
The bricks CLI is available. Use `bricks` commands to pull, push, generate, and modify page elements.
{framework info if detected}
```

Configurable in settings as `session_pre_prompt`.

## Keyboard Shortcuts & GUI Equivalents

| Shortcut | GUI Element | Action |
|----------|------------|--------|
| Cmd+P | Prompt button (top of sidebar, spark icon + "Prompt" label, ⌘P badge) | Toggle command palette |
| Cmd+Shift+P | Long-press/right-click prompt button → "Repeat Last" | Palette with last prompt |
| Cmd+K | Click workshop editor area | Focus workshop editor |
| Cmd+Enter | Send button | Send prompt |
| Cmd+B | Sidebar hamburger button | Toggle sidebar |
| Cmd+\ | Context panel toggle button | Toggle context panel |
| Cmd+N | "+" button in sessions area | New session |
| Escape | — | Close palette → focus terminal |
| Tab | — | Accept autocomplete in @-mention |
| @ | — | Trigger mention type picker |

## New Files

| File | Purpose |
|------|---------|
| `CommandPalette.tsx` | Cmd+P overlay with prompt input, chips, recents, app action handling |
| `PromptWorkshop.tsx` | Replaces BricksPanel — editor, presets, context inspector, history |
| `MentionInput.tsx` | Shared rich text input with @-mention parsing, pills, autocomplete |
| `MentionAutocomplete.tsx` | Dropdown for @ — type picker then search results |
| `ContextPreview.tsx` | Resolved reference tree with token count |
| `PromptHints.tsx` | Real-time suggestion bar below prompt inputs |
| `LearnCard.tsx` | Post-action card with CLI/raw prompt equivalents |
| `SiteSwitcher.tsx` | Status bar dropdown for multi-site |
| `OnboardingTooltips.tsx` | Spotlight tooltip sequence replacing wizard |
| `PresetList.tsx` | Template browser with categories |
| `PromptPaletteButton.tsx` | Visible button in sidebar that opens command palette |

## Modified Files

| File | Changes |
|------|---------|
| `AppShell.tsx` | Remove onboarding gate, add CommandPalette overlay, add OnboardingTooltips |
| `Sidebar.tsx` | Add prompt button at top, site switcher reference |
| `ContextPanel.tsx` | Rename "Bricks" tab to "Prompts", render PromptWorkshop |
| `StatusBar.tsx` | Add SiteSwitcher |
| `atoms/app.ts` | Add paletteOpenAtom, sitesAtom, activeSiteIndexAtom, experienceLevelAtom |
| `atoms/prompts.ts` | Rework into presets, add promptHistoryAtom, savedPromptsAtom |
| `hooks/useKeyboardShortcuts.ts` | Add Cmd+P, Cmd+K, Cmd+Shift+P |
| `lib.rs` | Add Tauri commands for all API endpoints |
| `index.css` | Palette overlay, tooltip spotlight, mention pill styles |

## Deleted Files

| File | Reason |
|------|--------|
| `OnboardingWizard.tsx` | Replaced by OnboardingTooltips |
| `BricksPanel.tsx` | Replaced by PromptWorkshop |
| Onboarding step components | Replaced by tooltip flow |

## Config Schema

```yaml
sites:
  - name: "Staging"
    url: "https://..."
    api_key: "atb_..."
active_site: 0
default_tool: "claude-code"
theme: "dark"
saved_prompts:
  - name: "Hero Builder"
    text: "Generate a hero section on @page with..."
    category: "build"
prompt_history:
  - text: "Edit the @page(Demo) hero..."
    timestamp: "2026-02-24T10:30:00Z"
experience_level: "beginner"
hint_preference: "auto"
session_pre_prompt: "You are working with..."
onboarding_seen: false
```

## New Tauri Backend Commands

All thin wrappers around existing plugin REST endpoints:

- `get_page_elements(site_url, api_key, page_id)` → GET /pages/{id}/elements
- `get_page_sections(site_url, api_key, page_id)` → GET /pages/{id}/elements (filtered)
- `search_elements(site_url, api_key, filters)` → GET /search/elements
- `get_global_classes(site_url, api_key, framework)` → GET /classes
- `get_site_styles(site_url, api_key)` → GET /styles + GET /variables
- `get_components(site_url, api_key)` → GET /components
- `get_media(site_url, api_key, search)` → GET /media
