import { useState, useMemo } from "react";
import { useAtomValue } from "jotai";
import { allPresetsAtom, type PromptPreset } from "../../atoms/prompts";
import { MagnifyingGlass } from "@phosphor-icons/react";

interface PresetListProps {
  onSelect: (preset: PromptPreset) => void;
  searchQuery?: string;
}

const CATEGORIES: { key: PromptPreset["category"]; label: string }[] = [
  { key: "build", label: "Build" },
  { key: "edit", label: "Edit" },
  { key: "manage", label: "Manage" },
  { key: "inspect", label: "Inspect" },
];

export function PresetList({ onSelect, searchQuery: externalQuery }: PresetListProps) {
  const presets = useAtomValue(allPresetsAtom);
  const [internalQuery, setInternalQuery] = useState("");

  const query = externalQuery ?? internalQuery;
  const showSearch = externalQuery === undefined;

  const filtered = useMemo(() => {
    if (!query.trim()) return presets;
    const q = query.toLowerCase();
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q)
    );
  }, [presets, query]);

  return (
    <div className="space-y-1">
      {showSearch && (
        <div className="relative mb-2">
          <MagnifyingGlass
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--fg-muted)" }}
          />
          <input
            type="text"
            value={internalQuery}
            onChange={(e) => setInternalQuery(e.target.value)}
            placeholder="Search presets..."
            className="w-full pl-7 pr-2 py-1.5 rounded border text-[12px]"
            style={{
              background: "var(--bg)",
              borderColor: "var(--border)",
              color: "var(--fg)",
            }}
          />
        </div>
      )}
      {CATEGORIES.map(({ key, label }) => {
        const items = filtered.filter((p) => p.category === key);
        if (items.length === 0) return null;

        return (
          <div key={key}>
            <div
              className="px-2 py-1 text-[11px] uppercase tracking-wider font-medium"
              style={{ color: "var(--fg-muted)" }}
            >
              {label}
            </div>
            <div className="space-y-0.5">
              {items.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onSelect(preset)}
                  className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors hover:bg-[var(--border)] preset-item"
                  style={{ color: "var(--fg)" }}
                >
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && query && (
        <p className="text-[12px] px-2 py-3 text-center" style={{ color: "var(--fg-muted)" }}>
          No presets match "{query}"
        </p>
      )}
    </div>
  );
}
