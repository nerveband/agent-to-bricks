import { atom } from "jotai";

export interface Tool {
  slug: string;
  name: string;
  command: string;
  args: string[];
  icon: string;
  installed: boolean;
  version: string | null;
  path: string | null;
  configPath: string | null;
  installInstructions: {
    npm?: string;
    brew?: string;
    url?: string;
  };
}

// Bricks CLI is listed first — it's the hard dependency and is checked before
// anything else.  The remaining tools are optional coding agents.
export const DEFAULT_TOOLS: Omit<Tool, "installed" | "version" | "path">[] = [
  {
    slug: "bricks",
    name: "Bricks CLI",
    command: "bricks",
    args: [],
    icon: "Bx",
    configPath: "~/.agent-to-bricks/config.yaml",
    installInstructions: {
      url: "https://agenttobricks.com/getting-started/installation/",
    },
  },
  {
    slug: "claude-code",
    name: "Claude Code",
    command: "claude",
    args: [],
    icon: "C>",
    configPath: "~/.claude/settings.json",
    installInstructions: {
      npm: "npm install -g @anthropic-ai/claude-code",
    },
  },
  {
    slug: "codex",
    name: "Codex",
    command: "codex",
    args: [],
    icon: "Cx",
    configPath: "~/.config/codex/config.yaml",
    installInstructions: {
      npm: "npm install -g @openai/codex",
    },
  },
  {
    slug: "opencode",
    name: "OpenCode",
    command: "opencode",
    args: [],
    icon: "Oc",
    configPath: "~/.config/opencode/config.json",
    installInstructions: {
      url: "https://github.com/opencode-ai/opencode",
    },
  },
];

export const toolsAtom = atom<Tool[]>([]);
// True once the initial detect_tool sweep has finished (prevents flash of gate)
export const toolsDetectedAtom = atom(false);

// Log entries shown on the detection loading screen
export interface DetectionLogEntry {
  text: string;
  status: "info" | "ok" | "warn" | "error";
}
export const detectionLogAtom = atom<DetectionLogEntry[]>([]);
export const activeToolSlugAtom = atom<string | null>(null);

export const activeToolAtom = atom((get) => {
  const slug = get(activeToolSlugAtom);
  if (!slug) return null;
  return get(toolsAtom).find((t) => t.slug === slug) ?? null;
});

// Bricks CLI is a hard dependency — the app cannot function without it.
export const bricksCliAtom = atom((get) => {
  return get(toolsAtom).find((t) => t.slug === "bricks") ?? null;
});

// Per-tool custom flags, keyed by slug → space-separated flags string.
// e.g. { "claude-code": "--dangerously-skip-permissions --verbose" }
export type ToolCustomFlags = Record<string, string>;
export const toolCustomFlagsAtom = atom<ToolCustomFlags>({});

// Per-tool working directory, keyed by slug → path string.
export type ToolWorkingDirs = Record<string, string>;
export const toolWorkingDirsAtom = atom<ToolWorkingDirs>({});

// Per-tool binary path overrides, keyed by slug → absolute path string.
// When set, this path is used instead of the auto-detected one.
export type ToolPaths = Record<string, string>;
export const toolPathsAtom = atom<ToolPaths>({});

// Cached detection results for instant startup on subsequent launches.
export interface DetectionCacheEntry {
  installed: boolean;
  version: string | null;
  path: string | null;
  found_via: string;
  cached_at: number;
}
export type DetectionCache = Record<string, DetectionCacheEntry>;
export const detectionCacheAtom = atom<DetectionCache>({});

// User-added custom tool definitions that persist across restarts.
export interface CustomToolDef {
  slug: string;
  name: string;
  command: string;
  args: string[];
  icon: string;
  configPath: string | null;
  installInstructions: { npm?: string; brew?: string; url?: string };
}
export const customToolDefsAtom = atom<CustomToolDef[]>([]);

// Increment to trigger a foreground re-detection from any component.
export const redetectRequestedAtom = atom(0);
