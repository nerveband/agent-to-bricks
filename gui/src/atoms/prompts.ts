import { atom } from "jotai";

// --- Mention types ---
export type MentionType =
  | "page"
  | "section"
  | "element"
  | "class"
  | "color"
  | "variable"
  | "component"
  | "media";

export interface MentionToken {
  type: MentionType;
  query: string;
  displayName: string;
  resolvedId: string | number | null;
  resolvedData: unknown | null;
  startPos: number;
  endPos: number;
}

// --- Resolved mention (shared by CommandPalette, PromptWorkshop, MentionInput) ---
export interface ResolvedMention {
  type: MentionType;
  id: string | number;
  label: string;
  data?: unknown;
}

// --- Presets (replacing old templates) ---
export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: "build" | "edit" | "manage" | "inspect";
  builtin: boolean;
}

export const BUILTIN_PRESETS: PromptPreset[] = [
  // Build
  {
    id: "generate-section",
    name: "Generate Section",
    description: "AI-generate a new section from a text description",
    prompt:
      "Generate a new section on @page with this description: {description}. Pull existing page structure first, match the site's current styles, then push the changes.",
    category: "build",
    builtin: true,
  },
  {
    id: "generate-page",
    name: "Generate Full Page",
    description: "AI-generate an entire page layout",
    prompt:
      "Build a complete page on @page with these sections: {description}. Pull the current site styles first for consistency, generate all sections, then push.",
    category: "build",
    builtin: true,
  },
  {
    id: "full-page-build",
    name: "Full Page Build",
    description: "Multi-step: snapshot, pull, generate, push",
    prompt:
      "For @page: First create a snapshot backup, then pull current elements, generate new content based on: {description}. Push changes when done.",
    category: "build",
    builtin: true,
  },
  // Edit
  {
    id: "modify-elements",
    name: "Modify Elements",
    description: "Change existing elements on a page",
    prompt:
      "On @page, modify the existing elements: {description}. Pull current state first, make the changes, then push.",
    category: "edit",
    builtin: true,
  },
  {
    id: "restyle-section",
    name: "Restyle Section",
    description: "Update the styling of a section",
    prompt:
      "Restyle @section to: {description}. Reference existing site styles and ACSS classes where available.",
    category: "edit",
    builtin: true,
  },
  {
    id: "convert-html",
    name: "Convert HTML",
    description: "Transform HTML into Bricks elements",
    prompt:
      "Convert the HTML file at {filePath} into Bricks elements on @page using the bricks CLI convert command.",
    category: "edit",
    builtin: true,
  },
  // Manage
  {
    id: "pull-page",
    name: "Pull Page",
    description: "Download page elements from your site",
    prompt:
      "Pull all Bricks elements from @page using the bricks CLI. Save the output as JSON.",
    category: "manage",
    builtin: true,
  },
  {
    id: "push-page",
    name: "Push Page",
    description: "Upload local changes to your site",
    prompt:
      "Push the local Bricks element changes back to @page using the bricks CLI.",
    category: "manage",
    builtin: true,
  },
  {
    id: "snapshot-page",
    name: "Snapshot Page",
    description: "Backup current page state",
    prompt:
      "Create a snapshot backup of @page using the bricks CLI before making changes.",
    category: "manage",
    builtin: true,
  },
  {
    id: "rollback-page",
    name: "Rollback Page",
    description: "Restore page to a previous snapshot",
    prompt:
      "Restore @page to its most recent snapshot using the bricks CLI rollback command.",
    category: "manage",
    builtin: true,
  },
  // Inspect
  {
    id: "inspect-page",
    name: "Inspect Page",
    description: "View all elements on a page",
    prompt:
      "List and describe all Bricks elements on @page. Show the element tree structure with types and labels.",
    category: "inspect",
    builtin: true,
  },
  {
    id: "check-styles",
    name: "Check Styles",
    description: "View site styles, colors, and variables",
    prompt:
      "Show the current theme styles, color palette, and CSS variables for the connected site using the bricks CLI.",
    category: "inspect",
    builtin: true,
  },
];

export const customPresetsAtom = atom<PromptPreset[]>([]);

export const allPresetsAtom = atom((get) => [
  ...BUILTIN_PRESETS,
  ...get(customPresetsAtom),
]);

// --- Prompt History ---
export interface PromptHistoryEntry {
  text: string;
  composedText: string;
  timestamp: number;
  mentions: { type: MentionType; displayName: string }[];
}

export const promptHistoryAtom = atom<PromptHistoryEntry[]>([]);

// --- Resolved mention cache ---
export interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

export const mentionCacheAtom = atom<Record<string, CacheEntry>>({});

// Cache TTL: 5 minutes
export const CACHE_TTL_MS = 5 * 60 * 1000;
