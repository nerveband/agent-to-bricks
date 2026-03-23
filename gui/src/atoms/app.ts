import { atom } from "jotai";
import type { Tool } from "./tools";

export const sidebarOpenAtom = atom(true);
export const contextPanelOpenAtom = atom(true);
export const themeAtom = atom<"light" | "dark">("dark");
export const paletteOpenAtom = atom(false);

// Onboarding — lightweight tooltips instead of wizard gate
export const onboardingSeenAtom = atom(false);

// Multi-site support
export type SiteEnvironment = "production" | "staging" | "local";

export interface SiteEntry {
  name: string;
  site_url: string;
  api_key: string;
  environment?: SiteEnvironment;
  environmentLabel?: string;
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
export const settingsTabAtom = atom<string>("site");
export const helpOpenAtom = atom(false);

// Experience level for progressive hint disclosure
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export const experienceLevelAtom = atom<ExperienceLevel>("beginner");
export const hintPreferenceAtom = atom<"auto" | "always" | "never">("auto");

// Prompt count tracker (drives experience level in "auto" mode)
export const promptCountAtom = atom(0);

// Prompt pane expanded state
export const promptExpandedAtom = atom(false);

export const SESSION_API_KEY_PLACEHOLDER = "[managed by Agent to Bricks; not injected into session prompts]";
export const DEFAULT_SESSION_PREPROMPT =
  `You are a web developer working with a Bricks Builder WordPress site ({environment}).
Site: {site_url}
Site name: {site_name}
Credentials: {api_key}

## Bricks CLI Quick Reference
The \`bricks\` CLI is installed and configured for this site. Key commands:

| Command | What it does |
|---------|-------------|
| \`bricks discover --json\` | Full site context: design system, classes, variables, element types |
| \`bricks convert html --push PAGE_ID --stdin\` | Convert HTML to Bricks elements and push to a page |
| \`bricks convert html --push PAGE_ID --snapshot --stdin\` | Same, but create a rollback snapshot first |
| \`bricks patch PAGE_ID --list\` | List element IDs on a page (for targeted updates) |
| \`bricks patch PAGE_ID -e ID --set 'key=value'\` | Update a specific element's settings (classes, text, styles) |
| \`bricks classes --json\` | List all global CSS classes (ACSS, Frames, custom) |
| \`bricks frameworks --json\` | CSS framework config (ACSS colors, spacing, typography) |

**Workflow:** discover → generate HTML with site CSS vars → convert & push. For edits, use \`bricks patch\` (faster, fewer tokens).
**Prefer patch for updates** — don't regenerate what you can patch.
**Use the site's CSS variables** (var(--primary), var(--space-m), etc.) — not hardcoded values.
{design_system}{abilities_block}`;

// Session pre-prompt template (injected when launching Claude Code)
// Variables: {site_url}, {api_key}, {site_name}, {environment}, {abilities_block}
// Note: {api_key} resolves to a redacted credential note, not the raw secret.
export const sessionPrePromptAtom = atom(DEFAULT_SESSION_PREPROMPT);

// Launch dialog — holds the tool being configured before launch, or null when closed
export const launchDialogToolAtom = atom<Tool | null>(null);

// Gates tool detection until config is loaded from disk
// (prevents race between useConfigPersistence and useToolDetection)
export const configLoadedAtom = atom(false);

// Track whether site context header has been sent for the current session
// Resets when session changes or on explicit reconnect
export const siteContextSentAtom = atom(false);
