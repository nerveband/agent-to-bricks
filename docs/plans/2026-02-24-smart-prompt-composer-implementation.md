# Smart Prompt Composer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Agent to Bricks GUI into an intelligent prompt composition tool with Cmd+P command palette, @-mention site references, multi-site support, lightweight onboarding, and guided learning.

**Architecture:** Two prompt surfaces (Command Palette overlay + Prompt Workshop tab) share a single mention resolution engine backed by Tauri→WordPress API calls. A lightweight intent classifier routes app commands internally vs. site prompts to Claude Code's terminal.

**Tech Stack:** React 18, Jotai (state), Tauri 2 (backend), Rust reqwest (HTTP), xterm.js (terminal), Phosphor Icons, TypeScript

**Design doc:** `docs/plans/2026-02-24-smart-prompt-composer-design.md`

---

### Task 1: Extend Tauri Backend — New API Commands

Add Rust commands that wrap the remaining WordPress REST endpoints. These are needed by the @-mention resolution engine.

**Files:**
- Modify: `gui/src-tauri/src/lib.rs`

**Step 1: Add new Rust structs and commands**

Add these structs and commands after the existing `search_pages` function (after line 134 of `lib.rs`):

```rust
#[derive(Serialize, Deserialize)]
struct ElementInfo {
    id: String,
    name: String,
    label: Option<String>,
    parent: Option<String>,
    children: Option<Vec<String>>,
    settings: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct PageElements {
    elements: Vec<ElementInfo>,
    count: u32,
    #[serde(rename = "contentHash")]
    content_hash: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct GlobalClass {
    id: serde_json::Value,
    name: String,
    settings: Option<serde_json::Value>,
    framework: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ComponentInfo {
    id: u64,
    title: String,
    #[serde(rename = "type")]
    component_type: Option<String>,
    status: Option<String>,
    #[serde(rename = "elementCount")]
    element_count: Option<u32>,
}

#[derive(Serialize, Deserialize)]
struct MediaItem {
    id: u64,
    title: String,
    url: String,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    filesize: Option<u64>,
}

#[derive(Serialize, Deserialize)]
struct SiteStyles {
    #[serde(rename = "themeStyles")]
    theme_styles: Option<Vec<serde_json::Value>>,
    #[serde(rename = "colorPalette")]
    color_palette: Option<Vec<serde_json::Value>>,
    #[serde(rename = "globalSettings")]
    global_settings: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct SiteVariables {
    variables: Option<Vec<serde_json::Value>>,
    #[serde(rename = "extractedFromCSS")]
    extracted_from_css: Option<Vec<serde_json::Value>>,
}

#[derive(Serialize, Deserialize)]
struct SearchResult {
    #[serde(rename = "postId")]
    post_id: u64,
    #[serde(rename = "postTitle")]
    post_title: String,
    #[serde(rename = "elementId")]
    element_id: String,
    #[serde(rename = "elementType")]
    element_type: String,
    #[serde(rename = "elementLabel")]
    element_label: Option<String>,
    settings: Option<serde_json::Value>,
}

/// Helper: build an authenticated GET request to the ATB API.
async fn atb_get<T: serde::de::DeserializeOwned>(
    site_url: &str,
    api_key: &str,
    path: &str,
) -> Result<T, String> {
    let url = format!("{}/wp-json/agent-bricks/v1{}", site_url.trim_end_matches('/'), path);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;
    let resp = client.get(&url).header("X-ATB-Key", api_key).send().await
        .map_err(|e| format!("Request failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Server responded with status {}", resp.status()));
    }
    resp.json::<T>().await.map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
async fn get_page_elements(
    site_url: String,
    api_key: String,
    page_id: u64,
) -> Result<PageElements, String> {
    atb_get(&site_url, &api_key, &format!("/pages/{}/elements", page_id)).await
}

#[tauri::command]
async fn search_elements(
    site_url: String,
    api_key: String,
    element_type: Option<String>,
    global_class: Option<String>,
    per_page: Option<u32>,
) -> Result<serde_json::Value, String> {
    let mut path = "/search/elements?".to_string();
    if let Some(t) = element_type { path.push_str(&format!("element_type={}&", urlencoding::encode(&t))); }
    if let Some(c) = global_class { path.push_str(&format!("global_class={}&", urlencoding::encode(&c))); }
    path.push_str(&format!("per_page={}", per_page.unwrap_or(50).min(100)));
    atb_get(&site_url, &api_key, &path).await
}

#[tauri::command]
async fn get_global_classes(
    site_url: String,
    api_key: String,
    framework: Option<String>,
) -> Result<serde_json::Value, String> {
    let path = match framework {
        Some(fw) => format!("/classes?framework={}", urlencoding::encode(&fw)),
        None => "/classes".to_string(),
    };
    atb_get(&site_url, &api_key, &path).await
}

#[tauri::command]
async fn get_site_styles(site_url: String, api_key: String) -> Result<SiteStyles, String> {
    atb_get(&site_url, &api_key, "/styles").await
}

#[tauri::command]
async fn get_site_variables(site_url: String, api_key: String) -> Result<SiteVariables, String> {
    atb_get(&site_url, &api_key, "/variables").await
}

#[tauri::command]
async fn get_components(site_url: String, api_key: String) -> Result<serde_json::Value, String> {
    atb_get(&site_url, &api_key, "/components").await
}

#[tauri::command]
async fn get_media(
    site_url: String,
    api_key: String,
    search: Option<String>,
) -> Result<serde_json::Value, String> {
    let path = match search {
        Some(q) => format!("/media?search={}", urlencoding::encode(&q)),
        None => "/media".to_string(),
    };
    atb_get(&site_url, &api_key, &path).await
}
```

**Step 2: Register all new commands in the handler**

Replace the `invoke_handler` block in `lib.rs` (lines 188-196):

```rust
        .invoke_handler(tauri::generate_handler![
            detect_tool,
            get_shell_env,
            search_pages,
            test_site_connection,
            get_page_elements,
            search_elements,
            get_global_classes,
            get_site_styles,
            get_site_variables,
            get_components,
            get_media,
            config::read_config,
            config::write_config,
            config::config_exists
        ])
```

**Step 3: Verify it compiles**

Run: `cd "gui/src-tauri" && cargo check`
Expected: Compiles with no errors

**Step 4: Commit**

```bash
git add gui/src-tauri/src/lib.rs
git commit -m "feat(gui): add Tauri commands for page elements, classes, styles, components, media"
```

---

### Task 2: State Management — Multi-Site, Prompts, Palette Atoms

Rework the atoms to support multi-site config, prompt history, saved presets, and palette state.

**Files:**
- Modify: `gui/src/atoms/app.ts`
- Rewrite: `gui/src/atoms/prompts.ts`

**Step 1: Update app.ts with multi-site and palette atoms**

Replace the full contents of `gui/src/atoms/app.ts`:

```typescript
import { atom } from "jotai";

export const sidebarOpenAtom = atom(true);
export const contextPanelOpenAtom = atom(true);
export const themeAtom = atom<"light" | "dark">("dark");
export const paletteOpenAtom = atom(false);

// Onboarding — lightweight tooltips instead of wizard gate
export const onboardingSeenAtom = atom(false);

// Multi-site support
export interface SiteEntry {
  name: string;
  site_url: string;
  api_key: string;
}

export const sitesAtom = atom<SiteEntry[]>([]);
export const activeSiteIndexAtom = atom(0);

// Derived: active site config (replaces old siteConfigAtom)
export const activeSiteAtom = atom((get) => {
  const sites = get(sitesAtom);
  const idx = get(activeSiteIndexAtom);
  return sites[idx] ?? null;
});

// Settings & help dialogs
export const settingsOpenAtom = atom(false);
export const helpOpenAtom = atom(false);

// Experience level for progressive hint disclosure
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export const experienceLevelAtom = atom<ExperienceLevel>("beginner");
export const hintPreferenceAtom = atom<"auto" | "always" | "never">("auto");

// Prompt count tracker (drives experience level in "auto" mode)
export const promptCountAtom = atom(0);

// Session pre-prompt (injected when launching Claude Code)
export const sessionPrePromptAtom = atom(
  "You are working with a Bricks Builder WordPress site. The bricks CLI is available. Use `bricks` commands to pull, push, generate, and modify page elements."
);
```

**Step 2: Rewrite prompts.ts with presets and history**

Replace the full contents of `gui/src/atoms/prompts.ts`:

```typescript
import { atom } from "jotai";

// --- Mention types ---
export type MentionType =
  | "page"
  | "section"
  | "element"
  | "class"
  | "color"
  | "variable"
  | "component"
  | "media";

export interface MentionToken {
  type: MentionType;
  query: string;
  displayName: string;
  resolvedId: string | number | null;
  resolvedData: unknown | null;
  startPos: number;
  endPos: number;
}

// --- Presets (replacing old templates) ---
export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: "build" | "edit" | "manage" | "inspect";
  builtin: boolean;
}

export const BUILTIN_PRESETS: PromptPreset[] = [
  // Build
  {
    id: "generate-section",
    name: "Generate Section",
    description: "AI-generate a new section from a text description",
    prompt:
      "Generate a new section on @page with this description: {description}. Pull existing page structure first, match the site's current styles, then push the changes.",
    category: "build",
    builtin: true,
  },
  {
    id: "generate-page",
    name: "Generate Full Page",
    description: "AI-generate an entire page layout",
    prompt:
      "Build a complete page on @page with these sections: {description}. Pull the current site styles first for consistency, generate all sections, then push.",
    category: "build",
    builtin: true,
  },
  {
    id: "full-page-build",
    name: "Full Page Build",
    description: "Multi-step: snapshot, pull, generate, push",
    prompt:
      "For @page: First create a snapshot backup, then pull current elements, generate new content based on: {description}. Push changes when done.",
    category: "build",
    builtin: true,
  },
  // Edit
  {
    id: "modify-elements",
    name: "Modify Elements",
    description: "Change existing elements on a page",
    prompt:
      "On @page, modify the existing elements: {description}. Pull current state first, make the changes, then push.",
    category: "edit",
    builtin: true,
  },
  {
    id: "restyle-section",
    name: "Restyle Section",
    description: "Update the styling of a section",
    prompt:
      "Restyle @section to: {description}. Reference existing site styles and ACSS classes where available.",
    category: "edit",
    builtin: true,
  },
  {
    id: "convert-html",
    name: "Convert HTML",
    description: "Transform HTML into Bricks elements",
    prompt:
      "Convert the HTML file at {filePath} into Bricks elements on @page using the bricks CLI convert command.",
    category: "edit",
    builtin: true,
  },
  // Manage
  {
    id: "pull-page",
    name: "Pull Page",
    description: "Download page elements from your site",
    prompt:
      "Pull all Bricks elements from @page using the bricks CLI. Save the output as JSON.",
    category: "manage",
    builtin: true,
  },
  {
    id: "push-page",
    name: "Push Page",
    description: "Upload local changes to your site",
    prompt:
      "Push the local Bricks element changes back to @page using the bricks CLI.",
    category: "manage",
    builtin: true,
  },
  {
    id: "snapshot-page",
    name: "Snapshot Page",
    description: "Backup current page state",
    prompt:
      "Create a snapshot backup of @page using the bricks CLI before making changes.",
    category: "manage",
    builtin: true,
  },
  {
    id: "rollback-page",
    name: "Rollback Page",
    description: "Restore page to a previous snapshot",
    prompt:
      "Restore @page to its most recent snapshot using the bricks CLI rollback command.",
    category: "manage",
    builtin: true,
  },
  // Inspect
  {
    id: "inspect-page",
    name: "Inspect Page",
    description: "View all elements on a page",
    prompt:
      "List and describe all Bricks elements on @page. Show the element tree structure with types and labels.",
    category: "inspect",
    builtin: true,
  },
  {
    id: "check-styles",
    name: "Check Styles",
    description: "View site styles, colors, and variables",
    prompt:
      "Show the current theme styles, color palette, and CSS variables for the connected site using the bricks CLI.",
    category: "inspect",
    builtin: true,
  },
];

export const customPresetsAtom = atom<PromptPreset[]>([]);

export const allPresetsAtom = atom((get) => [
  ...BUILTIN_PRESETS,
  ...get(customPresetsAtom),
]);

// --- Prompt History ---
export interface PromptHistoryEntry {
  text: string;
  composedText: string;
  timestamp: number;
  mentions: { type: MentionType; displayName: string }[];
}

export const promptHistoryAtom = atom<PromptHistoryEntry[]>([]);

// --- Resolved mention cache ---
export interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

export const mentionCacheAtom = atom<Record<string, CacheEntry>>({});

// Cache TTL: 5 minutes
export const CACHE_TTL_MS = 5 * 60 * 1000;
```

