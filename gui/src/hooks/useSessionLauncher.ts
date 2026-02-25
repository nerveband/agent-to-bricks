import { useSetAtom, useAtom } from "jotai";
import { sessionsAtom, activeSessionIdAtom } from "../atoms/sessions";
import { activeToolSlugAtom, toolCustomFlagsAtom, toolWorkingDirsAtom, type Tool } from "../atoms/tools";
import { activeSiteAtom, sessionPrePromptAtom, type SiteEntry } from "../atoms/app";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { writeToActivePtyWhenReady } from "../atoms/ptyBridge";
import { homeDir } from "@tauri-apps/api/path";

/**
 * Parse a flags string into an args array, respecting quoted values.
 * e.g. '--model "claude-4" --verbose' → ['--model', '"claude-4"', '--verbose']
 */
function parseFlags(flags: string): string[] {
  return flags.trim().split(/\s+/).filter(Boolean);
}

/** Build the initial context prompt for a coding tool session using the user's template. */
export function buildSiteContextPrompt(site: SiteEntry | null, template?: string): string {
  if (!site) return "";
  const tmpl = template || `You are a web developer working with a Bricks Builder WordPress site ({environment}).
Site: {site_url}
API Key: {api_key}
The bricks CLI is available. Use \`bricks\` commands to pull, push, generate, and modify page elements.
Use the API key with the X-ATB-Key header when making API calls to the site.`;

  return tmpl
    .replace(/\{site_url\}/g, site.site_url)
    .replace(/\{api_key\}/g, site.api_key)
    .replace(/\{site_name\}/g, site.name)
    .replace(/\{environment\}/g, site.environment ?? "");
}

export function useSessionLauncher() {
  const [, setSessions] = useAtom(sessionsAtom);
  const setActiveSessionId = useSetAtom(activeSessionIdAtom);
  const setActiveToolSlug = useSetAtom(activeToolSlugAtom);
  const [toolFlags] = useAtom(toolCustomFlagsAtom);
  const [toolDirs] = useAtom(toolWorkingDirsAtom);
  const site = useAtomValue(activeSiteAtom);
  const promptTemplate = useAtomValue(sessionPrePromptAtom);

  // Resolve home directory once for default cwd
  const [defaultDir, setDefaultDir] = useState<string | undefined>();
  useEffect(() => {
    homeDir().then((d) => setDefaultDir(d)).catch(() => {});
  }, []);

  const launch = useCallback(
    (tool: Tool, cwd?: string) => {
      const customFlags = toolFlags[tool.slug] ?? "";
      const mergedArgs = [...tool.args, ...parseFlags(customFlags)];
      const dir = cwd || toolDirs[tool.slug] || defaultDir;

      const id = crypto.randomUUID();
      const session = {
        id,
        toolSlug: tool.slug,
        displayName: tool.name,
        command: tool.command,
        args: mergedArgs,
        cwd: dir,
        status: "running" as const,
        startedAt: Date.now(),
      };
      setSessions((prev) => [...prev, session]);
      setActiveSessionId(id);
      setActiveToolSlug(tool.slug);

      // Send initial context prompt to coding tool sessions (not plain terminals)
      if (tool.command && site) {
        const contextPrompt = buildSiteContextPrompt(site, promptTemplate);
        if (contextPrompt) {
          // Wait for PTY to be ready, then send the context prompt
          writeToActivePtyWhenReady(contextPrompt + "\n", 15000);
        }
      }
    },
    [setSessions, setActiveSessionId, setActiveToolSlug, toolFlags, toolDirs, defaultDir, site, promptTemplate]
  );

  /** Launch a plain terminal with no tool command. */
  const launchTerminal = useCallback(
    (cwd?: string) => {
      const id = crypto.randomUUID();
      const session = {
        id,
        toolSlug: "terminal",
        displayName: "Terminal",
        command: "",
        args: [] as string[],
        cwd: cwd || defaultDir,
        status: "running" as const,
        startedAt: Date.now(),
      };
      setSessions((prev) => [...prev, session]);
      setActiveSessionId(id);
      setActiveToolSlug(null);
    },
    [setSessions, setActiveSessionId, setActiveToolSlug, defaultDir]
  );

  return { launch, launchTerminal };
}
