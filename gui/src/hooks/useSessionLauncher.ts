import { useSetAtom, useAtom } from "jotai";
import { sessionsAtom, activeSessionIdAtom } from "../atoms/sessions";
import { activeToolSlugAtom, toolCustomFlagsAtom, toolWorkingDirsAtom, toolPathsAtom, type Tool } from "../atoms/tools";
import { activeSiteAtom, sessionPrePromptAtom, type SiteEntry } from "../atoms/app";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { writeToActivePtyWhenReady } from "../atoms/ptyBridge";
import { homeDir } from "@tauri-apps/api/path";
import type { AbilityInfo } from "./useAbilities";
import { useAbilities } from "./useAbilities";

/**
 * Parse a flags string into an args array, respecting quoted values.
 * e.g. '--model "claude-4" --verbose' → ['--model', '"claude-4"', '--verbose']
 */
function parseFlags(flags: string): string[] {
  return flags.trim().split(/\s+/).filter(Boolean);
}

/** Format a list of abilities into a text block suitable for injection into the session pre-prompt. */
export function formatAbilitiesBlock(abilities: AbilityInfo[]): string {
  if (abilities.length === 0) return '';

  const grouped = abilities.reduce<Record<string, AbilityInfo[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const atbCount = abilities.filter(a => a.name.startsWith('agent-bricks/')).length;
  const thirdPartyCount = abilities.length - atbCount;

  let block = `\n\n## WordPress Abilities (${abilities.length} total`;
  if (atbCount > 0 && thirdPartyCount > 0) {
    block += `, ${atbCount} built-in, ${thirdPartyCount} third-party`;
  }
  block += `)

WordPress 6.9+ lets plugins register "abilities" — named actions you can discover and
execute via a standard REST API. Each has typed inputs/outputs and permission checks.

Why this matters: beyond the bricks CLI commands, you can also call abilities from other
plugins installed on this site (SEO, e-commerce, forms, etc.) without any extra setup.

When to use abilities vs. the bricks CLI:
- For Bricks page editing (elements, snapshots, classes): use \`bricks\` CLI commands —
  they handle optimistic locking and are purpose-built.
- For anything outside Bricks (SEO, products, forms): use abilities — they're the only way.
- To discover what the site can do: \`bricks abilities list\`

How to call: POST /wp-json/wp-abilities/v1/{name}/run with {"input": {...}}
Read-only abilities also accept GET. Auth: X-ATB-Key header.
`;

  for (const [cat, items] of Object.entries(grouped).sort()) {
    block += `\n[${cat}]\n`;
    for (const a of items) {
      const method = a.annotations?.readonly ? 'GET ' : 'POST';
      block += `  ${method} ${a.name} — ${a.label}\n`;
      if (a.description) {
        block += `       ${a.description}\n`;
      }
    }
  }
  return block;
}

/** Build the initial context prompt for a coding tool session using the user's template. */
export function buildSiteContextPrompt(site: SiteEntry | null, template?: string, abilities?: AbilityInfo[]): string {
  if (!site) return "";
  const tmpl = template || `You are a web developer working with a Bricks Builder WordPress site ({environment}).
Site: {site_url}
API Key: {api_key}
The bricks CLI is available. Use \`bricks\` commands to pull, push, generate, and modify page elements.
Use the API key with the X-ATB-Key header when making API calls to the site.{abilities_block}`;

  return tmpl
    .replace(/\{site_url\}/g, site.site_url)
    .replace(/\{api_key\}/g, site.api_key)
    .replace(/\{site_name\}/g, site.name)
    .replace(/\{environment\}/g, site.environment ?? "")
    .replace(/\{abilities_block\}/g, formatAbilitiesBlock(abilities ?? []));
}

export function useSessionLauncher() {
  const [, setSessions] = useAtom(sessionsAtom);
  const setActiveSessionId = useSetAtom(activeSessionIdAtom);
  const setActiveToolSlug = useSetAtom(activeToolSlugAtom);
  const [toolFlags] = useAtom(toolCustomFlagsAtom);
  const [toolDirs] = useAtom(toolWorkingDirsAtom);
  const [toolPaths] = useAtom(toolPathsAtom);
  const site = useAtomValue(activeSiteAtom);
  const promptTemplate = useAtomValue(sessionPrePromptAtom);
  const { abilities } = useAbilities();

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
      // Resolve binary: user override > detected path > command name
      const resolvedCommand = toolPaths[tool.slug] || tool.path || tool.command;

      const id = crypto.randomUUID();
      const session = {
        id,
        toolSlug: tool.slug,
        displayName: tool.name,
        command: resolvedCommand,
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
        const contextPrompt = buildSiteContextPrompt(site, promptTemplate, abilities);
        if (contextPrompt) {
          // Wait for PTY to be ready, then send the context prompt
          writeToActivePtyWhenReady(contextPrompt + "\n", 15000);
        }
      }
    },
    [setSessions, setActiveSessionId, setActiveToolSlug, toolFlags, toolDirs, toolPaths, defaultDir, site, promptTemplate, abilities]
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
