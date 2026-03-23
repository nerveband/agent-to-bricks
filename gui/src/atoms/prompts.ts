import { atom } from "jotai";

// --- Mention types ---
export type MentionType =
  | "page"
  | "section"
  | "element"
  | "query"
  | "class"
  | "color"
  | "variable"
  | "component"
  | "media"
  | "template"
  | "form"
  | "loop"
  | "product"
  | "product-category"
  | "product-tag"
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
    prompt: "Build a hero section for @page with a heading, subtext, and call-to-action button. First run `bricks discover --json` to get the site's design system, then generate HTML using the site's CSS variables and push it with `bricks convert html --push PAGE_ID --snapshot --stdin`. {description}",
    category: "build",
    builtin: true,
  },
  {
    id: "contact-form",
    name: "Contact Form",
    description: "Add a contact form section",
    prompt: "Add a contact form section to @page with name, email, message fields, and a submit button. Use `bricks discover --json` to get the design system, generate the HTML, then push with `bricks convert html --push PAGE_ID --snapshot --stdin`. {description}",
    category: "build",
    builtin: true,
  },
  {
    id: "card-grid",
    name: "Card Grid",
    description: "Create a grid of cards (services, features, team)",
    prompt: "Create a responsive card grid on @page. Use `bricks discover --json` for the design system, generate HTML using ACSS grid classes and CSS variables, then push with `bricks convert html --push PAGE_ID --snapshot --stdin`. Content: {description}",
    category: "build",
    builtin: true,
  },
  {
    id: "full-page",
    name: "Full Page",
    description: "Build a complete page layout from scratch",
    prompt: "Build a complete page layout on @page. Run `bricks discover --json` first, then generate a full page with multiple sections (hero, content, CTA, etc.) using the site's CSS variables. Push with `bricks convert html --push PAGE_ID --snapshot --stdin`. Layout: {description}",
    category: "build",
    builtin: true,
  },
  // Edit
  {
    id: "restyle",
    name: "Restyle",
    description: "Change the look and feel of existing elements",
    prompt: "Restyle elements on @page. First run `bricks patch PAGE_ID --list` to see element IDs, then use `bricks patch PAGE_ID -e ELEMENT_ID --set 'key=value'` to update styles. Changes: {description}",
    category: "edit",
    builtin: true,
  },
  {
    id: "make-responsive",
    name: "Make Responsive",
    description: "Fix mobile/tablet layout issues",
    prompt: "Make @page fully responsive. Run `bricks patch PAGE_ID --list --json` to see current elements and their settings, then patch layout properties (display, direction, gap, width) for mobile breakpoints.",
    category: "edit",
    builtin: true,
  },
  {
    id: "apply-classes",
    name: "Apply Classes",
    description: "Apply global classes to elements on a page",
    prompt: "Apply @class to elements on @page. Run `bricks patch PAGE_ID --list` to find element IDs, then `bricks patch PAGE_ID -e ID --set '_cssClasses=CLASS_NAME'` for each element that should get the class.",
    category: "edit",
    builtin: true,
  },
  {
    id: "match-style",
    name: "Match Style",
    description: "Style a page to match another page's look",
    prompt: "Style @page to match: {description}. Use `bricks patch PAGE_ID --list --json` to inspect current elements, then patch their typography, colors, spacing, and classes to match the target style.",
    category: "edit",
    builtin: true,
  },
  // Inspect
  {
    id: "analyze-page",
    name: "Analyze Page",
    description: "Get a summary of what's on a page",
    prompt: "Analyze @page. Run `bricks patch PAGE_ID --list --json` to get the full element tree with settings, then summarize the structure, sections, and design patterns used.",
    category: "inspect",
    builtin: true,
  },
  {
    id: "find-issues",
    name: "Find Issues",
    description: "Check for layout or structure problems",
    prompt: "Inspect @page for issues. Run `bricks patch PAGE_ID --list --json` to get all elements, then check for: missing labels, hardcoded values instead of CSS variables, inconsistent spacing, accessibility gaps, and structural problems.",
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
