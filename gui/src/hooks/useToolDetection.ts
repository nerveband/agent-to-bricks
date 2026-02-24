import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { toolsAtom, DEFAULT_TOOLS, type Tool } from "../atoms/tools";

interface DetectionResult {
  command: string;
  installed: boolean;
  version: string | null;
  path: string | null;
}

export function useToolDetection() {
  const setTools = useSetAtom(toolsAtom);

  useEffect(() => {
    async function detect() {
      const results: Tool[] = await Promise.all(
        DEFAULT_TOOLS.map(async (tool) => {
          try {
            const result = await invoke<DetectionResult>("detect_tool", {
              command: tool.command,
            });
            return {
              ...tool,
              installed: result.installed,
              version: result.version,
            };
          } catch {
            return {
              ...tool,
              installed: false,
              version: null,
            };
          }
        })
      );
      setTools(results);
    }
    detect();
  }, [setTools]);
}
