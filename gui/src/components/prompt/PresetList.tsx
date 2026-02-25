import { useState } from "react";
import { useAtomValue } from "jotai";
import { allPresetsAtom, type PromptPreset } from "../../atoms/prompts";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

interface PresetListProps {
  onSelect: (preset: PromptPreset) => void;
}

const CATEGORIES: { key: PromptPreset["category"]; label: string }[] = [
  { key: "build", label: "Build" },
  { key: "edit", label: "Edit" },
  { key: "manage", label: "Manage" },
  { key: "inspect", label: "Inspect" },
];

export function PresetList({ onSelect }: PresetListProps) {
  const presets = useAtomValue(allPresetsAtom);
  const [expandedCat, setExpandedCat] = useState<string | null>("build");

  return (
    <div className="space-y-1">
      {CATEGORIES.map(({ key, label }) => {
        const items = presets.filter((p) => p.category === key);
        if (items.length === 0) return null;
        const isExpanded = expandedCat === key;

        return (
          <div key={key}>
            <button
              onClick={() => setExpandedCat(isExpanded ? null : key)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[12px] uppercase tracking-wider font-medium"
              style={{ color: "var(--fg-muted)" }}
            >
              {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
              {label}
              <span className="text-[10px] opacity-50">({items.length})</span>
            </button>
            {isExpanded && (
              <div className="ml-2 space-y-0.5">
                {items.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onSelect(preset)}
                    className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors preset-item"
                    style={{ color: "var(--fg)" }}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