**Step 3: Verify TypeScript compiles**

Run: `cd gui && npx tsc --noEmit`
Expected: May show errors from components still referencing old atoms — that's expected, we'll fix them in later tasks.

**Step 4: Commit**

```bash
git add gui/src/atoms/app.ts gui/src/atoms/prompts.ts
git commit -m "feat(gui): rework atoms for multi-site, prompt presets, palette state"
```

---

### Task 3: @-Mention Resolution Engine — Core Hooks

Build the shared hooks that power mention parsing, search, resolution, and prompt composition.

**Files:**
- Create: `gui/src/hooks/useMentionParser.ts`
- Create: `gui/src/hooks/useMentionSearch.ts`
- Create: `gui/src/hooks/useMentionResolver.ts`
- Create: `gui/src/hooks/usePromptComposer.ts`
- Create: `gui/src/lib/contextFormatter.ts`

**Step 1: Create the mention parser hook**

Create `gui/src/hooks/useMentionParser.ts`:

```typescript
import { useMemo } from "react";
import type { MentionToken, MentionType } from "../atoms/prompts";

const MENTION_TYPES: MentionType[] = [
  "page", "section", "element", "class", "color", "variable", "component", "media",
];

const MENTION_REGEX = /@(page|section|element|class|color|variable|component|media)(?:\(([^)]*)\))?/g;

export interface ParsedPrompt {
  rawText: string;
  mentions: MentionToken[];
  textWithoutMentions: string;
}

export function parseMentions(text: string): ParsedPrompt {
  const mentions: MentionToken[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, "g");

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      type: match[1] as MentionType,
      query: match[2] ?? "",
      displayName: "",
      resolvedId: null,
      resolvedData: null,
      startPos: match.index,
      endPos: match.index + match[0].length,
    });
  }

  const textWithoutMentions = text.replace(regex, "").replace(/\s{2,}/g, " ").trim();

  return { rawText: text, mentions, textWithoutMentions };
}

export function useMentionParser(text: string): ParsedPrompt {
  return useMemo(() => parseMentions(text), [text]);
}

export { MENTION_TYPES };
```

**Step 2: Create the mention search hook**

Create `gui/src/hooks/useMentionSearch.ts`:

```typescript
import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { activeSiteAtom } from "../atoms/app";
import type { MentionType } from "../atoms/prompts";

export interface SearchResult {
  id: string | number;
  label: string;
  sublabel?: string;
  data?: unknown;
}

export function useMentionSearch(type: MentionType | null, query: string) {
  const site = useAtomValue(activeSiteAtom);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!type || !site) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);

    if (!query && !["color", "variable"].includes(type)) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await fetchByType(type, query, site.site_url, site.api_key);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [type, query, site]);

  return { results, loading };
}

async function fetchByType(
  type: MentionType,
  query: string,
  siteUrl: string,
  apiKey: string
): Promise<SearchResult[]> {
  switch (type) {
    case "page":
    case "section": {
      const pages = await invoke<{ id: number; title: string; slug: string }[]>(
        "search_pages",
        { siteUrl, apiKey, query, perPage: 10 }
      );
      return pages.map((p) => ({
        id: p.id,
        label: p.title,
        sublabel: `/${p.slug}`,
        data: p,
      }));
    }
    case "element": {
      const resp = await invoke<{ results: { elementId: string; elementType: string; elementLabel: string; postTitle: string }[] }>(
        "search_elements",
        { siteUrl, apiKey, elementType: query || undefined, perPage: 10 }
      );
      return (resp.results ?? []).map((e) => ({
        id: e.elementId,
        label: e.elementLabel || e.elementType,
        sublabel: e.postTitle,
        data: e,
      }));
    }
    case "class": {
      const resp = await invoke<{ classes: { id: number; name: string; framework: string }[] }>(
        "get_global_classes",
        { siteUrl, apiKey, framework: null }
      );
      const classes = resp.classes ?? [];
      const filtered = query
        ? classes.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
        : classes;
      return filtered.slice(0, 20).map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: c.framework ?? "custom",
        data: c,
      }));
    }
    case "color": {
      const resp = await invoke<{ colorPalette: { color: string; slug: string }[] }>(
        "get_site_styles",
        { siteUrl, apiKey }
      );
      const colors = resp.colorPalette ?? [];
      return colors.map((c) => ({
        id: c.slug,
        label: c.slug,
        sublabel: c.color,
        data: c,
      }));
    }
    case "variable": {
      const resp = await invoke<{ variables: { name: string; value: string }[] }>(
        "get_site_variables",
        { siteUrl, apiKey }
      );
      const vars = resp.variables ?? [];
      const filtered = query
        ? vars.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
        : vars;
      return filtered.slice(0, 20).map((v) => ({
        id: v.name,
        label: v.name,
        sublabel: v.value,
        data: v,
      }));
    }
    case "component": {
      const resp = await invoke<{ components: { id: number; title: string; elementCount: number }[] }>(
        "get_components",
        { siteUrl, apiKey }
      );
      return (resp.components ?? []).map((c) => ({
        id: c.id,
        label: c.title,
        sublabel: `${c.elementCount ?? 0} elements`,
        data: c,
      }));
    }
    case "media": {
      const resp = await invoke<{ media: { id: number; title: string; url: string; mimeType: string }[] }>(
        "get_media",
        { siteUrl, apiKey, search: query || null }
      );
      return (resp.media ?? []).map((m) => ({
        id: m.id,
        label: m.title,
        sublabel: m.mimeType,
        data: m,
      }));
    }
    default:
      return [];
  }
}
```

**Step 3: Create the context formatter**

Create `gui/src/lib/contextFormatter.ts`:

```typescript
/**
 * Transforms raw API element data into LLM-friendly readable outlines.
 */

interface Element {
  id: string;
  name: string;
  label?: string;
  parent?: string;
  children?: string[];
  settings?: Record<string, unknown>;
}

export function formatElementTree(
  elements: Element[],
  pageTitle: string,
  pageId: number | string
): string {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const roots = elements.filter((e) => !e.parent || e.parent === "0");

  const lines: string[] = [`Page "${pageTitle}" (ID: ${pageId}):`];

  function walk(el: Element, prefix: string, isLast: boolean) {
    const connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
    const label = el.label || el.name;
    const settingsSummary = summarizeSettings(el);
    lines.push(`${prefix}${connector}[${el.name}] ${label}${settingsSummary}`);

    const childPrefix = prefix + (isLast ? "    " : "\u2502   ");
    const childIds = el.children ?? [];
    childIds.forEach((cid, i) => {
      const child = byId.get(cid);
      if (child) walk(child, childPrefix, i === childIds.length - 1);
    });
  }

  roots.forEach((r, i) => walk(r, "", i === roots.length - 1));
  return lines.join("\n");
}

function summarizeSettings(el: Element): string {
  if (!el.settings) return "";
  const s = el.settings;
  const parts: string[] = [];
  if (s.tag && s.tag !== "div") parts.push(`<${s.tag}>`);
  if (typeof s.text === "string" && s.text.length > 0) {
    parts.push(`"${s.text.slice(0, 50)}${s.text.length > 50 ? "..." : ""}"`);
  }
  if (s.link?.url) parts.push(`-> ${s.link.url}`);
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

export function formatClassInfo(cls: { name: string; framework?: string; settings?: unknown }): string {
  return `.${cls.name}${cls.framework ? ` (${cls.framework})` : ""}`;
}

export function formatComponentSummary(comp: { title: string; elementCount?: number }): string {
  return `Component "${comp.title}" (${comp.elementCount ?? "?"} elements)`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

**Step 4: Create the mention resolver hook**

Create `gui/src/hooks/useMentionResolver.ts`:

```typescript
import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { activeSiteAtom } from "../atoms/app";
import { mentionCacheAtom, CACHE_TTL_MS } from "../atoms/prompts";
import type { MentionToken } from "../atoms/prompts";
import { formatElementTree } from "../lib/contextFormatter";

export function useMentionResolver() {
  const site = useAtomValue(activeSiteAtom);
  const cache = useAtomValue(mentionCacheAtom);
  const setCache = useSetAtom(mentionCacheAtom);

  const resolve = useCallback(
    async (mention: MentionToken): Promise<string> => {
      if (!site || !mention.resolvedId) return "";

      const cacheKey = `${mention.type}:${mention.resolvedId}`;
      const cached = cache[cacheKey];
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.data as string;
      }

      let formatted = "";

      try {
        switch (mention.type) {
          case "page":
          case "section": {
            const resp = await invoke<{ elements: Array<{ id: string; name: string; label?: string; parent?: string; children?: string[]; settings?: Record<string, unknown> }> }>(
              "get_page_elements",
              { siteUrl: site.site_url, apiKey: site.api_key, pageId: Number(mention.resolvedId) }
            );
            formatted = formatElementTree(
              resp.elements,
              mention.displayName,
              mention.resolvedId
            );
            if (mention.type === "section") {
              // Filter to top-level sections only
              const lines = formatted.split("\n");
              const sectionLines = lines.filter(
                (l) => l.includes("[section]") || l.startsWith("Page ")
              );
              formatted = sectionLines.join("\n");
            }
            break;
          }
          case "class": {
            formatted = `Global class: .${mention.displayName}`;
            break;
          }
          case "color": {
            const data = mention.resolvedData as { color?: string } | null;
            formatted = `Color: ${mention.displayName} (${data?.color ?? "unknown"})`;
            break;
          }
          case "variable": {
            const data = mention.resolvedData as { value?: string } | null;
            formatted = `CSS Variable: ${mention.displayName}: ${data?.value ?? "unknown"}`;
            break;
          }
          case "component": {
            formatted = `Reusable component: "${mention.displayName}"`;
            break;
          }
          case "media": {
            const data = mention.resolvedData as { url?: string; mimeType?: string } | null;
            formatted = `Media: ${mention.displayName} (${data?.mimeType ?? "file"}) ${data?.url ?? ""}`;
            break;
          }
          default: {
            formatted = `${mention.type}: ${mention.displayName}`;
          }
        }
      } catch (err) {
        formatted = `[Failed to load ${mention.type}: ${mention.displayName}]`;
      }

      setCache((prev) => ({
        ...prev,
        [cacheKey]: { data: formatted, fetchedAt: Date.now() },
      }));

      return formatted;
    },
    [site, cache, setCache]
  );

  return { resolve };
}
```

**Step 5: Create the prompt composer hook**

Create `gui/src/hooks/usePromptComposer.ts`:

```typescript
import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { activeSiteAtom, sessionPrePromptAtom } from "../atoms/app";
import type { MentionToken } from "../atoms/prompts";
import { estimateTokens } from "../lib/contextFormatter";

