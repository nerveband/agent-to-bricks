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
  children: React.ReactNode;
}

export function VariablePillPopover({
  varName,
  varType,
  resolvedValue,
  onApply,
  children,
}: VariablePillPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(resolvedValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(resolvedValue ?? "");
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [open, resolvedValue]);

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const accentColor = VAR_COLORS[varType];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="rounded-lg border p-3 shadow-lg z-[100] w-[240px]"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `${accentColor}20`, color: accentColor }}
            >
              {varName}
            </span>
            <Popover.Close asChild>
              <button className="p-0.5 rounded" style={{ color: "var(--fg-muted)" }}>
                <X size={12} />
              </button>
            </Popover.Close>
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
              if (e.key === "Escape") setOpen(false);
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
              onClick={() => setOpen(false)}
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
