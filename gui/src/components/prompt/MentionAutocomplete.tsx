import { useEffect, useRef } from "react";
import { MENTION_TYPES } from "../../hooks/useMentionParser";
import type { SearchResult } from "../../hooks/useMentionSearch";
import type { MentionType } from "../../atoms/prompts";

const TYPE_LABELS: Record<string, string> = {
  page: "Pages",
  section: "Sections",
  element: "Elements",
  class: "Global Classes",
  color: "Colors",
  variable: "CSS Variables",
  component: "Components",
  media: "Media",
};

interface MentionAutocompleteProps {
  mode: "type-picker" | "search";
  mentionType: MentionType | null;
  results: SearchResult[];
  loading: boolean;
  selectedIndex: number;
  onSelectType: (type: MentionType) => void;
  onSelectResult: (result: SearchResult) => void;
  position: { top: number; left: number };
}

export function MentionAutocomplete({
  mode,
  mentionType,
  results,
  loading,
  selectedIndex,
  onSelectType,
  onSelectResult,
  position,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector("[data-active]");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      className="absolute z-50 rounded-lg border overflow-hidden shadow-xl mention-autocomplete"
      style={{
        top: position.top,
        left: position.left,
        background: "var(--surface)",
        borderColor: "var(--border)",
        minWidth: 220,
        maxHeight: 260,
        overflowY: "auto",
      }}
    >
      {mode === "type-picker" ? (
        <div className="p-1">
          <div
            className="px-2 py-1 text-[11px] uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Reference type
          </div>
          {MENTION_TYPES.map((t, i) => (
            <button
              key={t}
              data-active={i === selectedIndex ? "" : undefined}
              className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors flex items-center gap-2"
              style={{
                background: i === selectedIndex ? "var(--border)" : undefined,
                color: "var(--fg)",
              }}
              onClick={() => onSelectType(t)}
            >
              <span className="text-[11px] font-mono opacity-60">@</span>
              <span>{TYPE_LABELS[t] ?? t}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-1">
          {mentionType && (
            <div
              className="px-2 py-1 text-[11px] uppercase tracking-wider"
              style={{ color: "var(--fg-muted)" }}
            >
              {TYPE_LABELS[mentionType] ?? mentionType}
            </div>
          )}
          {loading && (
            <div className="px-2 py-3 text-[13px]" style={{ color: "var(--fg-muted)" }}>
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-2 py-3 text-[13px]" style={{ color: "var(--fg-muted)" }}>
              No results found
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.id}`}
              data-active={i === selectedIndex ? "" : undefined}
              className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors"
              style={{
                background: i === selectedIndex ? "var(--border)" : undefined,
                color: "var(--fg)",
              }}
              onClick={() => onSelectResult(r)}
            >
              <div className="truncate">{r.label}</div>
              {r.sublabel && (
                <div className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
                  {r.sublabel}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
