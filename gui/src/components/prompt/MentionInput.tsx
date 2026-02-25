import { useState, useCallback } from "react";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { MentionPill } from "./MentionPill";
import { VariableEditor } from "./VariableEditor";
import { useMentionSearch, type SearchResult } from "../../hooks/useMentionSearch";
import type { MentionType, ResolvedMention } from "../../atoms/prompts";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  mentions: ResolvedMention[];
  onMentionAdd: (mention: ResolvedMention) => void;
  onMentionRemove: (index: number) => void;
  placeholder?: string;
  maxRows?: number;
  /** Kept for API compatibility; VariableEditor does not currently use it */
  autoFocus?: boolean;
  onSubmit?: () => void;
}

export function MentionInput({
  value,
  onChange,
  mentions,
  onMentionAdd,
  onMentionRemove,
  placeholder = "Describe what you want to build... (@ to reference site objects)",
  maxRows = 6,
  onSubmit,
}: MentionInputProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteMode, setAutocompleteMode] = useState<"type-picker" | "search">("type-picker");
  const [selectedType, setSelectedType] = useState<MentionType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autocompletePos] = useState({ top: 0, left: 0 });

  const { results, loading } = useMentionSearch(selectedType, searchQuery);

  const handleTypeSelect = useCallback((type: MentionType) => {
    setSelectedType(type);
    setAutocompleteMode("search");
    setSearchQuery("");
    setSelectedIndex(0);
    // Update the value to include the @type prefix for search context
    const atIdx = value.lastIndexOf("@");
    if (atIdx >= 0) {
      const newVal = value.slice(0, atIdx) + `@${type} ` + value.slice(atIdx + type.length + 1);
      onChange(newVal);
    }
  }, [value, onChange]);

  const handleResultSelect = useCallback((result: SearchResult) => {
    if (selectedType) {
      onMentionAdd({
        type: selectedType,
        id: result.id,
        label: result.label,
        data: result.data,
      });
      // Remove the @type query text from the value
      const atIdx = value.lastIndexOf("@");
      if (atIdx >= 0) {
        const newVal = value.slice(0, atIdx).trimEnd() + " ";
        onChange(newVal);
      }
    }
    setShowAutocomplete(false);
    setSelectedType(null);
    setSearchQuery("");
  }, [selectedType, value, onChange, onMentionAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showAutocomplete) {
        const itemCount = autocompleteMode === "type-picker" ? 8 : results.length;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % Math.max(itemCount, 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1));
        } else if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          if (autocompleteMode === "type-picker") {
            const types: MentionType[] = ["page", "section", "element", "class", "color", "variable", "component", "media"];
            handleTypeSelect(types[selectedIndex]);
          } else if (results[selectedIndex]) {
            handleResultSelect(results[selectedIndex]);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setShowAutocomplete(false);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
      }
    },
    [showAutocomplete, autocompleteMode, results, selectedIndex, handleTypeSelect, handleResultSelect, onSubmit]
  );

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {mentions.map((m, i) => (
            <MentionPill
              key={`${m.type}-${m.id}`}
              type={m.type}
              label={m.label}
              onRemove={() => onMentionRemove(i)}
            />
          ))}
        </div>
      )}

      <VariableEditor
        value={value}
        onChange={(val) => {
          onChange(val);
          // Re-trigger autocomplete detection on input
          const atMatch = val.match(/@(\w*)$/);
          if (atMatch) {
            setShowAutocomplete(true);
            setSelectedIndex(0);
            const typed = atMatch[1].toLowerCase();
            const typeMatch = [
              "page", "section", "element", "class", "color", "variable", "component", "media",
            ].find((t) => t.startsWith(typed));
            if (typed.length === 0) {
              setAutocompleteMode("type-picker");
              setSelectedType(null);
            } else if (typeMatch && typed.length >= 2) {
              setAutocompleteMode("search");
              setSelectedType(typeMatch as MentionType);
              setSearchQuery("");
            }
          } else {
            setShowAutocomplete(false);
          }
        }}
        placeholder={placeholder}
        rows={maxRows > 3 ? 8 : 2}
        className="font-sans"
      />

      {showAutocomplete && (
        <MentionAutocomplete
          mode={autocompleteMode}
          mentionType={selectedType}
          results={results}
          loading={loading}
          selectedIndex={selectedIndex}
          onSelectType={handleTypeSelect}
          onSelectResult={handleResultSelect}
          position={autocompletePos}
        />
      )}
    </div>
  );
}
