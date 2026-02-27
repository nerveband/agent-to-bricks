import { useEffect, useCallback, useRef } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import {
  toolsAtom,
  toolsDetectedAtom,
  detectionLogAtom,
  detectionCacheAtom,
  customToolDefsAtom,
  redetectRequestedAtom,
  DEFAULT_TOOLS,
  type Tool,
  type DetectionLogEntry,
  type DetectionCache,
} from "../atoms/tools";
import { configLoadedAtom } from "../atoms/app";

interface DetectionResult {
  command: string;
  installed: boolean;
  version: string | null;
  path: string | null;
  found_via: string;
}

interface EnvironmentInfo {
  os: string;
  arch: string;
  shell_path: string;
  shell_kind: string;
  extra_dirs: string[];
}

export function useToolDetection() {
  const setTools = useSetAtom(toolsAtom);
  const setDetected = useSetAtom(toolsDetectedAtom);
  const setLog = useSetAtom(detectionLogAtom);
  const setDetectionCache = useSetAtom(detectionCacheAtom);
  const configLoaded = useAtomValue(configLoadedAtom);
  const detectionCache = useAtomValue(detectionCacheAtom);
  const customToolDefs = useAtomValue(customToolDefsAtom);
  const redetectRequested = useAtomValue(redetectRequestedAtom);
  const hasRun = useRef(false);

  const log = useCallback(
    (text: string, status: DetectionLogEntry["status"] = "info") => {
      setLog((prev) => [...prev, { text, status }]);
    },
    [setLog]
  );

  /** All tool definitions: built-in DEFAULT_TOOLS + user custom tools. */
  const allToolDefs = useCallback(() => {
    const customs = customToolDefs.map((c) => ({
      slug: c.slug,
      name: c.name,
      command: c.command,
      args: c.args,
      icon: c.icon,
      configPath: c.configPath,
      installInstructions: c.installInstructions,
    }));
    // Deduplicate: custom defs with same slug override built-ins
    const builtinSlugs = new Set(customs.map((c) => c.slug));
    const builtins = DEFAULT_TOOLS.filter((t) => !builtinSlugs.has(t.slug));
    return [...builtins, ...customs];
  }, [customToolDefs]);

  /** Hydrate tools from detection cache (instant startup). */
  const hydrateFromCache = useCallback(
    (cache: DetectionCache) => {
      const defs = allToolDefs();
      const tools: Tool[] = defs.map((def) => {
        const cached = cache[def.slug];
        return {
          ...def,
          installed: cached?.installed ?? false,
          version: cached?.version ?? null,
          path: cached?.path ?? null,
        };
      });
      setTools(tools);
      setDetected(true);
    },
    [allToolDefs, setTools, setDetected]
  );

  const detectOne = useCallback(
    async (
      tool: (typeof DEFAULT_TOOLS)[number],
      label?: string
    ): Promise<Tool> => {
      const tag = label ?? tool.name;
      log(`  Checking ${tag} (${tool.command})...`);
      try {
        const result = await invoke<DetectionResult>("detect_tool", {
          command: tool.command,
        });
        if (result.installed) {
          const via =
            result.found_via === "direct" ? "PATH search" : "shell";
          const ver = result.version ? ` ${result.version}` : "";
          log(
            `  ${tag}${ver} \u2014 ${result.path ?? "found"} (via ${via})`,
            "ok"
          );
        } else {
          log(`  ${tag} \u2014 not found`, "warn");
        }
        return {
          ...tool,
          installed: result.installed,
          version: result.version,
          path: result.path,
        };
      } catch (e) {
        log(`  ${tag} \u2014 detection error: ${e}`, "error");
        return { ...tool, installed: false, version: null, path: null };
      }
    },
    [log]
  );

  const detect = useCallback(
    async (opts?: { foreground?: boolean }) => {
      const foreground = opts?.foreground ?? true;

      if (foreground) {
        // Reset state for visible loading screen
        setDetected(false);
        setLog([]);
      }

      // ── Phase 1: Environment ──────────────────────────────────────
      if (foreground) log("Detecting environment...");
      try {
        const env = await invoke<EnvironmentInfo>("detect_environment");
        if (foreground) {
          log(`Platform: ${env.os}`, "ok");
          log(`Shell: ${env.shell_path} (${env.shell_kind})`, "ok");
          log(
            `Search dirs: ${env.extra_dirs.length} extra PATH entries`,
            "info"
          );
        }
      } catch (e) {
        if (foreground) log(`Environment detection failed: ${e}`, "error");
      }

      // ── Phase 2: Detect all tools ─────────────────────────────────
      const defs = allToolDefs();
      const bricksDef = defs.find((t) => t.slug === "bricks")!;
      const optionalDefs = defs.filter((t) => t.slug !== "bricks");

      if (foreground) log("Checking required dependency...");
      const bricksResult = await detectOne(bricksDef, "Bricks CLI (required)");

      if (!bricksResult.installed && foreground) {
        log("Bricks CLI is required but was not found.", "error");
      }

      if (foreground) log("Scanning optional coding agents...");
      const optionalResults: Tool[] = [];
      for (const tool of optionalDefs) {
        optionalResults.push(await detectOne(tool));
      }

      // ── Summary ───────────────────────────────────────────────────
      const allResults = [bricksResult, ...optionalResults];
      const found = allResults.filter((t) => t.installed).length;
      const optionalFound = optionalResults.filter((t) => t.installed).length;

      if (foreground) {
        if (bricksResult.installed) {
          log(
            `Done. Bricks CLI ok, ${optionalFound} optional agent${optionalFound === 1 ? "" : "s"} available.`,
            "ok"
          );
        } else {
          log(
            `Done. ${found}/${allResults.length} tools detected. Bricks CLI missing \u2014 app blocked.`,
            "error"
          );
        }
      }

      // Update detection cache
      const newCache: DetectionCache = {};
      for (const t of allResults) {
        newCache[t.slug] = {
          installed: t.installed,
          version: t.version,
          path: t.path,
          found_via: "detection",
          cached_at: Date.now(),
        };
      }
      setDetectionCache(newCache);

      setTools(allResults);
      setDetected(true);
    },
    [setTools, setDetected, setLog, setDetectionCache, log, detectOne, allToolDefs]
  );

  // Wait for config to load before running detection
  useEffect(() => {
    if (!configLoaded || hasRun.current) return;
    hasRun.current = true;

    const cacheEntries = Object.keys(detectionCache);
    if (cacheEntries.length > 0) {
      // Cache available — hydrate instantly, then refresh in background
      hydrateFromCache(detectionCache);
      detect({ foreground: false });
    } else {
      // No cache (first launch) — run full detection with loading UI
      detect({ foreground: true });
    }
  }, [configLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for manual re-detect requests
  useEffect(() => {
    if (redetectRequested === 0) return;
    detect({ foreground: true });
  }, [redetectRequested]); // eslint-disable-line react-hooks/exhaustive-deps

  return { redetect: () => detect({ foreground: true }) };
}
