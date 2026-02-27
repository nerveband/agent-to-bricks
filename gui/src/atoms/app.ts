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
export const helpOpenAtom = atom(false);

// Experience level for progressive hint disclosure
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export const experienceLevelAtom = atom<ExperienceLevel>("beginner");
export const hintPreferenceAtom = atom<"auto" | "always" | "never">("auto");

// Prompt count tracker (drives experience level in "auto" mode)
export const promptCountAtom = atom(0);

// Prompt pane expanded state
export const promptExpandedAtom = atom(false);

// Session pre-prompt template (injected when launching Claude Code)
// Variables: {site_url}, {api_key}, {site_name}, {environment}
export const sessionPrePromptAtom = atom(
  `You are a web developer working with a Bricks Builder WordPress site ({environment}).
Site: {site_url}
API Key: {api_key}
The bricks CLI is available. Use \`bricks\` commands to pull, push, generate, and modify page elements.
Use the API key with the X-ATB-Key header when making API calls to the site.`
);

// Launch dialog — holds the tool being configured before launch, or null when closed
export const launchDialogToolAtom = atom<Tool | null>(null);

// Gates tool detection until config is loaded from disk
// (prevents race between useConfigPersistence and useToolDetection)
export const configLoadedAtom = atom(false);