export interface ComposedPrompt {
  fullText: string;
  contextBlock: string;
  instruction: string;
  tokenEstimate: number;
}

export function usePromptComposer() {
  const site = useAtomValue(activeSiteAtom);
  const prePrompt = useAtomValue(sessionPrePromptAtom);

  const compose = useCallback(
    (rawText: string, resolvedContexts: Map<string, string>): ComposedPrompt => {
      const contextParts: string[] = [];

      if (site) {
        contextParts.push(
          `Site: ${site.site_url} | ${site.name}`
        );
      }

      // Build context block from resolved mentions
      for (const [_key, context] of resolvedContexts) {
        if (context) contextParts.push(context);
      }

      const contextBlock = contextParts.length > 0
        ? contextParts.join("\n\n")
        : "";

      // Clean up raw text: remove @type(query) tokens, leave the display names
      const instruction = rawText
        .replace(/@(page|section|element|class|color|variable|component|media)\([^)]*\)/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      const fullParts: string[] = [];
      if (contextBlock) fullParts.push(contextBlock);
      if (instruction) fullParts.push(`Instruction: ${instruction}`);

      const fullText = fullParts.join("\n\n");

      return {
        fullText,
        contextBlock,
        instruction,
        tokenEstimate: estimateTokens(fullText),
      };
    },
    [site, prePrompt]
  );

  return { compose };
}
```

**Step 6: Commit**

```bash
git add gui/src/hooks/useMentionParser.ts gui/src/hooks/useMentionSearch.ts gui/src/hooks/useMentionResolver.ts gui/src/hooks/usePromptComposer.ts gui/src/lib/contextFormatter.ts
git commit -m "feat(gui): add @-mention resolution engine — parser, search, resolver, composer"
```

---

### Task 4: Intent Classifier — Detect App Actions vs Site Prompts

Build the pattern matcher that routes "add a site..." to internal handlers vs. site prompts to Claude Code.

**Files:**
- Create: `gui/src/lib/intentClassifier.ts`

**Step 1: Create the intent classifier**

Create `gui/src/lib/intentClassifier.ts`:

```typescript
export type AppIntent =
  | { type: "add-site"; name?: string; url?: string; apiKey?: string }
  | { type: "switch-site"; name: string }
  | { type: "update-config"; field: string; value: string }
  | { type: "save-preset"; name: string }
  | { type: "update-setting"; key: string; value: string }
  | { type: "theme"; value: "dark" | "light" }
  | { type: "show-history" }
  | { type: "site-action" };

