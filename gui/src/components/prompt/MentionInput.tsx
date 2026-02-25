import { useState, useCallback, useImperativeHandle, forwardRef, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { MentionPill } from "./MentionPill";
import { VariableEditor } from "./VariableEditor";
import { useMentionSearch, type SearchResult } from "../../hooks/useMentionSearch";
import type { MentionType, ResolvedMention } from "../../atoms/prompts";

const ALL_TYPES: MentionType[] = [
  "page", "section", "element", "class", "color", "variable", "component", "media",
  "template", "form", "loop", "condition",
];

/** Map common aliases/plurals to canonical type names */
const TYPE_ALIASES: Record<string, MentionType> = {
  pages: "page",
  sections: "section",
  elements: "element",
  classes: "class",
  colors: "color",
  variables: "variable",
  components: "component",
  templates: "template",
  forms: "form",
  loops: "loop",
  conditions: "condition",
  css: "variable",
  vars: "variable",
  img: "media",
  images: "media",
};

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  mentions: ResolvedMention[];
  onMentionAdd: (mention: ResolvedMention) => void;
  onMentionRemove: (index: number) => void;
  placeholder?: string;
  maxRows?: number;
  autoFocus?: boolean;
  onSubmit?: () => void;
  expanded?: boolean;
  siteUrl?: string;
}

export interface MentionInputRef {
  openAutocomplete: (type: MentionType) => void;
}

