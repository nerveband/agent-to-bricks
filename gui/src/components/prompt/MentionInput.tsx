import { useState, useRef, useCallback, useEffect } from "react";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { MentionPill } from "./MentionPill";
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
  autoFocus = false,
  onSubmit,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteMode, setAutocompleteMode] = useState<"type-picker" | "search">("type-picker");
  const [selectedType, setSelectedType] = useState<MentionType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });

  const { results, loading } = useMentionSearch(selectedType, searchQuery);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      onChange(val);

      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        const rect = e.target.getBoundingClientRect();
        setAutocompletePos({ top: rect.height + 4, left: 0 });
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
      } else if (showAutocomplete && autocompleteMode === "search") {
        const lastAt = textBeforeCursor.lastIndexOf("@");
        if (lastAt >= 0) {
          const afterType = textBeforeCursor.slice(lastAt).match(/@\w+\s+(.*)$/);
          if (afterType) {
            setSearchQuery(afterType[1]);
          }
        }
      } else {
        setShowAutocomplete(false);
      }
    },
    [onChange, showAutocomplete, autocompleteMode]
  );

  const handleTypeSelect = useCallback((type: MentionType) => {
    setSelectedType(type);
    setAutocompleteMode("search");
    setSearchQuery("");
    setSelectedIndex(0);
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      const before = value.slice(0, pos);
      const atIdx = before.lastIndexOf("@");
      const newVal = value.slice(0, atIdx) + `@${type} ` + value.slice(pos);
      onChange(newVal);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newPos = atIdx + type.length + 2;
          textareaRef.current.selectionStart = newPos;
          textareaRef.current.selectionEnd = newPos;
          textareaRef.current.focus();
        }
      });
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
      if (textareaRef.current) {
        const pos = textareaRef.current.selectionStart;
        const before = value.slice(0, pos);
        const atIdx = before.lastIndexOf("@");
        const newVal = value.slice(0, atIdx) + value.slice(pos);
        onChange(newVal.trimEnd() + " ");
      }
    }
    setShowAutocomplete(false);
    setSelectedType(null);
    setSearchQuery("");
    textareaRef.current?.focus();
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

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const lineHeight = 22;
    ta.style.height = `${Math.min(ta.scrollHeight, lineHeight * maxRows)}px`;
  }, [value, maxRows]);

  return (
    <div className="relative">
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

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={1}
        className="w-full resize-none rounded-lg px-3 py-2 text-[14px] outline-none transition-colors"
        style={{
          background: "var(--bg)",
          color: "var(--fg)",
          border: "1px solid var(--border)",
          fontFamily: "var(--font-sans, inherit)",
          lineHeight: "22px",
        }}
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