const patterns: Array<{ regex: RegExp; extract: (m: RegExpMatchArray, text: string) => AppIntent }> = [
  {
    regex: /^(?:add|new|connect)\s+(?:a\s+)?site\b/i,
    extract: (_m, text) => {
      const nameMatch = text.match(/(?:called|named)\s+"?([^"]+?)"?\s+(?:at|url)/i);
      const urlMatch = text.match(/(?:at|url)\s+(https?:\/\/\S+)/i);
      const keyMatch = text.match(/(?:key|api[_-]?key)\s+(\S+)/i);
      return {
        type: "add-site",
        name: nameMatch?.[1]?.trim(),
        url: urlMatch?.[1]?.trim(),
        apiKey: keyMatch?.[1]?.trim(),
      };
    },
  },
  {
    regex: /^(?:switch|change|use)\s+(?:to\s+)?(?:the\s+)?(?:site\s+)?["']?(.+?)["']?\s*(?:site)?$/i,
    extract: (m) => ({ type: "switch-site", name: m[1].trim() }),
  },
  {
    regex: /(?:change|update|set)\s+(?:my\s+)?api[_\s-]?key\s+(?:to\s+)?(\S+)/i,
    extract: (m) => ({ type: "update-config", field: "api_key", value: m[1] }),
  },
  {
    regex: /save\s+(?:this\s+)?(?:as\s+)?(?:a\s+)?(?:preset|template)\s*(?:called|named)?\s*["']?(.+?)["']?$/i,
    extract: (m) => ({ type: "save-preset", name: m[1].trim() }),
  },
  {
    regex: /(?:set|change)\s+(?:default\s+)?tool\s+(?:to\s+)?(\w+)/i,
    extract: (m) => ({ type: "update-setting", key: "default_tool", value: m[1] }),
  },
  {
    regex: /(?:use|switch\s+to|enable)\s+(dark|light)\s*(?:mode|theme)?/i,
    extract: (m) => ({ type: "theme", value: m[1].toLowerCase() as "dark" | "light" }),
  },
  {
    regex: /(?:show|view|open)\s+(?:my\s+)?(?:prompt\s+)?history/i,
    extract: () => ({ type: "show-history" }),
  },
];

export function classifyIntent(text: string): AppIntent {
  const trimmed = text.trim();
  for (const { regex, extract } of patterns) {
    const match = trimmed.match(regex);
    if (match) return extract(match, trimmed);
  }
  return { type: "site-action" };
}
```

**Step 2: Commit**

```bash
git add gui/src/lib/intentClassifier.ts
git commit -m "feat(gui): add intent classifier for app actions vs site prompts"
```

---

### Task 5: MentionInput Component — Rich Text with @-Mentions

Build the shared input component used by both Command Palette and Prompt Workshop.

**Files:**
- Create: `gui/src/components/prompt/MentionInput.tsx`
- Create: `gui/src/components/prompt/MentionAutocomplete.tsx`
- Create: `gui/src/components/prompt/MentionPill.tsx`

**Step 1: Create MentionPill**

Create `gui/src/components/prompt/MentionPill.tsx`:

```tsx
interface MentionPillProps {
  type: string;
  label: string;
  onRemove: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  page: "#4a9eff",
  section: "#a78bfa",
  element: "#34d399",
  class: "#f59e0b",
  color: "#f472b6",
  variable: "#22d3ee",
  component: "#fb923c",
  media: "#a3e635",
};

export function MentionPill({ type, label, onRemove }: MentionPillProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-mono"
      style={{
        background: `${TYPE_COLORS[type] ?? "var(--fg-muted)"}20`,
        border: `1px solid ${TYPE_COLORS[type] ?? "var(--fg-muted)"}40`,
        color: TYPE_COLORS[type] ?? "var(--fg-muted)",
      }}
    >
      <span className="opacity-60">@{type}</span>
      <span className="font-sans font-medium" style={{ color: "var(--fg)" }}>
        {label}
      </span>
      <button
        onClick={onRemove}
        className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}
```

**Step 2: Create MentionAutocomplete**

Create `gui/src/components/prompt/MentionAutocomplete.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { MENTION_TYPES } from "../../hooks/useMentionParser";
import type { SearchResult } from "../../hooks/useMentionSearch";
import type { MentionType } from "../../atoms/prompts";

const TYPE_LABELS: Record<string, string> = {
  page: "Pages",
  section: "Sections",
  element: "Elements",
  class: "Global Classes",
  color: "Colors",
  variable: "CSS Variables",
  component: "Components",
  media: "Media",
};

interface MentionAutocompleteProps {
  mode: "type-picker" | "search";
  mentionType: MentionType | null;
  results: SearchResult[];
  loading: boolean;
  selectedIndex: number;
  onSelectType: (type: MentionType) => void;
  onSelectResult: (result: SearchResult) => void;
  position: { top: number; left: number };
}

export function MentionAutocomplete({
  mode,
  mentionType,
  results,
  loading,
  selectedIndex,
  onSelectType,
  onSelectResult,
  position,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector("[data-active]");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      className="absolute z-50 rounded-lg border overflow-hidden shadow-xl"
      style={{
        top: position.top,
        left: position.left,
        background: "var(--surface)",
        borderColor: "var(--border)",
        minWidth: 220,
        maxHeight: 260,
        overflowY: "auto",
      }}
    >
      {mode === "type-picker" ? (
        <div className="p-1">
          <div
            className="px-2 py-1 text-[11px] uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Reference type
          </div>
          {MENTION_TYPES.map((t, i) => (
            <button
              key={t}
              data-active={i === selectedIndex ? "" : undefined}
              className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors flex items-center gap-2"
              style={{
                background: i === selectedIndex ? "var(--border)" : undefined,
                color: "var(--fg)",
              }}
              onClick={() => onSelectType(t)}
            >
              <span className="text-[11px] font-mono opacity-60">@</span>
              <span>{TYPE_LABELS[t] ?? t}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-1">
          {mentionType && (
            <div
              className="px-2 py-1 text-[11px] uppercase tracking-wider"
              style={{ color: "var(--fg-muted)" }}
            >
              {TYPE_LABELS[mentionType] ?? mentionType}
            </div>
          )}
          {loading && (
            <div className="px-2 py-3 text-[13px]" style={{ color: "var(--fg-muted)" }}>
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-2 py-3 text-[13px]" style={{ color: "var(--fg-muted)" }}>
              No results found
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.id}`}
              data-active={i === selectedIndex ? "" : undefined}
              className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors"
              style={{
                background: i === selectedIndex ? "var(--border)" : undefined,
                color: "var(--fg)",
              }}
              onClick={() => onSelectResult(r)}
            >
              <div className="truncate">{r.label}</div>
              {r.sublabel && (
                <div className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
                  {r.sublabel}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create MentionInput**

Create `gui/src/components/prompt/MentionInput.tsx`:

```tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { MentionPill } from "./MentionPill";
import { useMentionSearch, type SearchResult } from "../../hooks/useMentionSearch";
import type { MentionType, MentionToken } from "../../atoms/prompts";

interface ResolvedMention {
  type: MentionType;
  id: string | number;
  label: string;
  data?: unknown;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  mentions: ResolvedMention[];
  onMentionAdd: (mention: ResolvedMention) => void;
  onMentionRemove: (index: number) => void;
  placeholder?: string;
  maxRows?: number;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

export function MentionInput({
  value,
  onChange,
  mentions,
  onMentionAdd,
  onMentionRemove,
  placeholder = "Describe what you want to build... (@ to reference site objects)",
  maxRows = 6,
  autoFocus = false,
  onSubmit,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteMode, setAutocompleteMode] = useState<"type-picker" | "search">("type-picker");
  const [selectedType, setSelectedType] = useState<MentionType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });

  const { results, loading } = useMentionSearch(selectedType, searchQuery);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      onChange(val);

      // Detect @ at cursor position
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        const rect = e.target.getBoundingClientRect();
        setAutocompletePos({ top: rect.height + 4, left: 0 });
        setShowAutocomplete(true);
        setSelectedIndex(0);

        const typed = atMatch[1].toLowerCase();
        const typeMatch = [
          "page", "section", "element", "class", "color", "variable", "component", "media",
        ].find((t) => t.startsWith(typed));

        if (typed.length === 0) {
          setAutocompleteMode("type-picker");
          setSelectedType(null);
        } else if (typeMatch && typed.length >= 2) {
          setAutocompleteMode("search");
          setSelectedType(typeMatch as MentionType);
          setSearchQuery("");
        }
      } else if (showAutocomplete && autocompleteMode === "search") {
        // If we're in search mode, update the search query
        const lastAt = textBeforeCursor.lastIndexOf("@");
        if (lastAt >= 0) {
          const afterType = textBeforeCursor.slice(lastAt).match(/@\w+\s+(.*)$/);
          if (afterType) {
            setSearchQuery(afterType[1]);
          }
        }
      } else {
        setShowAutocomplete(false);
      }
    },
    [onChange, showAutocomplete, autocompleteMode]
  );

  const handleTypeSelect = useCallback((type: MentionType) => {
    setSelectedType(type);
    setAutocompleteMode("search");
    setSearchQuery("");
    setSelectedIndex(0);
    // Replace the @partial in the text with @type
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      const before = value.slice(0, pos);
      const atIdx = before.lastIndexOf("@");
      const newVal = value.slice(0, atIdx) + `@${type} ` + value.slice(pos);
      onChange(newVal);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newPos = atIdx + type.length + 2;
          textareaRef.current.selectionStart = newPos;
          textareaRef.current.selectionEnd = newPos;
          textareaRef.current.focus();
        }
      });
    }
  }, [value, onChange]);

  const handleResultSelect = useCallback((result: SearchResult) => {
    if (selectedType) {
      onMentionAdd({
        type: selectedType,
        id: result.id,
        label: result.label,
        data: result.data,
      });
      // Remove the @type query text from the input
      if (textareaRef.current) {
        const pos = textareaRef.current.selectionStart;
        const before = value.slice(0, pos);
        const atIdx = before.lastIndexOf("@");
        const newVal = value.slice(0, atIdx) + value.slice(pos);
        onChange(newVal.trimEnd() + " ");
      }
    }
    setShowAutocomplete(false);
    setSelectedType(null);
    setSearchQuery("");
    textareaRef.current?.focus();
  }, [selectedType, value, onChange, onMentionAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showAutocomplete) {
        const itemCount = autocompleteMode === "type-picker" ? 8 : results.length;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % Math.max(itemCount, 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1));
        } else if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          if (autocompleteMode === "type-picker") {
            const types: MentionType[] = ["page", "section", "element", "class", "color", "variable", "component", "media"];
            handleTypeSelect(types[selectedIndex]);
          } else if (results[selectedIndex]) {
            handleResultSelect(results[selectedIndex]);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setShowAutocomplete(false);
        }
        return;
      }

      // Cmd+Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
      }
    },
    [showAutocomplete, autocompleteMode, results, selectedIndex, handleTypeSelect, handleResultSelect, onSubmit]
  );

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const lineHeight = 22;
    ta.style.height = `${Math.min(ta.scrollHeight, lineHeight * maxRows)}px`;
  }, [value, maxRows]);

  return (
    <div className="relative">
      {/* Mention pills */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {mentions.map((m, i) => (
            <MentionPill
              key={`${m.type}-${m.id}`}
              type={m.type}
              label={m.label}
              onRemove={() => onMentionRemove(i)}
            />
          ))}
        </div>
      )}

      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={1}
        className="w-full resize-none rounded-lg px-3 py-2 text-[14px] outline-none transition-colors"
        style={{
          background: "var(--bg)",
          color: "var(--fg)",
          border: "1px solid var(--border)",
          fontFamily: "var(--font-sans, inherit)",
          lineHeight: "22px",
        }}
      />

      {/* Autocomplete dropdown */}
      {showAutocomplete && (
        <MentionAutocomplete
          mode={autocompleteMode}
          mentionType={selectedType}
          results={results}
          loading={loading}
          selectedIndex={selectedIndex}
          onSelectType={handleTypeSelect}
          onSelectResult={handleResultSelect}
          position={autocompletePos}
        />
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add gui/src/components/prompt/
git commit -m "feat(gui): add MentionInput, MentionAutocomplete, MentionPill components"
```

---

### Task 6: Context Preview Component

Shows resolved reference data and token estimate before prompt injection.

**Files:**
- Create: `gui/src/components/prompt/ContextPreview.tsx`

**Step 1: Create ContextPreview**

Create `gui/src/components/prompt/ContextPreview.tsx`:

```tsx
import { useState } from "react";
import { CaretDown, CaretRight, Copy, Check } from "@phosphor-icons/react";
import { estimateTokens } from "../../lib/contextFormatter";

interface ContextPreviewProps {
  contextBlock: string;
  mentions: Array<{ type: string; label: string; context?: string }>;
  defaultExpanded?: boolean;
}

export function ContextPreview({
  contextBlock,
  mentions,
  defaultExpanded = false,
}: ContextPreviewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const tokens = estimateTokens(contextBlock);

  if (mentions.length === 0) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(contextBlock);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-lg border text-[13px]"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ color: "var(--fg-muted)" }}
      >
        {expanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
        <span className="flex-1">
          Context: {mentions.length} reference{mentions.length !== 1 ? "s" : ""} (~{tokens} tokens)
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="mt-2 space-y-1">
            {mentions.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-mono opacity-50">@{m.type}</span>
                <span style={{ color: "var(--fg)" }}>{m.label}</span>
              </div>
            ))}
          </div>

          {contextBlock && (
            <pre
              className="mt-2 p-2 rounded text-[12px] overflow-x-auto whitespace-pre-wrap font-mono"
              style={{
                background: "var(--surface)",
                color: "var(--fg-muted)",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {contextBlock}
            </pre>
          )}

          <button
            onClick={handleCopy}
            className="mt-2 flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
            style={{ color: "var(--fg-muted)", background: "var(--surface)" }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy full context"}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add gui/src/components/prompt/ContextPreview.tsx
git commit -m "feat(gui): add ContextPreview component with token estimate"
```

---

### Task 7: Prompt Hints Component

Real-time suggestion bar that detects vague prompts and missing references.

**Files:**
- Create: `gui/src/components/prompt/PromptHints.tsx`

**Step 1: Create PromptHints**

Create `gui/src/components/prompt/PromptHints.tsx`:

```tsx
import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { experienceLevelAtom, hintPreferenceAtom, promptCountAtom } from "../../atoms/app";
import { Lightbulb, CheckCircle } from "@phosphor-icons/react";

interface PromptHintsProps {
  text: string;
  mentionCount: number;
}

interface Hint {
  message: string;
  priority: number;
}

const VAGUE_PATTERNS: Array<{ regex: RegExp; hint: string }> = [
  { regex: /\bmake it (?:better|nicer|good|modern|clean)\b/i, hint: "Try describing specifics — colors, layout, typography, spacing" },
  { regex: /\bimprove\b/i, hint: "What should improve? Visual design, performance, content, structure?" },
  { regex: /\bfix it\b/i, hint: "Describe what's broken — spacing off, wrong color, missing element?" },
  { regex: /\bupdate\b(?!.*(?:section|heading|button|text|image|hero|footer|nav))/i, hint: "Update what specifically? Try naming the section or element type" },
  { regex: /\bchange\b(?!.*(?:to|from|color|font|size|width))/i, hint: "Change to what? Add the target value — color, size, text, etc." },
];

export function PromptHints({ text, mentionCount }: PromptHintsProps) {
  const experience = useAtomValue(experienceLevelAtom);
  const hintPref = useAtomValue(hintPreferenceAtom);
  const promptCount = useAtomValue(promptCountAtom);

  const shouldShow = useMemo(() => {
    if (hintPref === "never") return false;
    if (hintPref === "always") return true;
    // Auto mode: based on experience
    if (experience === "advanced" || promptCount > 50) return false;
    if (experience === "intermediate" || promptCount > 10) return text.length > 5; // only for non-trivial input
    return true;
  }, [hintPref, experience, promptCount, text]);

  const hints = useMemo((): Hint[] => {
    if (!text.trim() || !shouldShow) return [];
    const found: Hint[] = [];

    // Check for vague language
    for (const { regex, hint } of VAGUE_PATTERNS) {
      if (regex.test(text)) {
        found.push({ message: hint, priority: 2 });
      }
    }

    // Missing page reference
    if (
      text.length > 15 &&
      mentionCount === 0 &&
      /\b(?:page|section|hero|footer|header|nav|form|card)\b/i.test(text) &&
      !/@page/.test(text)
    ) {
      found.push({ message: "Which page? Type @ to reference a specific page", priority: 1 });
    }

    return found.sort((a, b) => a.priority - b.priority).slice(0, 1);
  }, [text, mentionCount, shouldShow]);

  if (!text.trim() || !shouldShow) return null;

  // Good prompt indicator
  if (hints.length === 0 && text.length > 20 && mentionCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-1 py-1 text-[12px]" style={{ color: "#34d399" }}>
        <CheckCircle size={14} weight="fill" />
        <span>Good prompt</span>
      </div>
    );
  }

  if (hints.length === 0) return null;

  return (
    <div className="flex items-start gap-1.5 px-1 py-1 text-[12px]" style={{ color: "var(--fg-muted)" }}>
      <Lightbulb size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
      <span>{hints[0].message}</span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add gui/src/components/prompt/PromptHints.tsx
git commit -m "feat(gui): add PromptHints component with vague language detection"
```

---

### Task 8: Command Palette

The main Cmd+P overlay with prompt input, quick chips, recent prompts, app action handling, and context preview.

**Files:**
- Create: `gui/src/components/CommandPalette.tsx`

**Step 1: Create CommandPalette**

Create `gui/src/components/CommandPalette.tsx`:

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  paletteOpenAtom,
  activeSiteAtom,
  sitesAtom,
  activeSiteIndexAtom,
  promptCountAtom,
  themeAtom,
} from "../atoms/app";
import {
  promptHistoryAtom,
  type MentionType,
  type PromptHistoryEntry,
} from "../atoms/prompts";
import { activeSessionAtom } from "../atoms/sessions";
import { useSessionLauncher } from "../hooks/useSessionLauncher";
import { toolsAtom } from "../atoms/tools";
import { MentionInput } from "./prompt/MentionInput";
import { ContextPreview } from "./prompt/ContextPreview";
import { PromptHints } from "./prompt/PromptHints";
import { useMentionResolver } from "../hooks/useMentionResolver";
import { usePromptComposer } from "../hooks/usePromptComposer";
import { classifyIntent } from "../lib/intentClassifier";
import { writeToActivePty } from "../atoms/ptyBridge";
import { invoke } from "@tauri-apps/api/core";
import {
  PaperPlaneRight,
  Lightning,
  ClockCounterClockwise,
  Copy,
  Check,
  X,
} from "@phosphor-icons/react";

interface ResolvedMention {
  type: MentionType;
  id: string | number;
  label: string;
  data?: unknown;
}

export function CommandPalette() {
  const [open, setOpen] = useAtom(paletteOpenAtom);
  const site = useAtomValue(activeSiteAtom);
  const session = useAtomValue(activeSessionAtom);
  const [sites, setSites] = useAtom(sitesAtom);
  const setActiveSiteIdx = useSetAtom(activeSiteIndexAtom);
  const [history, setHistory] = useAtom(promptHistoryAtom);
  const setPromptCount = useSetAtom(promptCountAtom);
  const setTheme = useSetAtom(themeAtom);
  const tools = useAtomValue(toolsAtom);
  const { launch } = useSessionLauncher();
  const { resolve } = useMentionResolver();
  const { compose } = usePromptComposer();

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ResolvedMention[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [resolvedContexts, setResolvedContexts] = useState<Map<string, string>>(new Map());
  const [appActionResult, setAppActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRecent, setShowRecent] = useState(true);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Quick-insert mention type chips
  const quickChips: { type: MentionType; label: string }[] = [
    { type: "page", label: "@page" },
    { type: "section", label: "@section" },
    { type: "class", label: "@class" },
    { type: "color", label: "@color" },
    { type: "component", label: "@component" },
    { type: "media", label: "@media" },
  ];

  const handleClose = useCallback(() => {
    setOpen(false);
    setText("");
    setMentions([]);
    setShowPreview(false);
    setResolvedContexts(new Map());
    setAppActionResult(null);
  }, [setOpen]);

  const handleMentionAdd = useCallback((m: ResolvedMention) => {
    setMentions((prev) => [...prev, m]);
    setShowRecent(false);
  }, []);

  const handleMentionRemove = useCallback((index: number) => {
    setMentions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleChipClick = useCallback((type: MentionType) => {
    setText((prev) => prev + `@${type} `);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() && mentions.length === 0) return;

    // Check for app actions first
    const intent = classifyIntent(text);

    if (intent.type !== "site-action") {
      // Handle app action
      let result = { success: false, message: "" };

      switch (intent.type) {
        case "add-site": {
          const entry = {
            name: intent.name || "New Site",
            site_url: intent.url || "",
            api_key: intent.apiKey || "",
          };
          if (entry.site_url) {
            setSites((prev) => [...prev, entry]);
            setActiveSiteIdx(sites.length);
            result = { success: true, message: `Site "${entry.name}" added` };
          } else {
            result = { success: false, message: "Please include a URL (e.g., 'at https://mysite.com')" };
          }
          break;
        }
        case "switch-site": {
          const idx = sites.findIndex(
            (s) => s.name.toLowerCase().includes(intent.name.toLowerCase())
          );
          if (idx >= 0) {
            setActiveSiteIdx(idx);
            result = { success: true, message: `Switched to "${sites[idx].name}"` };
          } else {
            result = { success: false, message: `No site matching "${intent.name}"` };
          }
          break;
        }
        case "theme": {
          setTheme(intent.value);
          result = { success: true, message: `Switched to ${intent.value} mode` };
          break;
        }
        case "save-preset": {
          result = { success: true, message: `Preset "${intent.name}" saved` };
          break;
        }
        default:
          result = { success: true, message: "Done" };
      }

      setAppActionResult(result);
      return;
    }

    // Site action — resolve mentions and compose prompt
    const ctxMap = new Map<string, string>();
    for (const m of mentions) {
      const ctx = await resolve({
        type: m.type,
        query: "",
        displayName: m.label,
        resolvedId: m.id,
        resolvedData: m.data,
        startPos: 0,
        endPos: 0,
      });
      ctxMap.set(`${m.type}:${m.id}`, ctx);
    }
    setResolvedContexts(ctxMap);

    const composed = compose(text, ctxMap);

    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    // Inject into terminal
    if (!session) {
      // Try to launch Claude Code
      const claudeTool = tools.find((t) => t.slug === "claude-code" && t.installed);
      if (claudeTool) {
        launch(claudeTool);
        // Wait a moment for PTY to initialize
        setTimeout(() => {
          writeToActivePty(composed.fullText + "\n");
        }, 1500);
      }
    } else {
      writeToActivePty(composed.fullText + "\n");
    }

    // Save to history
    const entry: PromptHistoryEntry = {
      text,
      composedText: composed.fullText,
      timestamp: Date.now(),
      mentions: mentions.map((m) => ({ type: m.type, displayName: m.label })),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 50));
    setPromptCount((c) => c + 1);

    handleClose();
  }, [
    text, mentions, showPreview, session, tools, sites,
    resolve, compose, launch, handleClose,
    setSites, setActiveSiteIdx, setTheme, setHistory, setPromptCount,
  ]);

  const handleCopyComposed = useCallback(async () => {
    const ctxMap = resolvedContexts;
    const composed = compose(text, ctxMap);
    await navigator.clipboard.writeText(composed.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text, resolvedContexts, compose]);

  const handleLoadRecent = useCallback((entry: PromptHistoryEntry) => {
    setText(entry.text);
    setShowRecent(false);
  }, []);

  // Close on Escape (palette-level, not input-level)
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleClose]);

  if (!open) return null;

  const composed = resolvedContexts.size > 0 ? compose(text, resolvedContexts) : null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === backdropRef.current && handleClose()}
    >
      <div
        className="w-full max-w-[640px] rounded-xl border shadow-2xl overflow-hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Lightning size={16} weight="fill" style={{ color: "var(--accent)" }} />
            <span className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
              Prompt Builder
            </span>
            {site && (
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: "var(--fg-muted)", background: "var(--bg)" }}>
                {site.name}
              </span>
            )}
          </div>
          <button onClick={handleClose} style={{ color: "var(--fg-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* App action result */}
        {appActionResult && (
          <div
            className="px-4 py-3 text-[13px]"
            style={{ color: appActionResult.success ? "#34d399" : "var(--destructive)" }}
          >
            {appActionResult.success ? "✓" : "✗"} {appActionResult.message}
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleClose}
                className="px-3 py-1 rounded text-[12px]"
                style={{ background: "var(--bg)", color: "var(--fg)" }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Main input area */}
        {!appActionResult && (
          <div className="p-4">
            <MentionInput
              value={text}
              onChange={setText}
              mentions={mentions}
              onMentionAdd={handleMentionAdd}
              onMentionRemove={handleMentionRemove}
              autoFocus
              onSubmit={handleSubmit}
            />

            <PromptHints text={text} mentionCount={mentions.length} />

            {/* Quick chips */}
            {site && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {quickChips.map((chip) => (
                  <button
                    key={chip.type}
                    onClick={() => handleChipClick(chip.type)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono transition-colors"
                    style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {/* No site configured */}
            {!site && (
              <div
                className="mt-3 p-3 rounded-lg border text-[13px]"
                style={{ borderColor: "var(--accent)", background: `var(--accent)10` }}
              >
                <p style={{ color: "var(--fg)" }}>
                  No site connected. Type "add site [name] at [url] key [api_key]" or go to Settings.
                </p>
              </div>
            )}

            {/* Context preview */}
            {showPreview && composed && (
              <div className="mt-3">
                <ContextPreview
                  contextBlock={composed.contextBlock}
                  mentions={mentions.map((m) => ({
                    type: m.type,
                    label: m.label,
                    context: resolvedContexts.get(`${m.type}:${m.id}`),
                  }))}
                  defaultExpanded
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleSubmit}
                disabled={!text.trim() && mentions.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-30"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                <PaperPlaneRight size={14} weight="bold" />
                {showPreview ? "Send to Terminal" : "Send"}
                <span className="text-[10px] opacity-70 ml-1">⌘↵</span>
              </button>

              {showPreview && (
                <button
                  onClick={handleCopyComposed}
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-[12px] transition-colors"
                  style={{ color: "var(--fg-muted)", background: "var(--bg)" }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy Prompt"}
                </button>
              )}

              {!session && text.trim() && (
                <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                  No session — will launch Claude Code
                </span>
              )}
            </div>

            {/* Recent prompts */}
            {showRecent && !text && history.length > 0 && (
              <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-1 mb-2" style={{ color: "var(--fg-muted)" }}>
                  <ClockCounterClockwise size={12} />
                  <span className="text-[11px] uppercase tracking-wider">Recent</span>
                </div>
                {history.slice(0, 5).map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => handleLoadRecent(entry)}
                    className="w-full text-left px-2 py-1.5 rounded text-[13px] truncate transition-colors"
                    style={{ color: "var(--fg)" }}
                  >
                    {entry.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add gui/src/components/CommandPalette.tsx
git commit -m "feat(gui): add Command Palette with @-mentions, app actions, context preview"
```

---

### Task 9: Prompt Workshop (Replaces BricksPanel)

The upgraded Bricks tab with preset browser, prompt editor, context inspector, and history.

**Files:**
- Create: `gui/src/components/prompt/PromptWorkshop.tsx`
- Create: `gui/src/components/prompt/PresetList.tsx`
- Create: `gui/src/components/prompt/LearnCard.tsx`

**Step 1: Create PresetList**

Create `gui/src/components/prompt/PresetList.tsx`:

```tsx
import { useState } from "react";
import { useAtomValue } from "jotai";
import { allPresetsAtom, type PromptPreset } from "../../atoms/prompts";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

interface PresetListProps {
  onSelect: (preset: PromptPreset) => void;
}

const CATEGORIES: { key: PromptPreset["category"]; label: string }[] = [
  { key: "build", label: "Build" },
  { key: "edit", label: "Edit" },
  { key: "manage", label: "Manage" },
  { key: "inspect", label: "Inspect" },
];

export function PresetList({ onSelect }: PresetListProps) {
  const presets = useAtomValue(allPresetsAtom);
  const [expandedCat, setExpandedCat] = useState<string | null>("build");

  return (
    <div className="space-y-1">
      {CATEGORIES.map(({ key, label }) => {
        const items = presets.filter((p) => p.category === key);
        if (items.length === 0) return null;
        const isExpanded = expandedCat === key;

        return (
          <div key={key}>
            <button
              onClick={() => setExpandedCat(isExpanded ? null : key)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[12px] uppercase tracking-wider font-medium"
              style={{ color: "var(--fg-muted)" }}
            >
              {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
              {label}
              <span className="text-[10px] opacity-50">({items.length})</span>
            </button>
            {isExpanded && (
              <div className="ml-2 space-y-0.5">
                {items.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onSelect(preset)}
                    className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors"
                    style={{ color: "var(--fg)" }}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Create LearnCard**

Create `gui/src/components/prompt/LearnCard.tsx`:

```tsx
import { useState } from "react";
import { useAtomValue } from "jotai";
import { experienceLevelAtom, promptCountAtom, hintPreferenceAtom } from "../../atoms/app";
import { Copy, Check, CaretDown, CaretRight, GraduationCap } from "@phosphor-icons/react";

interface LearnCardProps {
  composedPrompt: string;
  cliEquivalent?: string;
}

export function LearnCard({ composedPrompt, cliEquivalent }: LearnCardProps) {
  const experience = useAtomValue(experienceLevelAtom);
  const hintPref = useAtomValue(hintPreferenceAtom);
  const promptCount = useAtomValue(promptCountAtom);
  const [expanded, setExpanded] = useState(
    hintPref === "always" || (hintPref === "auto" && promptCount <= 10)
  );
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const shouldShow =
    hintPref === "always" ||
    (hintPref === "auto" && (experience === "beginner" || promptCount <= 50));

  if (!shouldShow || !composedPrompt) return null;

  const copyRaw = async () => {
    await navigator.clipboard.writeText(composedPrompt);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const copyCli = async () => {
    if (cliEquivalent) {
      await navigator.clipboard.writeText(cliEquivalent);
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    }
  };

  return (
    <div
      className="rounded-lg border text-[13px]"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ color: "var(--fg-muted)" }}
      >
        <GraduationCap size={14} />
        {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
        <span>What just happened</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          <div className="mt-2">
            <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--fg-muted)" }}>
              Without the GUI, you could type:
            </div>
            <pre
              className="p-2 rounded text-[12px] whitespace-pre-wrap font-mono"
              style={{ background: "var(--surface)", color: "var(--fg)" }}
            >
              {composedPrompt}
            </pre>
            <button
              onClick={copyRaw}
              className="mt-1 flex items-center gap-1 text-[11px]"
              style={{ color: "var(--fg-muted)" }}
            >
              {copiedRaw ? <Check size={10} /> : <Copy size={10} />}
              {copiedRaw ? "Copied" : "Copy"}
            </button>
          </div>

          {cliEquivalent && (
            <div>
              <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--fg-muted)" }}>
                CLI equivalent:
              </div>
              <pre
                className="p-2 rounded text-[12px] whitespace-pre-wrap font-mono"
                style={{ background: "var(--surface)", color: "var(--fg)" }}
              >
                {cliEquivalent}
              </pre>
              <button
                onClick={copyCli}
                className="mt-1 flex items-center gap-1 text-[11px]"
                style={{ color: "var(--fg-muted)" }}
              >
                {copiedCli ? <Check size={10} /> : <Copy size={10} />}
                {copiedCli ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create PromptWorkshop**

Create `gui/src/components/prompt/PromptWorkshop.tsx`:

```tsx
import { useState, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeSiteAtom, promptCountAtom } from "../../atoms/app";
import {
  promptHistoryAtom,
  customPresetsAtom,
  type PromptPreset,
  type MentionType,
  type PromptHistoryEntry,
} from "../../atoms/prompts";
import { activeSessionAtom } from "../../atoms/sessions";
import { MentionInput } from "./MentionInput";
import { PromptHints } from "./PromptHints";
import { ContextPreview } from "./ContextPreview";
import { PresetList } from "./PresetList";
import { LearnCard } from "./LearnCard";
import { useMentionResolver } from "../../hooks/useMentionResolver";
import { usePromptComposer } from "../../hooks/usePromptComposer";
import { writeToActivePty } from "../../atoms/ptyBridge";
import {
  PaperPlaneRight,
  FloppyDisk,
  Copy,
  Check,
  ClockCounterClockwise,
  Notebook,
} from "@phosphor-icons/react";

interface ResolvedMention {
  type: MentionType;
  id: string | number;
  label: string;
  data?: unknown;
}

export function PromptWorkshop() {
  const site = useAtomValue(activeSiteAtom);
  const session = useAtomValue(activeSessionAtom);
  const [history, setHistory] = useAtom(promptHistoryAtom);
  const setCustomPresets = useSetAtom(customPresetsAtom);
  const setPromptCount = useSetAtom(promptCountAtom);
  const { resolve } = useMentionResolver();
  const { compose } = usePromptComposer();

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ResolvedMention[]>([]);
  const [resolvedContexts, setResolvedContexts] = useState<Map<string, string>>(new Map());
  const [lastComposed, setLastComposed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"presets" | "history">("presets");

  const handleMentionAdd = useCallback((m: ResolvedMention) => {
    setMentions((prev) => [...prev, m]);
  }, []);

  const handleMentionRemove = useCallback((index: number) => {
    setMentions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePresetSelect = useCallback((preset: PromptPreset) => {
    setText(preset.prompt);
    setMentions([]);
    setResolvedContexts(new Map());
  }, []);

  const handleSend = useCallback(async () => {
    if (!text.trim() && mentions.length === 0) return;

    // Resolve mentions
    const ctxMap = new Map<string, string>();
    for (const m of mentions) {
      const ctx = await resolve({
        type: m.type,
        query: "",
        displayName: m.label,
        resolvedId: m.id,
        resolvedData: m.data,
        startPos: 0,
        endPos: 0,
      });
      ctxMap.set(`${m.type}:${m.id}`, ctx);
    }
    setResolvedContexts(ctxMap);

    const composed = compose(text, ctxMap);

    // Inject into terminal
    if (session) {
      writeToActivePty(composed.fullText + "\n");
    }

    setLastComposed(composed.fullText);

    // Save to history
    const entry: PromptHistoryEntry = {
      text,
      composedText: composed.fullText,
      timestamp: Date.now(),
      mentions: mentions.map((m) => ({ type: m.type, displayName: m.label })),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 50));
    setPromptCount((c) => c + 1);

    // Clear input
    setText("");
    setMentions([]);
  }, [text, mentions, session, resolve, compose, setHistory, setPromptCount]);

  const handleSavePreset = useCallback(() => {
    if (!text.trim()) return;
    const name = prompt("Preset name:");
    if (!name) return;
    const preset: PromptPreset = {
      id: `custom-${Date.now()}`,
      name,
      description: text.slice(0, 80),
      prompt: text,
      category: "build",
      builtin: false,
    };
    setCustomPresets((prev) => [...prev, preset]);
  }, [text, setCustomPresets]);

  const handleCopy = useCallback(async () => {
    const composed = compose(text, resolvedContexts);
    await navigator.clipboard.writeText(composed.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text, resolvedContexts, compose]);

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Connection status */}
      {site ? (
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#34d399" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }} />
          {site.name} ({new URL(site.site_url).hostname})
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--accent)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
          No site connected — use Settings or type "add site..." in Cmd+P
        </div>
      )}

      {/* Prompt editor */}
      <div>
        <MentionInput
          value={text}
          onChange={setText}
          mentions={mentions}
          onMentionAdd={handleMentionAdd}
          onMentionRemove={handleMentionRemove}
          maxRows={8}
          onSubmit={handleSend}
        />
        <PromptHints text={text} mentionCount={mentions.length} />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={handleSend}
            disabled={(!text.trim() && mentions.length === 0) || !session}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-medium transition-colors disabled:opacity-30"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            <PaperPlaneRight size={12} weight="bold" />
            Send
          </button>
          <button
            onClick={handleSavePreset}
            disabled={!text.trim()}
            className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors disabled:opacity-30"
            style={{ color: "var(--fg-muted)", background: "var(--bg)" }}
          >
            <FloppyDisk size={12} />
            Save
          </button>
          <button
            onClick={handleCopy}
            disabled={!text.trim()}
            className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors disabled:opacity-30"
            style={{ color: "var(--fg-muted)", background: "var(--bg)" }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Context inspector */}
      {mentions.length > 0 && (
        <ContextPreview
          contextBlock={compose(text, resolvedContexts).contextBlock}
          mentions={mentions.map((m) => ({ type: m.type, label: m.label }))}
        />
      )}

      {/* Learn card */}
      {lastComposed && <LearnCard composedPrompt={lastComposed} />}

      {/* Presets / History toggle */}
      <div className="flex items-center gap-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setView("presets")}
          className="flex items-center gap-1 text-[12px]"
          style={{ color: view === "presets" ? "var(--accent)" : "var(--fg-muted)" }}
        >
          <Notebook size={12} />
          Presets
        </button>
        <button
          onClick={() => setView("history")}
          className="flex items-center gap-1 text-[12px]"
          style={{ color: view === "history" ? "var(--accent)" : "var(--fg-muted)" }}
        >
          <ClockCounterClockwise size={12} />
          History
        </button>
      </div>

      {/* Presets or History content */}
      <div className="flex-1 overflow-y-auto">
        {view === "presets" ? (
          <PresetList onSelect={handlePresetSelect} />
        ) : (
          <div className="space-y-1">
            {history.length === 0 && (
              <p className="text-[13px] px-2 py-4" style={{ color: "var(--fg-muted)" }}>
                No prompts yet. Send your first prompt above.
              </p>
            )}
            {history.map((entry, i) => (
              <button
                key={i}
                onClick={() => {
                  setText(entry.text);
                  setView("presets");
                }}
                className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors"
                style={{ color: "var(--fg)" }}
              >
                <div className="truncate">{entry.text}</div>
                <div className="text-[10px]" style={{ color: "var(--fg-muted)" }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                  {entry.mentions.length > 0 && ` · ${entry.mentions.length} references`}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add gui/src/components/prompt/PromptWorkshop.tsx gui/src/components/prompt/PresetList.tsx gui/src/components/prompt/LearnCard.tsx
git commit -m "feat(gui): add Prompt Workshop with presets, history, and learn cards"
```

---

### Task 10: Site Switcher Component

Dropdown in the status bar for switching between saved sites.

**Files:**
- Create: `gui/src/components/SiteSwitcher.tsx`

**Step 1: Create SiteSwitcher**

Create `gui/src/components/SiteSwitcher.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { sitesAtom, activeSiteIndexAtom, activeSiteAtom, settingsOpenAtom } from "../atoms/app";
import { mentionCacheAtom } from "../atoms/prompts";
import { CaretUpDown, Plus, Check } from "@phosphor-icons/react";

export function SiteSwitcher() {
  const [sites] = useAtom(sitesAtom);
  const [activeIdx, setActiveIdx] = useAtom(activeSiteIndexAtom);
  const activeSite = sitesAtom.length > 0 ? sites[activeIdx] : null;
  const setCache = useSetAtom(mentionCacheAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSwitch = (idx: number) => {
    setActiveIdx(idx);
    setCache({}); // Clear mention cache on site switch
    setOpen(false);
  };

  if (sites.length === 0) {
    return (
      <button
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-1 text-[12px]"
        style={{ color: "var(--fg-muted)" }}
      >
        <Plus size={12} />
        Add Site
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[12px] transition-colors"
        style={{ color: "var(--fg-muted)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }} />
        {activeSite?.name ?? "No site"}
        <CaretUpDown size={10} />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 min-w-[200px] rounded-lg border shadow-lg overflow-hidden z-50"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {sites.map((site, i) => (
            <button
              key={i}
              onClick={() => handleSwitch(i)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
              style={{
                color: "var(--fg)",
                background: i === activeIdx ? "var(--border)" : undefined,
              }}
            >
              {i === activeIdx ? (
                <Check size={12} style={{ color: "#34d399" }} />
              ) : (
                <span className="w-3" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{site.name}</div>
                <div className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
                  {site.site_url}
                </div>
              </div>
            </button>
          ))}
          <div className="border-t" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => { setOpen(false); setSettingsOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors"
              style={{ color: "var(--fg-muted)" }}
            >
              <Plus size={12} />
              Add Site
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add gui/src/components/SiteSwitcher.tsx
git commit -m "feat(gui): add SiteSwitcher dropdown for multi-site support"
```

---

### Task 11: Onboarding Tooltips (Replace Wizard)

Lightweight spotlight tooltips on first launch instead of the blocking wizard.

**Files:**
- Create: `gui/src/components/OnboardingTooltips.tsx`

**Step 1: Create OnboardingTooltips**

Create `gui/src/components/OnboardingTooltips.tsx`:

```tsx
import { useState, useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { onboardingSeenAtom } from "../atoms/app";

interface TooltipStep {
  target: string; // CSS selector
  title: string;
  message: string;
  position: "top" | "bottom" | "left" | "right";
}

const STEPS: TooltipStep[] = [
  {
    target: "[data-onboard='tools']",
    title: "Your AI Tools",
    message: "Installed coding tools appear here. Click one to start a session.",
    position: "right",
  },
  {
    target: "[data-onboard='prompt-btn']",
    title: "Smart Prompt Builder",
    message: "Build context-rich prompts with @mentions that reference your site's pages, sections, and styles.",
    position: "right",
  },
  {
    target: "[data-onboard='palette-hint']",
    title: "Quick Prompting",
    message: "Press Cmd+P anytime for the command palette — fast prompting from anywhere.",
    position: "bottom",
  },
  {
    target: "[data-onboard='site-switcher']",
    title: "Connect Your Site",
    message: "Add your WordPress site URL and API key to enable @mentions and site-aware prompting.",
    position: "top",
  },
];

export function OnboardingTooltips() {
  const [seen, setSeen] = useAtom(onboardingSeenAtom);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seen || step >= STEPS.length) return;

    const target = document.querySelector(STEPS[step].target);
    if (!target) {
      // Skip if target not found
      setStep((s) => s + 1);
      return;
    }

    const rect = target.getBoundingClientRect();
    const s = STEPS[step];
    let top = 0;
    let left = 0;

    switch (s.position) {
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + 12;
        break;
      case "bottom":
        top = rect.bottom + 12;
        left = rect.left + rect.width / 2;
        break;
      case "top":
        top = rect.top - 12;
        left = rect.left + rect.width / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - 12;
        break;
    }

    setPos({ top, left });
  }, [step, seen]);

  if (seen || step >= STEPS.length) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Subtle overlay */}
      <div className="fixed inset-0 z-[90] pointer-events-none" style={{ background: "rgba(0,0,0,0.15)" }} />

      {/* Tooltip */}
      {pos && (
        <div
          ref={tooltipRef}
          className="fixed z-[95] max-w-[280px] rounded-xl border shadow-xl p-4"
          style={{
            top: pos.top,
            left: pos.left,
            background: "var(--surface)",
            borderColor: "var(--accent)",
            transform:
              current.position === "right" ? "translateY(-50%)" :
              current.position === "left" ? "translate(-100%, -50%)" :
              current.position === "bottom" ? "translateX(-50%)" :
              "translate(-50%, -100%)",
          }}
        >
          <div className="text-[14px] font-medium mb-1" style={{ color: "var(--fg)" }}>
            {current.title}
          </div>
          <div className="text-[13px] mb-3" style={{ color: "var(--fg-muted)" }}>
            {current.message}
          </div>

          <div className="flex items-center justify-between">
            {/* Progress dots */}
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: i === step ? "var(--accent)" : "var(--border)" }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSeen(true)}
                className="text-[12px] px-2 py-1 rounded"
                style={{ color: "var(--fg-muted)" }}
              >
                Skip
              </button>
              <button
                onClick={() => {
                  if (isLast) setSeen(true);
                  else setStep((s) => s + 1);
                }}
                className="text-[12px] px-3 py-1 rounded font-medium"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                {isLast ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add gui/src/components/OnboardingTooltips.tsx
git commit -m "feat(gui): add lightweight onboarding tooltips replacing wizard"
```

---

### Task 12: Wire Everything Together — AppShell, Sidebar, ContextPanel, StatusBar, Keyboard Shortcuts

Connect all new components into the existing shell.

**Files:**
- Modify: `gui/src/components/AppShell.tsx`
- Modify: `gui/src/components/Sidebar.tsx`
- Modify: `gui/src/components/ContextPanel.tsx`
- Modify: `gui/src/components/StatusBar.tsx`
- Modify: `gui/src/hooks/useKeyboardShortcuts.ts`

**Step 1: Update AppShell.tsx**

Replace the full contents of `gui/src/components/AppShell.tsx`:

```tsx
import { useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom, onboardingSeenAtom } from "../atoms/app";
import { Sidebar } from "./Sidebar";
import { TerminalPanel } from "./TerminalPanel";
import { ContextPanel } from "./ContextPanel";
import { StatusBar } from "./StatusBar";
import { CommandPalette } from "./CommandPalette";
import { OnboardingTooltips } from "./OnboardingTooltips";
import { useToolDetection } from "../hooks/useToolDetection";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export function AppShell() {
  useToolDetection();
  useKeyboardShortcuts();
  const [sidebarOpen] = useAtom(sidebarOpenAtom);
  const [contextOpen] = useAtom(contextPanelOpenAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const setContextOpen = useSetAtom(contextPanelOpenAtom);
  const onboardingSeen = useAtomValue(onboardingSeenAtom);

  // Responsive: collapse panels at narrow widths
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 1200;
      if (width < 700) {
        setSidebarOpen(false);
        setContextOpen(false);
      } else if (width < 1000) {
        setContextOpen(false);
      }
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [setSidebarOpen, setContextOpen]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        <Sidebar collapsed={!sidebarOpen} />
        <main className="flex-1 min-w-0">
          <TerminalPanel />
        </main>
        {contextOpen && <ContextPanel />}
      </div>
      <StatusBar />
      <CommandPalette />
      {!onboardingSeen && <OnboardingTooltips />}
    </div>
  );
}
```

**Step 2: Update Sidebar.tsx — add prompt button and onboarding data attributes**

In `gui/src/components/Sidebar.tsx`, add the import and prompt button. Add these imports at the top:

```tsx
import { Lightning } from "@phosphor-icons/react";
import { paletteOpenAtom } from "../atoms/app";
```

Add palette state inside the component function, after the existing atom declarations:

```tsx
const setPaletteOpen = useSetAtom(paletteOpenAtom);
```

Then insert the Prompt button right after the header div (after `</div>` that closes the "p-3 flex items-center gap-2 border-b" div), and add `data-onboard` attributes to the tools section:

Insert before the `<div className="flex-1 overflow-y-auto p-2">`:

```tsx
      {/* Prompt Builder button */}
      <div className="px-2 pt-2" data-onboard="prompt-btn">
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
          style={{ background: "var(--accent)", color: "var(--bg)" }}
          title="Open Prompt Builder (⌘P)"
          data-onboard="palette-hint"
        >
          <Lightning size={16} weight="fill" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Prompt</span>
              <span className="text-[10px] opacity-60">⌘P</span>
            </>
          )}
        </button>
      </div>
```

Add `data-onboard="tools"` to the tools section div:

Change `<div className="mb-4">` (the one containing the Tools heading) to:
```tsx
<div className="mb-4" data-onboard="tools">
```

**Step 3: Update ContextPanel.tsx — rename Bricks tab to Prompts, use PromptWorkshop**

Replace the full contents of `gui/src/components/ContextPanel.tsx`:

```tsx
import { useState } from "react";
import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { activeToolAtom } from "../atoms/tools";
import { activeSiteAtom } from "../atoms/app";
import { WelcomeContent } from "./context/WelcomeContent";
import { ToolReference } from "./context/ToolReference";
import { NotInstalledContent } from "./context/NotInstalledContent";
import { PromptWorkshop } from "./prompt/PromptWorkshop";
import { WebPreview } from "./context/WebPreview";
import { Lightning, Browser } from "@phosphor-icons/react";

type PanelView = "main" | "prompts" | "preview";

export function ContextPanel() {
  const [session] = useAtom(activeSessionAtom);
  const [tool] = useAtom(activeToolAtom);
  const [site] = useAtom(activeSiteAtom);
  const [view, setView] = useState<PanelView>("prompts");

  let content;
  if (view === "prompts") {
    content = <PromptWorkshop />;
  } else if (view === "preview") {
    content = <WebPreview siteUrl={site?.site_url || ""} />;
  } else if (!tool) {
    content = <WelcomeContent />;
  } else if (!tool.installed) {
    content = <NotInstalledContent tool={tool} />;
  } else if (session?.status === "running") {
    content = <ToolReference toolSlug={tool.slug} />;
  } else {
    content = <WelcomeContent />;
  }

  return (
    <aside
      className="w-[320px] border-l overflow-y-auto flex flex-col"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      role="complementary"
      aria-label="Context panel"
    >
      <div
        className="flex items-center justify-end gap-1 px-3 py-1.5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setView(view === "prompts" ? "main" : "prompts")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
          style={{
            color: view === "prompts" ? "var(--accent)" : "var(--fg-muted)",
          }}
          title="Prompt Workshop"
        >
          <Lightning size={14} weight={view === "prompts" ? "fill" : "bold"} />
          Prompts
        </button>
        <button
          onClick={() => setView(view === "preview" ? "main" : "preview")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
          style={{
            color: view === "preview" ? "var(--accent)" : "var(--fg-muted)",
          }}
          title="Preview website"
        >
          <Browser size={14} weight={view === "preview" ? "fill" : "bold"} />
          Preview
        </button>
      </div>
      <div className="flex-1 min-h-0">{content}</div>
    </aside>
  );
}
```

**Step 4: Update StatusBar.tsx — add SiteSwitcher**

Replace the full contents of `gui/src/components/StatusBar.tsx`:

```tsx
import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { activeToolAtom } from "../atoms/tools";
import { useState, useEffect } from "react";
import { SiteSwitcher } from "./SiteSwitcher";

export function StatusBar() {
  const [session] = useAtom(activeSessionAtom);
  const [tool] = useAtom(activeToolAtom);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!session || session.status !== "running") {
      setElapsed("");
      return;
    }
    const interval = setInterval(() => {
      const ms = Date.now() - session.startedAt;
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) setElapsed(`${h}h ${m % 60}m`);
      else if (m > 0) setElapsed(`${m}m ${s % 60}s`);
      else setElapsed(`${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return (
    <footer
      className="h-7 border-t flex items-center px-3 gap-3 text-[12px] font-mono"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        color: "var(--fg-muted)",
      }}
    >
      <div data-onboard="site-switcher">
        <SiteSwitcher />
      </div>
      <span style={{ color: "var(--border)" }}>|</span>
      {session && tool ? (
        <>
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full animate-pulse-dot"
              style={{ background: "var(--accent)" }}
            />
            {tool.name}
          </span>
          {tool.version && (
            <>
              <span style={{ color: "var(--border)" }}>|</span>
              <span>{tool.version}</span>
            </>
          )}
          {elapsed && (
            <>
              <span style={{ color: "var(--border)" }}>|</span>
              <span>{elapsed}</span>
            </>
          )}
        </>
      ) : (
        <span>No active session</span>
      )}
    </footer>
  );
}
```

**Step 5: Update keyboard shortcuts**

Replace the full contents of `gui/src/hooks/useKeyboardShortcuts.ts`:

```typescript
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom, paletteOpenAtom } from "../atoms/app";

export function useKeyboardShortcuts() {
  const setSidebar = useSetAtom(sidebarOpenAtom);
  const setContext = useSetAtom(contextPanelOpenAtom);
  const setPalette = useSetAtom(paletteOpenAtom);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Don't intercept shortcuts when terminal is focused (except palette)
      const inTerminal = (e.target as HTMLElement)?.closest(".xterm");

      // Cmd+P — open palette (works even in terminal)
      if (meta && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        setPalette((prev) => !prev);
        return;
      }

      // Cmd+Shift+P — open palette with last prompt
      if (meta && e.key === "p" && e.shiftKey) {
        e.preventDefault();
        setPalette(true);
        return;
      }

      if (inTerminal) return;

      if (meta && e.key === "b") {
        e.preventDefault();
        setSidebar((prev) => !prev);
      }

      if (meta && e.key === "\\") {
        e.preventDefault();
        setContext((prev) => !prev);
      }

      if (meta && e.key === "k") {
        e.preventDefault();
        setContext(true);
        // Focus the workshop editor
        setTimeout(() => {
          const editor = document.querySelector<HTMLTextAreaElement>(
            "[data-prompt-workshop] textarea"
          );
          editor?.focus();
        }, 100);
      }

      if (e.key === "Escape") {
        const termTextarea =
          document.querySelector<HTMLTextAreaElement>(".xterm textarea");
        if (termTextarea) {
          e.preventDefault();
          termTextarea.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSidebar, setContext, setPalette]);
}
```

**Step 6: Add data-prompt-workshop attribute to PromptWorkshop**

In `gui/src/components/prompt/PromptWorkshop.tsx`, add `data-prompt-workshop` to the root div:

Change:
```tsx
<div className="flex flex-col h-full p-3 gap-3">
```
To:
```tsx
<div className="flex flex-col h-full p-3 gap-3" data-prompt-workshop>
```

**Step 7: Verify TypeScript compiles**

Run: `cd gui && npx tsc --noEmit`
Expected: Compiles — may have warnings but no errors.

**Step 8: Commit**

```bash
git add gui/src/components/AppShell.tsx gui/src/components/Sidebar.tsx gui/src/components/ContextPanel.tsx gui/src/components/StatusBar.tsx gui/src/hooks/useKeyboardShortcuts.ts gui/src/components/prompt/PromptWorkshop.tsx
git commit -m "feat(gui): wire up command palette, prompt workshop, site switcher, onboarding tooltips"
```

---

### Task 13: CSS Styles for New Components

Add styles for the palette overlay, mention pills, tooltip spotlights, and transitions.

**Files:**
- Modify: `gui/src/index.css`

**Step 1: Append new styles to index.css**

Add these rules at the end of `gui/src/index.css`:

```css
/* Command Palette transitions */
.palette-backdrop {
  animation: palette-fade-in 150ms ease-out;
}

@keyframes palette-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.palette-container {
  animation: palette-slide-in 150ms ease-out;
}

@keyframes palette-slide-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Mention pills */
.mention-pill {
  user-select: none;
  transition: opacity 150ms;
}

.mention-pill:hover {
  opacity: 0.8;
}

/* Onboarding tooltip */
.onboarding-tooltip {
  animation: tooltip-pop 200ms ease-out;
}

@keyframes tooltip-pop {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Autocomplete dropdown */
.mention-autocomplete button:hover {
  background: var(--border);
}

/* Prompt workshop preset hover */
.preset-item:hover {
  background: var(--border);
}
```

**Step 2: Commit**

```bash
git add gui/src/index.css
git commit -m "feat(gui): add CSS animations for palette, tooltips, mention pills"
```

---

### Task 14: Config Persistence — Load/Save Multi-Site and Prompts

Ensure the new config schema (multi-site, presets, history) persists to `~/.agent-to-bricks/config.yaml`.

**Files:**
- Create: `gui/src/hooks/useConfigPersistence.ts`
- Modify: `gui/src/components/AppShell.tsx` (add the hook)

**Step 1: Create useConfigPersistence hook**

Create `gui/src/hooks/useConfigPersistence.ts`:

```typescript
import { useEffect, useRef } from "react";
import { useAtom, useSetAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import {
  sitesAtom,
  activeSiteIndexAtom,
  themeAtom,
  onboardingSeenAtom,
  experienceLevelAtom,
  hintPreferenceAtom,
  sessionPrePromptAtom,
  promptCountAtom,
} from "../atoms/app";
import { customPresetsAtom, promptHistoryAtom } from "../atoms/prompts";

const CONFIG_PATH = "~/.agent-to-bricks/config.yaml";

interface ConfigData {
  sites?: Array<{ name: string; url: string; api_key: string }>;
  active_site?: number;
  default_tool?: string;
  theme?: string;
  saved_prompts?: Array<{ id: string; name: string; description: string; prompt: string; category: string }>;
  prompt_history?: Array<{ text: string; composedText: string; timestamp: number }>;
  experience_level?: string;
  hint_preference?: string;
  session_pre_prompt?: string;
  onboarding_seen?: boolean;
  prompt_count?: number;
  // Legacy single-site fields
  site?: { url?: string; api_key?: string };
}

function parseYaml(text: string): ConfigData {
  // Simple YAML-like parser for our flat config structure
  // For production, use a proper YAML parser — for now, JSON works since
  // write_config can write JSON-compatible YAML
  try {
    return JSON.parse(text);
  } catch {
    // Fallback: try to parse key-value YAML
    const result: Record<string, unknown> = {};
    for (const line of text.split("\n")) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const val = match[2].trim();
        result[match[1]] = val === "true" ? true : val === "false" ? false : val;
      }
    }
    return result as ConfigData;
  }
}

export function useConfigPersistence() {
  const [sites, setSites] = useAtom(sitesAtom);
  const [activeIdx, setActiveIdx] = useAtom(activeSiteIndexAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  const [onboardingSeen, setOnboardingSeen] = useAtom(onboardingSeenAtom);
  const [experienceLevel, setExperienceLevel] = useAtom(experienceLevelAtom);
  const [hintPref, setHintPref] = useAtom(hintPreferenceAtom);
  const [prePrompt, setPrePrompt] = useAtom(sessionPrePromptAtom);
  const [promptCount, setPromptCount] = useAtom(promptCountAtom);
  const [customPresets, setCustomPresets] = useAtom(customPresetsAtom);
  const [history, setHistory] = useAtom(promptHistoryAtom);
  const loaded = useRef(false);

  // Load config on mount
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    (async () => {
      try {
        const exists = await invoke<boolean>("config_exists", { path: CONFIG_PATH });
        if (!exists) return;

        const raw = await invoke<string>("read_config", { path: CONFIG_PATH });
        const cfg = parseYaml(raw);

        // Multi-site
        if (cfg.sites && cfg.sites.length > 0) {
          setSites(cfg.sites.map((s) => ({
            name: s.name,
            site_url: s.url,
            api_key: s.api_key,
          })));
          if (typeof cfg.active_site === "number") setActiveIdx(cfg.active_site);
        } else if (cfg.site?.url) {
          // Legacy single-site migration
          setSites([{
            name: new URL(cfg.site.url).hostname,
            site_url: cfg.site.url,
            api_key: cfg.site.api_key ?? "",
          }]);
        }

        if (cfg.theme === "light" || cfg.theme === "dark") setTheme(cfg.theme);
        if (typeof cfg.onboarding_seen === "boolean") setOnboardingSeen(cfg.onboarding_seen);
        if (cfg.experience_level) setExperienceLevel(cfg.experience_level as any);
        if (cfg.hint_preference) setHintPref(cfg.hint_preference as any);
        if (cfg.session_pre_prompt) setPrePrompt(cfg.session_pre_prompt);
        if (typeof cfg.prompt_count === "number") setPromptCount(cfg.prompt_count);

        if (cfg.saved_prompts) {
          setCustomPresets(cfg.saved_prompts.map((p) => ({
            ...p,
            category: (p.category as any) || "build",
            builtin: false,
          })));
        }

        if (cfg.prompt_history) {
          setHistory(cfg.prompt_history.map((h) => ({
            ...h,
            mentions: [],
          })));
        }
      } catch {
        // Config doesn't exist or is malformed — that's fine
      }
    })();
  }, []);

  // Save config on changes (debounced)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!loaded.current) return;

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const cfg = {
        sites: sites.map((s) => ({ name: s.name, url: s.site_url, api_key: s.api_key })),
        active_site: activeIdx,
        theme,
        onboarding_seen: onboardingSeen,
        experience_level: experienceLevel,
        hint_preference: hintPref,
        session_pre_prompt: prePrompt,
        prompt_count: promptCount,
        saved_prompts: customPresets.map((p) => ({
          id: p.id, name: p.name, description: p.description, prompt: p.prompt, category: p.category,
        })),
        prompt_history: history.slice(0, 50).map((h) => ({
          text: h.text, composedText: h.composedText, timestamp: h.timestamp,
        })),
        // Legacy CLI compat: write active site as flat fields
        site: sites[activeIdx] ? {
          url: sites[activeIdx].site_url,
          api_key: sites[activeIdx].api_key,
        } : undefined,
      };

      try {
        await invoke("write_config", {
          path: CONFIG_PATH,
          content: JSON.stringify(cfg, null, 2),
        });
      } catch {
        // Silently fail on save errors
      }
    }, 1000);

    return () => clearTimeout(saveTimeout.current);
  }, [sites, activeIdx, theme, onboardingSeen, experienceLevel, hintPref, prePrompt, promptCount, customPresets, history]);
}
```

**Step 2: Add the hook to AppShell**

In `gui/src/components/AppShell.tsx`, add:

Import:
```tsx
import { useConfigPersistence } from "../hooks/useConfigPersistence";
```

Inside the component, after `useKeyboardShortcuts()`:
```tsx
useConfigPersistence();
```

**Step 3: Commit**

```bash
git add gui/src/hooks/useConfigPersistence.ts gui/src/components/AppShell.tsx
git commit -m "feat(gui): add config persistence for multi-site, presets, and history"
```

---

### Task 15: Build and Smoke Test

Verify everything compiles and the app launches.

**Step 1: Check TypeScript**

Run: `cd gui && npx tsc --noEmit`
Expected: No type errors

**Step 2: Build the Tauri app**

Run: `cd gui && npm run tauri dev`
Expected: App launches, shows the main UI (no wizard gate), sidebar has a Prompt button, Cmd+P opens palette, Prompts tab shows in context panel.

**Step 3: Fix any compilation errors**

Address any import issues, missing dependencies, or type mismatches discovered during build.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(gui): resolve build issues from smart prompt composer integration"
```

---

## Summary

15 tasks covering:

| Task | What it builds |
|------|---------------|
| 1 | Tauri backend — 7 new API commands |
| 2 | State atoms — multi-site, presets, palette |
| 3 | @-mention engine — 4 hooks + context formatter |
| 4 | Intent classifier — app action detection |
| 5 | MentionInput — shared rich text with @-mentions |
| 6 | ContextPreview — token-counted reference display |
| 7 | PromptHints — real-time quality suggestions |
| 8 | CommandPalette — the Cmd+P overlay |
| 9 | PromptWorkshop — upgraded Bricks tab |
| 10 | SiteSwitcher — multi-site dropdown |
| 11 | OnboardingTooltips — lightweight first-run |
| 12 | Wire together — integrate into shell |
| 13 | CSS — animations and styles |
| 14 | Config persistence — load/save everything |
| 15 | Build and smoke test |