export const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(
  function MentionInput(
    {
      value,
      onChange,
      mentions,
      onMentionAdd,
      onMentionRemove,
      placeholder = "Describe what you want to build... (@ to reference site objects)",
      onSubmit,
      expanded,
      siteUrl,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteMode, setAutocompleteMode] = useState<"type-picker" | "search">("type-picker");
    const [selectedType, setSelectedType] = useState<MentionType | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [typeFilter, setTypeFilter] = useState("");
    const [autocompletePos, setAutocompletePos] = useState({ bottom: 0, left: 0, width: 260 });

    // Guard ref: prevents onChange from closing autocomplete opened via imperative call
    const imperativeOpenRef = useRef(false);

    // Section two-step state
    const [sectionPage, setSectionPage] = useState<{ id: number; name: string } | null>(null);

    const { results, loading } = useMentionSearch(
      selectedType,
      searchQuery,
      selectedType === "section" ? sectionPage?.id ?? null : null
    );

    // Compute autocomplete position
    const computePosition = useCallback(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setAutocompletePos({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: Math.max(rect.width, 260),
        });
      }
    }, []);

    // Recompute position when autocomplete opens
    useEffect(() => {
      if (showAutocomplete) computePosition();
    }, [showAutocomplete, computePosition]);

    // Expose method for parent to trigger autocomplete (e.g. from quick chips)
    useImperativeHandle(ref, () => ({
      openAutocomplete: (type: MentionType) => {
        imperativeOpenRef.current = true;
        computePosition();
        setShowAutocomplete(true);
        setAutocompleteMode("search");
        setSelectedType(type);
        setSearchQuery("");
        setSelectedIndex(0);
        setTypeFilter("");
        setSectionPage(null);
      },
    }));

    const stripAtTrigger = useCallback(() => {
      // Remove @... trigger text from the end of the value
      const newVal = value.replace(/@\w*$/, "").trimEnd();
      if (newVal !== value) onChange(newVal);
    }, [value, onChange]);

    const handleTypeSelect = useCallback(
      (type: MentionType) => {
        stripAtTrigger();
        setSelectedType(type);
        setAutocompleteMode("search");
        setSearchQuery("");
        setSelectedIndex(0);
        setTypeFilter("");
        setSectionPage(null);
      },
      [stripAtTrigger]
    );

    const handleResultSelect = useCallback(
      (result: SearchResult) => {
        // Section two-step: first select a page, then select a section
        if (selectedType === "section" && !sectionPage) {
          setSectionPage({ id: result.id as number, name: result.label });
          setSearchQuery("");
          setSelectedIndex(0);
          return;
        }

        if (selectedType) {
          onMentionAdd({
            type: selectedType,
            id: result.id,
            label: result.label,
            data: result.data,
          });
        }
        setShowAutocomplete(false);
        setSelectedType(null);
        setSearchQuery("");
        setTypeFilter("");
        setSectionPage(null);
      },
      [selectedType, sectionPage, onMentionAdd]
    );

    const handleSectionBack = useCallback(() => {
      setSectionPage(null);
      setSearchQuery("");
      setSelectedIndex(0);
    }, []);

    const handleSearchQueryChange = useCallback((q: string) => {
      setSearchQuery(q);
      setSelectedIndex(0);
    }, []);

    const dismissAutocomplete = useCallback(() => {
      setShowAutocomplete(false);
      setSelectedType(null);
      setTypeFilter("");
      setSectionPage(null);
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (showAutocomplete) {
          if (autocompleteMode === "type-picker") {
            const lowerFilter = typeFilter.toLowerCase();
            let filtered = lowerFilter
              ? ALL_TYPES.filter((t) => t.startsWith(lowerFilter))
              : ALL_TYPES;
            // If no prefix match, check if the typed text is an alias
            const aliasMatch = lowerFilter ? TYPE_ALIASES[lowerFilter] : undefined;
            if (filtered.length === 0 && aliasMatch) {
              filtered = [aliasMatch];
            }
            const itemCount = filtered.length;

            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIndex((i) => (i + 1) % Math.max(itemCount, 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIndex((i) => (i - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1));
            } else if (e.key === "Tab" || e.key === "Enter") {
              e.preventDefault();
              if (filtered[selectedIndex]) {
                handleTypeSelect(filtered[selectedIndex]);
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              dismissAutocomplete();
            }
          } else {
            const itemCount = results.length;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIndex((i) => (i + 1) % Math.max(itemCount, 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIndex((i) => (i - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1));
            } else if (e.key === "Tab" || e.key === "Enter") {
              e.preventDefault();
              if (results[selectedIndex]) {
                handleResultSelect(results[selectedIndex]);
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              dismissAutocomplete();
            }
          }
          return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          onSubmit?.();
        }
      },
      [
        showAutocomplete,
        autocompleteMode,
        typeFilter,
        results,
        selectedIndex,
        handleTypeSelect,
        handleResultSelect,
        dismissAutocomplete,
        onSubmit,
      ]
    );

    return (
      <div ref={containerRef} className={`relative ${expanded ? "h-full flex flex-col" : ""}`} onKeyDown={handleKeyDown}>
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2 shrink-0">
            {mentions.map((m, i) => (
              <MentionPill
                key={`${m.type}-${m.id}`}
                type={m.type}
                label={m.label}
                sublabel={
                  m.data && typeof m.data === "object" && "slug" in (m.data as Record<string, unknown>)
                    ? `ID: ${m.id} · /${(m.data as Record<string, unknown>).slug}`
                    : `ID: ${m.id}`
                }
                linkUrl={
                  siteUrl && m.data && typeof m.data === "object" && "slug" in (m.data as Record<string, unknown>)
                    ? `${siteUrl}/${(m.data as Record<string, unknown>).slug}`
                    : undefined
                }
                onClick={() => {
                  // Re-open autocomplete to change this mention
                  onMentionRemove(i);
                  setShowAutocomplete(true);
                  setAutocompleteMode("search");
                  setSelectedType(m.type);
                  setSearchQuery("");
                  setSelectedIndex(0);
                  setTypeFilter("");
                  setSectionPage(null);
                }}
                onRemove={() => onMentionRemove(i)}
              />
            ))}
          </div>
        )}

        <div className={expanded ? "flex-1 min-h-0" : ""}>
          <VariableEditor
            value={value}
            expanded={expanded}
            embedded
            onMentionPillClick={(mentionType, _fullToken) => {
              // When user clicks a @mention pill, open autocomplete for that type
              const type = ALL_TYPES.find((t) => t === mentionType) ?? TYPE_ALIASES[mentionType] ?? null;
              if (type) {
                computePosition();
                setShowAutocomplete(true);
                setAutocompleteMode("search");
                setSelectedType(type);
                setSearchQuery("");
                setSelectedIndex(0);
                setTypeFilter("");
                setSectionPage(null);
              }
            }}
            onChange={(val) => {
              // Detect @type trigger from typing
              const atMatch = val.match(/@(\w*)$/);
              if (atMatch) {
                const typed = atMatch[1].toLowerCase();
                // Always show type picker — user must press Enter/Tab to confirm
                onChange(val);
                setShowAutocomplete(true);
                setSelectedIndex(0);
                setAutocompleteMode("type-picker");
                setTypeFilter(typed);
                setSelectedType(null);

                // Pre-select the best match so Enter/Tab picks it
                const allFiltered = typed
                  ? ALL_TYPES.filter((t) => t.startsWith(typed))
                  : ALL_TYPES;
                if (allFiltered.length > 0) {
                  setSelectedIndex(0);
                }
              } else {
                onChange(val);
                // Don't close autocomplete if it was just opened imperatively (chip click)
                if (imperativeOpenRef.current) {
                  imperativeOpenRef.current = false;
                } else if (!showAutocomplete || autocompleteMode !== "search") {
                  setShowAutocomplete(false);
                }
              }
            }}
            placeholder={placeholder}
            rows={2}
            className="font-sans"
          />
        </div>

        {showAutocomplete && createPortal(
          <MentionAutocomplete
            mode={autocompleteMode}
            mentionType={selectedType}
            results={results}
            loading={loading}
            selectedIndex={selectedIndex}
            searchQuery={searchQuery}
            onSearchQueryChange={handleSearchQueryChange}
            onSelectType={handleTypeSelect}
            onSelectResult={handleResultSelect}
            onDismiss={dismissAutocomplete}
            onBack={sectionPage ? handleSectionBack : undefined}
            position={autocompletePos}
            typeFilter={typeFilter}
            sectionPageName={sectionPage?.name}
          />,
          document.body
        )}
      </div>
    );
  }
);
