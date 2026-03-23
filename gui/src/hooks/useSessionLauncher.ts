import { useSetAtom, useAtom } from "jotai";
import { sessionsAtom, activeSessionIdAtom } from "../atoms/sessions";
import { activeToolSlugAtom, toolCustomFlagsAtom, toolWorkingDirsAtom, toolPathsAtom, bricksCliAtom, type Tool } from "../atoms/tools";
import { activeSiteAtom, sessionPrePromptAtom, SESSION_API_KEY_PLACEHOLDER, DEFAULT_SESSION_PREPROMPT, type SiteEntry } from "../atoms/app";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState, useRef } from "react";
import { writeToActivePtyWhenReady } from "../atoms/ptyBridge";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
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

/** Fetch a compact design system summary from the site for context injection. */
export async function fetchDesignSystemSummary(siteUrl: string, apiKey: string): Promise<string> {
  try {
    const [fwResult, varsResult] = await Promise.all([
      invoke<Record<string, unknown>>("get_site_styles", { siteUrl, apiKey }),
      invoke<Record<string, unknown>>("get_site_variables", { siteUrl, apiKey }),
    ]);

    const parts: string[] = ["\n## Site Design System"];

    // Extract color palette
    const palette = fwResult?.colorPalette;
    if (Array.isArray(palette) && palette.length > 0) {
      const colors = palette
        .filter((c: any) => c?.color && c?.name)
        .slice(0, 20)
        .map((c: any) => `${c.name}: ${c.color}`)
        .join(", ");
      if (colors) parts.push(`Colors: ${colors}`);
    }

    // Extract CSS variables (key ones)
    const vars = varsResult?.variables;
    if (Array.isArray(vars) && vars.length > 0) {
      const varNames = vars
        .filter((v: any) => v?.name)
        .map((v: any) => v.name as string);

      const spacing = varNames.filter(n => n.includes("space") || n.includes("gap")).slice(0, 10);
      const typo = varNames.filter(n => n.includes("text") || n.includes("--h") || n.includes("font")).slice(0, 10);
      const colorVars = varNames.filter(n => n.includes("primary") || n.includes("secondary") || n.includes("accent") || n.includes("base") || n.includes("neutral")).slice(0, 10);

      if (colorVars.length) parts.push(`Color vars: ${colorVars.join(", ")}`);
      if (spacing.length) parts.push(`Spacing vars: ${spacing.join(", ")}`);
      if (typo.length) parts.push(`Typography vars: ${typo.join(", ")}`);
    }

    return parts.length > 1 ? parts.join("\n") + "\n" : "";
  } catch {
    return "";
  }
}

/**
 * Run `bricks init --skip-test` in a directory if the skill file doesn't exist.
 * Best-effort — failure is silent and non-blocking.
 */
async function ensureSkillInstalled(bricksPath: string, cwd: string): Promise<boolean> {
  try {
    // Check if skill already exists
    const skillPath = `${cwd}/.claude/skills/agent-to-bricks/SKILL.md`;
    const exists = await invoke<boolean>("config_exists", { path: skillPath });
    if (exists) return false;

    // Run bricks init --skip-test via Tauri command
    const ok = await invoke<boolean>("run_bricks_init", { bricksPath, cwd });
    return ok;
  } catch {
    return false;
  }
}

/** Build the initial context prompt for a coding tool session using the user's template. */
export function buildSiteContextPrompt(site: SiteEntry | null, template?: string, abilities?: AbilityInfo[], designSystem?: string): string {
  if (!site) return "";
  const tmpl = template || DEFAULT_SESSION_PREPROMPT;

  return tmpl
    .replace(/\{site_url\}/g, site.site_url)
    .replace(/\{api_key\}/g, SESSION_API_KEY_PLACEHOLDER)
    .replace(/\{site_name\}/g, site.name)
    .replace(/\{environment\}/g, site.environment ?? "")
    .replace(/\{design_system\}/g, designSystem ?? "")
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
  const bricksCli = useAtomValue(bricksCliAtom);

  // Cache design system per site URL to avoid refetching
  const designSystemCache = useRef<Record<string, string>>({});

  // Resolve home directory once for default cwd
  const [defaultDir, setDefaultDir] = useState<string | undefined>();
  useEffect(() => {
    homeDir().then((d) => setDefaultDir(d)).catch(() => {});
  }, []);

  const launch = useCallback(
    async (tool: Tool, cwd?: string) => {
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
        // Auto-install skill file if bricks CLI is available and dir is set
        const bricksPath = toolPaths["bricks"] || bricksCli?.path || "bricks";
        if (dir && bricksPath) {
          ensureSkillInstalled(bricksPath, dir).catch(() => {});
        }

        // Fetch design system (cached per site URL)
        let designSystem = "";
        const cacheKey = site.site_url;
        if (designSystemCache.current[cacheKey]) {
          designSystem = designSystemCache.current[cacheKey];
        } else {
          designSystem = await fetchDesignSystemSummary(site.site_url, site.api_key);
          if (designSystem) {
            designSystemCache.current[cacheKey] = designSystem;
          }
        }

        const contextPrompt = buildSiteContextPrompt(site, promptTemplate, abilities, designSystem);
        if (contextPrompt) {
          // Wait for PTY to be ready, then send the context prompt
          writeToActivePtyWhenReady(contextPrompt + "\n", 15000);
        }
      }
    },
    [setSessions, setActiveSessionId, setActiveToolSlug, toolFlags, toolDirs, toolPaths, defaultDir, site, promptTemplate, abilities, bricksCli]
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
