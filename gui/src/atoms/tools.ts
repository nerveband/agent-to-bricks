import { atom } from "jotai";

export interface Tool {
  slug: string;
  name: string;
  command: string;
  args: string[];
  icon: string;
  installed: boolean;
  version: string | null;
  configPath: string | null;
  installInstructions: {
    npm?: string;
    brew?: string;
    url?: string;
  };
}

export const DEFAULT_TOOLS: Omit<Tool, "installed" | "version">[] = [
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
  {
    slug: "bricks",
    name: "Bricks CLI",
    command: "bricks",
    args: [],
    icon: "Bx",
    configPath: "~/.agent-to-bricks/config.yaml",
    installInstructions: {
      url: "https://agentstobricks.com/getting-started/installation/",
    },
  },
];

export const toolsAtom = atom<Tool[]>([]);
export const activeToolSlugAtom = atom<string | null>(null);

export const activeToolAtom = atom((get) => {
  const slug = get(activeToolSlugAtom);
  if (!slug) return null;
  return get(toolsAtom).find((t) => t.slug === slug) ?? null;
});

// Per-tool custom flags, keyed by slug → space-separated flags string.
// e.g. { "claude-code": "--dangerously-skip-permissions --verbose" }
export type ToolCustomFlags = Record<string, string>;
export const toolCustomFlagsAtom = atom<ToolCustomFlags>({});

// Per-tool working directory, keyed by slug → path string.
export type ToolWorkingDirs = Record<string, string>;
export const toolWorkingDirsAtom = atom<ToolWorkingDirs>({});
