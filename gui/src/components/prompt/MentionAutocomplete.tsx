import { useState, useEffect, useRef } from "react";
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

  // Determine header for section flow
  const isSecondStepSection = mentionType === "section" && sectionPageName;
  const headerLabel = isSecondStepSection
    ? `${sectionPageName} › Sections`
    : (TYPE_LABELS[mentionType ?? ""] ?? mentionType);

  return (
    <div
      ref={listRef}
      className="fixed z-[9999] rounded-xl border overflow-hidden mention-autocomplete"
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
          <div className="p-2 flex flex-col gap-[2px]">
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
                mentionType === "section" && !sectionPageName
                  ? "Search pages to pick sections from..."
                  : `Search ${(TYPE_LABELS[mentionType ?? ""] ?? "items").toLowerCase()}...`
              }
              className="w-full pl-6 pr-2 py-1.5 rounded-lg border text-[12px] glass-input"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--fg)",
              }}
            />
          </div>

          {/* Hint for section first step */}
          {mentionType === "section" && !sectionPageName && (
            <div
              className="px-2 py-1 text-[11px] mb-1"
              style={{ color: "var(--accent)" }}
            >
              Step 1: Pick a page, then choose sections within it
            </div>
          )}

          {/* Results */}
          {loading && (
            <div
              className="px-2 py-3 text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div
              className="px-2 py-3 text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              {searchQuery ? "No results found" : "No items available — check site connection"}
            </div>
          )}

          {/* Image preview floating panel */}
          {hoveredImageUrl && (
            <div
              className="absolute rounded-xl border overflow-hidden"
              style={{
                right: "calc(100% + 8px)",
                top: 8,
                width: 240,
                background: "var(--surface-dark)",
                borderColor: "var(--border-subtle)",
                boxShadow: "var(--shadow-floating)",
              }}
            >
              <img
                src={hoveredImageUrl}
                alt="Preview"
                loading="lazy"
                className="w-full h-auto"
                style={{ maxHeight: 240, objectFit: "contain" }}
              />
            </div>
          )}

          {results.map((r, i) => (
            <button
              key={`${r.id}`}
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
          ))}
        </div>
      )}
    </div>
  );
}
