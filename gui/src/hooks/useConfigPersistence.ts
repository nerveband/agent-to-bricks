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
import { customPresetsAtom, promptHistoryAtom, hiddenPresetIdsAtom, presetOverridesAtom } from "../atoms/prompts";
import {
  toolCustomFlagsAtom,
  toolWorkingDirsAtom,
  toolPathsAtom,
  detectionCacheAtom,
  customToolDefsAtom,
  type DetectionCache,
  type CustomToolDef,
} from "../atoms/tools";
import { configLoadedAtom } from "../atoms/app";

interface ConfigData {
  sites?: Array<{ name: string; url: string; api_key: string; environment?: string; environment_label?: string }>;
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
  tool_flags?: Record<string, string>;
  tool_dirs?: Record<string, string>;
  tool_paths?: Record<string, string>;
  detection_cache?: DetectionCache;
  custom_tools?: CustomToolDef[];
  hidden_preset_ids?: string[];
  preset_overrides?: Record<string, { name?: string; prompt?: string; description?: string }>;
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
  const [toolFlags, setToolFlags] = useAtom(toolCustomFlagsAtom);
  const [toolDirs, setToolDirs] = useAtom(toolWorkingDirsAtom);
  const [toolPaths, setToolPaths] = useAtom(toolPathsAtom);
  const [detectionCache, setDetectionCache] = useAtom(detectionCacheAtom);
  const [customTools, setCustomTools] = useAtom(customToolDefsAtom);
  const [hiddenPresetIds, setHiddenPresetIds] = useAtom(hiddenPresetIdsAtom);
  const [presetOverrides, setPresetOverrides] = useAtom(presetOverridesAtom);
  const [, setConfigLoaded] = useAtom(configLoadedAtom);
  // Two-phase loading: `started` prevents double-mount, `ready` gates saving
  const started = useRef(false);
  const ready = useRef(false);

  // Load config on mount
  useEffect(() => {
    if (started.current) return;
    started.current = true;

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
            environment: (s.environment as any) || undefined,
            environmentLabel: s.environment_label || undefined,
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

        if (cfg.tool_flags && typeof cfg.tool_flags === "object") {
          setToolFlags(cfg.tool_flags);
        }
        if (cfg.tool_dirs && typeof cfg.tool_dirs === "object") {
          setToolDirs(cfg.tool_dirs);
        }
        if (cfg.tool_paths && typeof cfg.tool_paths === "object") {
          setToolPaths(cfg.tool_paths);
        }
        if (cfg.detection_cache && typeof cfg.detection_cache === "object") {
          setDetectionCache(cfg.detection_cache);
        }
        if (Array.isArray(cfg.custom_tools)) {
          setCustomTools(cfg.custom_tools);
        }
        if (Array.isArray(cfg.hidden_preset_ids)) {
          setHiddenPresetIds(cfg.hidden_preset_ids);
        }
        if (cfg.preset_overrides && typeof cfg.preset_overrides === "object") {
          setPresetOverrides(cfg.preset_overrides);
        }
      } catch (err) {
        console.warn("[config] Could not load config (first run?):", err);
      }

      // Only allow saving AFTER load completes (prevents overwriting config with defaults)
      ready.current = true;
      setConfigLoaded(true);
    })();
  }, []);

  // Save config on changes (debounced) — only after initial load is complete
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!ready.current) return;

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const cfg = {
        sites: sites.map((s) => ({
          name: s.name,
          url: s.site_url,
          api_key: s.api_key,
          environment: s.environment,
          environment_label: s.environmentLabel || undefined,
        })),
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
        tool_flags: toolFlags,
        tool_dirs: toolDirs,
        tool_paths: Object.keys(toolPaths).length > 0 ? toolPaths : undefined,
        detection_cache: Object.keys(detectionCache).length > 0 ? detectionCache : undefined,
        custom_tools: customTools.length > 0 ? customTools : undefined,
        hidden_preset_ids: hiddenPresetIds.length > 0 ? hiddenPresetIds : undefined,
        preset_overrides: Object.keys(presetOverrides).length > 0 ? presetOverrides : undefined,
        // Legacy CLI compat: write active site as flat fields
        site: sites[activeIdx] ? {
          url: sites[activeIdx].site_url,
          api_key: sites[activeIdx].api_key,
        } : undefined,
      };

      try {
        // Written as JSON to config.yaml — valid since YAML is a superset of JSON.
        // The Go CLI uses gopkg.in/yaml.v3 which parses JSON natively.
        await invoke("write_config", {
          path: "~/.agent-to-bricks/config.yaml",
          content: JSON.stringify(cfg, null, 2),
        });
      } catch (err) {
        console.error("[config] Failed to save config:", err);
      }
    }, 1000);

    return () => clearTimeout(saveTimeout.current);
  }, [sites, activeIdx, theme, onboardingSeen, experienceLevel, hintPref, prePrompt, promptCount, customPresets, history, toolFlags, toolDirs, toolPaths, detectionCache, customTools, hiddenPresetIds, presetOverrides]);
}
