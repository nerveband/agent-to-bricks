import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MENTION_TYPES } from "../../hooks/useMentionParser";
import type { SearchResult } from "../../hooks/useMentionSearch";
import type { MentionType } from "../../atoms/prompts";
import { MagnifyingGlass, X, ArrowLeft } from "@phosphor-icons/react";

const TYPE_LABELS: Record<string, string> = {
  page: "Pages",
  section: "Sections",
  element: "Elements",
  class: "Global Classes",
  color: "Colors",
  variable: "CSS Variables",
  component: "Components",
  media: "Media",
  template: "Templates",
  form: "Forms",
  loop: "Loops (Query)",
  condition: "Conditions",
};

const EMPTY_MESSAGES: Record<string, string> = {
  page: "No pages found",
  section: "No sections found on this page",
  element: "No elements found on this page",
  class: "No global classes defined in Bricks",
  color: "No colors found on this site",
  variable: "No CSS variables found on this site",
  component: "No reusable components (templates) found",
  media: "No media files in the library",
  template: "No Bricks templates found",
  form: "No form elements found on any page",
  loop: "No query loop (Posts) elements found on any page",
  condition: "No conditions available",
};

// Step 1 messages (before page is selected)
const STEP1_EMPTY_MESSAGES: Record<string, string> = {
  section: "No pages found — pick a page to browse sections",
  element: "No pages found — pick a page to browse elements",
};

/** Check if a string looks like a CSS color value */
function isColorValue(value: string): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl") ||
    v.startsWith("oklch") || v.startsWith("oklab");
}

interface MentionAutocompleteProps {
  mode: "type-picker" | "search";
  mentionType: MentionType | null;
  results: SearchResult[];
  loading: boolean;
  selectedIndex: number;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSelectType: (type: MentionType) => void;
  onSelectResult: (result: SearchResult) => void;
  onDismiss: () => void;
  onBack?: () => void;
  position: { bottom: number; left: number; width: number };
  typeFilter?: string;
  sectionPageName?: string;
}

