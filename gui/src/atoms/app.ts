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
