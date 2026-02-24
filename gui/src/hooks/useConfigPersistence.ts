import { useEffect, useRef } from "react";
import { useAtom } from "jotai";
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

function parseConfig(text: string): ConfigData {
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
        const raw = await invoke<string>("read_config", { path: "~/.agent-to-bricks/config.yaml" });
        const cfg = parseConfig(raw);

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
          path: "~/.agent-to-bricks/config.yaml",
          content: JSON.stringify(cfg, null, 2),
        });
      } catch {
        // Silently fail on save errors
      }
    }, 1000);

    return () => clearTimeout(saveTimeout.current);
  }, [sites, activeIdx, theme, onboardingSeen, experienceLevel, hintPref, prePrompt, promptCount, customPresets, history]);
}