export function MentionAutocomplete({
  mode,
  mentionType,
  results,
  loading,
  selectedIndex,
  searchQuery,
  onSearchQueryChange,
  onSelectType,
  onSelectResult,
  onDismiss,
  onBack,
  position,
  typeFilter = "",
  sectionPageName,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [hoveredImageUrl, setHoveredImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector("[data-active]");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Update image preview when keyboard navigation changes selection
  useEffect(() => {
    if (mode === "search" && results[selectedIndex]?.imageUrl) {
      setHoveredImageUrl(results[selectedIndex].imageUrl!);
    } else if (mode === "search") {
      setHoveredImageUrl(null);
    }
  }, [selectedIndex, mode, results]);

  // Auto-focus search input when entering search mode
  useEffect(() => {
    if (mode === "search") {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [mode, mentionType]);

  // Filter types based on typeFilter (with alias fallback)
  const lowerFilter = typeFilter.toLowerCase();
  let filteredTypes = lowerFilter
    ? MENTION_TYPES.filter((t) => t.startsWith(lowerFilter))
    : MENTION_TYPES;
  // If no prefix match, check common aliases (e.g. "sections" → "section")
  if (filteredTypes.length === 0 && lowerFilter) {
    const aliasTarget = lowerFilter.endsWith("s")
      ? MENTION_TYPES.find((t) => t === lowerFilter.slice(0, -1))
      : undefined;
    if (aliasTarget) filteredTypes = [aliasTarget];
  }

  // Determine header for section/element two-step flow
  const isSecondStep = (mentionType === "section" || mentionType === "element") && sectionPageName;
  const headerLabel = isSecondStep
    ? `${sectionPageName} › ${TYPE_LABELS[mentionType ?? ""] ?? mentionType}`
    : (TYPE_LABELS[mentionType ?? ""] ?? mentionType);

  // Detect if we're showing colors (to render swatches)
  const isColorType = mentionType === "color";

  return (
    <div
      ref={listRef}
      className="fixed z-[9999] rounded-xl border overflow-hidden mention-autocomplete"
      role="dialog"
      aria-label={mode === "type-picker" ? "Select reference type" : `Search ${headerLabel}`}
      style={{
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        background: "var(--surface-dark)",
        backdropFilter: "blur(50px) saturate(180%)",
        borderColor: "var(--border-subtle)",
        boxShadow: "var(--shadow-floating)",
        maxHeight: `min(400px, calc(100vh - ${position.bottom}px - 16px))`,
        overflowY: "auto",
      }}
    >
      {mode === "type-picker" ? (
        <div className="flex flex-col">
          <div
            className="text-[9px] font-bold tracking-[0.15em] uppercase px-4 py-3 border-b white-glass"
            style={{ color: "var(--fg-subtle)", borderColor: "var(--border-subtle)" }}
          >
            {typeFilter ? `Matching "@${typeFilter}"` : "Reference Type"}
          </div>
          <div className="p-2 flex flex-col gap-[2px]" role="listbox" aria-label="Reference types">
          {filteredTypes.length === 0 && (
            <div
              className="px-2 py-2 text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              No matching types
            </div>
          )}
          {filteredTypes.map((t, i) => {
            const isSelected = i === selectedIndex;
            return (
              <button
                key={t}
                id={`mention-type-${t}`}
                role="option"
                aria-selected={isSelected}
                data-active={isSelected ? "" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-left transition-all group relative overflow-hidden ${
                  isSelected
                    ? "reference-active border shadow-[var(--shadow-glow)]"
                    : "border border-transparent hover:bg-[var(--white-glass)] hover:border-[var(--border-subtle)]"
                }`}
                style={{
                  color: isSelected ? "var(--fg)" : "var(--fg-muted)",
                }}
                onClick={() => onSelectType(t)}
              >
                {/* Concept: 4px yellow left bar on active item */}
                {isSelected && <div className="mention-autocomplete-active-bar" />}
                <span
                  className="font-mono text-sm font-bold mt-[2px]"
                  style={{ color: isSelected ? "var(--yellow)" : "var(--fg-subtle)" }}
                >@</span>
                <span className={isSelected ? "font-semibold" : "group-hover:text-[var(--fg)]"}>
                  {TYPE_LABELS[t] ?? t}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      ) : (
        <div className="p-2">
          {/* Header with type label, back button (for sections), and close button */}
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-1.5">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-0.5 rounded hover:opacity-80"
                  style={{ color: "var(--fg-muted)" }}
                  title="Back to page list"
                >
                  <ArrowLeft size={12} />
                </button>
              )}
              <span
                className="text-[11px] uppercase tracking-wider"
                style={{ color: "var(--fg-muted)" }}
              >
                {headerLabel}
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="p-0.5 rounded hover:opacity-80"
              style={{ color: "var(--fg-muted)" }}
              aria-label="Close"
              title="Close autocomplete (Esc)"
            >
              <X size={12} />
            </button>
          </div>

          {/* Search input */}
          <div className="relative px-1 pb-1">
            <MagnifyingGlass
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--fg-muted)" }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                // Let ArrowUp/Down/Enter/Escape bubble to parent for list navigation
                if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
                  return;
                }
                e.stopPropagation();
              }}
              placeholder={
                (mentionType === "section" || mentionType === "element") && !sectionPageName
                  ? `Search pages to pick ${mentionType === "section" ? "sections" : "elements"} from...`
                  : `Search ${(TYPE_LABELS[mentionType ?? ""] ?? "items").toLowerCase()}...`
              }
              className="w-full pl-6 pr-2 py-1.5 rounded-lg border text-[12px] glass-input"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-controls="mention-results-list"
              aria-activedescendant={results[selectedIndex] ? `mention-option-${selectedIndex}` : undefined}
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--fg)",
              }}
            />
          </div>

          {/* Hint for section/element first step */}
          {(mentionType === "section" || mentionType === "element") && !sectionPageName && (
            <div
              className="px-2 py-1 text-[11px] mb-1"
              style={{ color: "var(--accent)" }}
            >
              Step 1: Pick a page, then choose {mentionType === "section" ? "sections" : "elements"} within it
            </div>
          )}

          {/* Results */}
          {loading && (
            <div
              className="px-2 py-3 text-[13px]"
              style={{ color: "var(--fg-muted)" }}
              role="status"
            >
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div
              className="px-2 py-3 text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              {searchQuery
              ? "No results found"
              : (!sectionPageName && STEP1_EMPTY_MESSAGES[mentionType ?? ""])
                || EMPTY_MESSAGES[mentionType ?? ""]
                || "No items available"}
            </div>
          )}

          {/* Image preview floating panel — portaled to avoid overflow clipping */}
          {hoveredImageUrl && listRef.current && createPortal(
            <div
              className="fixed z-[9998] rounded-xl border overflow-hidden pointer-events-none"
              style={{
                top: listRef.current.getBoundingClientRect().top,
                left: listRef.current.getBoundingClientRect().left - 248,
                width: 240,
                background: "var(--surface-dark)",
                backdropFilter: "blur(50px) saturate(180%)",
                borderColor: "var(--border-subtle)",
                boxShadow: "var(--shadow-floating)",
              }}
            >
              <img
                src={hoveredImageUrl}
                alt="Preview"
                loading="lazy"
                className="w-full h-auto"
                style={{ maxHeight: 280, objectFit: "contain", background: "var(--bg)" }}
              />
            </div>,
            document.body
          )}

          <div id="mention-results-list" role="listbox" aria-label={`${headerLabel} results`}>
          {results.map((r, i) => {
            // For colors, the sublabel contains the color value
            const colorValue = isColorType && r.sublabel && isColorValue(r.sublabel) ? r.sublabel : null;

            return (
            <button
              key={`${r.id}`}
              id={`mention-option-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              data-active={i === selectedIndex ? "" : undefined}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[13px] transition-all flex items-center gap-2 border border-transparent hover:bg-[var(--white-glass)] hover:border-[var(--border-subtle)]"
              style={{
                background: i === selectedIndex ? "var(--white-glass)" : undefined,
                borderColor: i === selectedIndex ? "var(--border-subtle)" : undefined,
                color: "var(--fg)",
              }}
              onClick={() => onSelectResult(r)}
              onMouseEnter={() => r.imageUrl && setHoveredImageUrl(r.imageUrl)}
              onMouseLeave={() => setHoveredImageUrl(null)}
            >
              {/* Color swatch */}
              {colorValue && (
                <span
                  className="w-5 h-5 rounded shrink-0 border"
                  style={{
                    backgroundColor: colorValue,
                    borderColor: "var(--border)",
                  }}
                  aria-hidden="true"
                />
              )}
              {/* Small inline thumbnail for images */}
              {r.imageUrl && (
                <img
                  src={r.imageUrl}
                  alt=""
                  loading="lazy"
                  className="w-8 h-8 rounded object-cover shrink-0"
                  style={{ border: "1px solid var(--border)" }}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate">{r.label}</div>
                {r.sublabel && (
                  <div
                    className="text-[11px] truncate"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {r.sublabel}
                  </div>
                )}
              </div>
            </button>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
