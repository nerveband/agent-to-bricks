import { useEffect, useCallback } from "react";
import { useSetAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import {
  toolsAtom,
  toolsDetectedAtom,
  detectionLogAtom,
  DEFAULT_TOOLS,
  type Tool,
  type DetectionLogEntry,
} from "../atoms/tools";

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

  const log = useCallback(
    (text: string, status: DetectionLogEntry["status"] = "info") => {
      setLog((prev) => [...prev, { text, status }]);
    },
    [setLog]
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
        };
      } catch (e) {
        log(`  ${tag} \u2014 detection error: ${e}`, "error");
        return { ...tool, installed: false, version: null };
      }
    },
    [log]
  );

  const detect = useCallback(async () => {
    // Reset state
    setDetected(false);
    setLog([]);

    // ── Phase 1: Environment ──────────────────────────────────────
    log("Detecting environment...");
    try {
      const env = await invoke<EnvironmentInfo>("detect_environment");
      log(`Platform: ${env.os}`, "ok");
      log(`Shell: ${env.shell_path} (${env.shell_kind})`, "ok");
      log(
        `Search dirs: ${env.extra_dirs.length} extra PATH entries`,
        "info"
      );
    } catch (e) {
      log(`Environment detection failed: ${e}`, "error");
    }

    // ── Phase 2: Bricks CLI (required) ────────────────────────────
    // This is checked first because it's a hard dependency.
    // If it's missing the gate will block the app.
    const bricksDef = DEFAULT_TOOLS.find((t) => t.slug === "bricks")!;
    const optionalTools = DEFAULT_TOOLS.filter((t) => t.slug !== "bricks");

    log("Checking required dependency...");
    const bricksResult = await detectOne(bricksDef, "Bricks CLI (required)");

    if (!bricksResult.installed) {
      log(
        "Bricks CLI is required but was not found.",
        "error"
      );
    }

    // ── Phase 3: Optional coding agents ───────────────────────────
    log("Scanning optional coding agents...");
    const optionalResults: Tool[] = [];
    for (const tool of optionalTools) {
      optionalResults.push(await detectOne(tool));
    }

    // ── Summary ───────────────────────────────────────────────────
    const allResults = [bricksResult, ...optionalResults];
    const found = allResults.filter((t) => t.installed).length;
    const optionalFound = optionalResults.filter((t) => t.installed).length;

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

    setTools(allResults);
    setDetected(true);
  }, [setTools, setDetected, setLog, log, detectOne]);

  useEffect(() => {
    detect();
  }, [detect]);

  return { redetect: detect };
}
