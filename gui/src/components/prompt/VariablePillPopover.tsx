import { useState, useRef, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, X } from "@phosphor-icons/react";
import type { VarType } from "../../hooks/useVariableParser";

const VAR_COLORS: Record<VarType, string> = {
  curly: "var(--accent)",
  mention: "#4a9eff",
  double_curly: "#22d3ee",
};

interface VariablePillPopoverProps {
  varName: string;
  varType: VarType;
  resolvedValue?: string;
  onApply: (newValue: string) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}

export function VariablePillPopover({
  varName,
  varType,
  resolvedValue,
  onApply,
  onClose,
  anchorRect,
}: VariablePillPopoverProps) {
  const [draft, setDraft] = useState(resolvedValue ?? varName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const handleApply = () => {
    onApply(draft);
  };

  const accentColor = VAR_COLORS[varType];

  return (
    <Popover.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Popover.Anchor asChild>
        <span
          style={{
            position: "fixed",
            left: anchorRect.left,
            top: anchorRect.bottom + 2,
            width: anchorRect.width,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="rounded-lg border p-3 shadow-lg z-[100] w-[240px]"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={() => onClose()}
          onEscapeKeyDown={() => onClose()}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `${accentColor}20`, color: accentColor }}
            >
              {varName}
            </span>
            <button onClick={onClose} className="p-0.5 rounded" style={{ color: "var(--fg-muted)" }}>
              <X size={12} />
            </button>
          </div>

          {resolvedValue && (
            <p className="text-[10px] mb-1.5 truncate" style={{ color: "var(--fg-muted)" }}>
              Current: {resolvedValue}
            </p>
          )}

          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApply();
              if (e.key === "Escape") onClose();
              e.stopPropagation();
            }}
            className="w-full px-2 py-1.5 rounded border text-[12px] font-mono mb-2"
            style={{
              background: "var(--bg)",
              borderColor: "var(--border)",
              color: "var(--fg)",
            }}
            placeholder="New value..."
          />

          <div className="flex gap-1.5 justify-end">
            <button
              onClick={onClose}
              className="px-2 py-1 rounded text-[11px] border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{ background: "var(--accent)", color: "oklch(0.15 0.01 85)" }}
            >
              <Check size={10} weight="bold" />
              Apply
            </button>
          </div>

          <Popover.Arrow style={{ fill: "var(--border)" }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
