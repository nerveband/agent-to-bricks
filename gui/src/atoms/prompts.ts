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
  | "media"
  | "template"
  | "form"
  | "loop"
  | "condition";

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
    id: "hero-section",
    name: "Hero Section",
    description: "Build a hero section with heading, text, and CTA",
    prompt: "Build a hero section on @page with a heading, subtext, and call-to-action button. {description}",
    category: "build",
    builtin: true,
  },
  {
    id: "contact-form",
    name: "Contact Form",
    description: "Add a contact form section",
    prompt: "Add a contact form section to @page with name, email, message fields, and a submit button. {description}",
    category: "build",
    builtin: true,
  },
  {
    id: "card-grid",
    name: "Card Grid",
    description: "Create a grid of cards (services, features, team)",
    prompt: "Create a responsive card grid on @page for: {description}",
    category: "build",
    builtin: true,
  },
  {
    id: "full-page",
    name: "Full Page",
    description: "Build a complete page layout from scratch",
    prompt: "Build a complete page layout on @page with: {description}",
    category: "build",
    builtin: true,
  },
  // Edit
  {
    id: "restyle",
    name: "Restyle",
    description: "Change the look and feel of a section",
    prompt: "Restyle @section to: {description}",
    category: "edit",
    builtin: true,
  },
  {
    id: "make-responsive",
    name: "Make Responsive",
    description: "Fix mobile/tablet layout issues",
    prompt: "Make @page fully responsive. Fix any layout issues on mobile and tablet breakpoints.",
    category: "edit",
    builtin: true,
  },
  {
    id: "apply-classes",
    name: "Apply Classes",
    description: "Apply global classes to elements on a page",
    prompt: "Apply @class to relevant elements on @page.",
    category: "edit",
    builtin: true,
  },
  {
    id: "match-style",
    name: "Match Style",
    description: "Style a page to match another page's look",
    prompt: "Style @page to match the design patterns of: {description}",
    category: "edit",
    builtin: true,
  },
  // Inspect
  {
    id: "analyze-page",
    name: "Analyze Page",
    description: "Get a summary of what's on a page",
    prompt: "Analyze @page and give me a summary of its structure, sections, and elements.",
    category: "inspect",
    builtin: true,
  },
  {
    id: "find-issues",
    name: "Find Issues",
    description: "Check for layout or structure problems",
    prompt: "Inspect @page for any structural issues, missing elements, or layout problems.",
    category: "inspect",
    builtin: true,
  },
];

export const customPresetsAtom = atom<PromptPreset[]>([]);

/** IDs of built-in presets the user has deleted/hidden */
export const hiddenPresetIdsAtom = atom<string[]>([]);

/** Overrides for built-in presets (rename, edit prompt) keyed by preset ID */
export const presetOverridesAtom = atom<Record<string, Partial<Pick<PromptPreset, "name" | "prompt" | "description">>>>({});

export const allPresetsAtom = atom((get) => {
  const hidden = new Set(get(hiddenPresetIdsAtom));
  const overrides = get(presetOverridesAtom);
  const builtins = BUILTIN_PRESETS
    .filter((p) => !hidden.has(p.id))
    .map((p) => overrides[p.id] ? { ...p, ...overrides[p.id] } : p);
  return [...builtins, ...get(customPresetsAtom)];
});

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
