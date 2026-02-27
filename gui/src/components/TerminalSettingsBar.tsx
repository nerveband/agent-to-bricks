import { useAtom, useSetAtom } from "jotai";
import { terminalSettingsAtom, terminalSettingsOpenAtom, TERMINAL_DEFAULTS } from "../atoms/terminal";
import { X, ArrowCounterClockwise } from "@phosphor-icons/react";

export function TerminalSettingsBar() {
  const [s, setS] = useAtom(terminalSettingsAtom);
  const setOpen = useSetAtom(terminalSettingsOpenAtom);

  return (
    <div
      className="shrink-0 border-t white-glass"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {/* Row 1: Font & spacing */}
      <div className="flex items-center gap-3 px-3 pt-2 pb-1">
        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Size</span>
          <input
            type="number"
            min={8} max={24}
            value={s.fontSize}
            onChange={(e) => setS((p) => ({ ...p, fontSize: Math.min(24, Math.max(8, Number(e.target.value) || 8)) }))}
            className="w-12 px-1.5 py-1 rounded-md border text-[12px] glass-input text-center"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
          />
        </label>

        <Divider />

        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Font</span>
          <input
            type="text"
            value={s.fontFamily}
            onChange={(e) => setS((p) => ({ ...p, fontFamily: e.target.value }))}
            className="w-28 px-1.5 py-1 rounded-md border text-[12px] glass-input"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
          />
        </label>

        <Divider />

        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Height</span>
          <input
            type="number"
            min={0.8} max={2.0} step={0.1}
            value={s.lineHeight}
            onChange={(e) => setS((p) => ({ ...p, lineHeight: Math.min(2.0, Math.max(0.8, Number(e.target.value) || 1.0)) }))}
            className="w-14 px-1.5 py-1 rounded-md border text-[12px] glass-input text-center"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
          />
        </label>

        <Divider />

        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Spacing</span>
          <input
            type="number"
            min={-1} max={5} step={0.5}
            value={s.letterSpacing}
            onChange={(e) => setS((p) => ({ ...p, letterSpacing: Math.min(5, Math.max(-1, Number(e.target.value) || 0)) }))}
            className="w-14 px-1.5 py-1 rounded-md border text-[12px] glass-input text-center"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
          />
        </label>

        <Divider />

        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Pad</span>
          <input
            type="number"
            min={0} max={32}
            value={s.padding}
            onChange={(e) => setS((p) => ({ ...p, padding: Math.min(32, Math.max(0, Number(e.target.value) || 0)) }))}
            className="w-12 px-1.5 py-1 rounded-md border text-[12px] glass-input text-center"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
          />
        </label>

        <div className="flex-1" />

        <button
          onClick={() => setS(TERMINAL_DEFAULTS)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors hover:bg-[var(--white-glass)]"
          style={{ color: "var(--fg-muted)" }}
          title="Reset to defaults"
        >
          <ArrowCounterClockwise size={12} />
          Reset
        </button>

        <button
          onClick={() => setOpen(false)}
          className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-[var(--white-glass)] transition-colors"
          style={{ color: "var(--fg-muted)" }}
          title="Close terminal designer"
        >
          <X size={12} />
        </button>
      </div>

      {/* Row 2: Cursor & scrollback */}
      <div className="flex items-center gap-3 px-3 pt-0.5 pb-2">
        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Scroll</span>
          <input
            type="number"
            min={100} max={50000}
            value={s.scrollback}
            onChange={(e) => setS((p) => ({ ...p, scrollback: Math.min(50000, Math.max(100, Number(e.target.value) || 5000)) }))}
            className="w-16 px-1.5 py-1 rounded-md border text-[12px] glass-input text-center"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
          />
        </label>

        <Divider />

        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Cursor</span>
          <select
            value={s.cursorStyle}
            onChange={(e) => setS((p) => ({ ...p, cursorStyle: e.target.value as "bar" | "block" | "underline" }))}
            className="px-1.5 py-1 rounded-md border text-[12px] glass-input"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
          >
            <option value="bar">Bar</option>
            <option value="block">Block</option>
            <option value="underline">Underline</option>
          </select>
        </label>

        <Divider />

        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Width</span>
          <input
            type="number"
            min={1} max={4}
            value={s.cursorWidth}
            onChange={(e) => setS((p) => ({ ...p, cursorWidth: Math.min(4, Math.max(1, Number(e.target.value) || 2)) }))}
            className="w-12 px-1.5 py-1 rounded-md border text-[12px] glass-input text-center"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
          />
        </label>

        <Divider />

        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Blink</span>
          <button
            onClick={() => setS((p) => ({ ...p, cursorBlink: !p.cursorBlink }))}
            className="w-8 h-[18px] rounded-full transition-colors relative"
            style={{ background: s.cursorBlink ? "var(--yellow)" : "var(--border)" }}
          >
            <span
              className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-transform"
              style={{
                background: "#fff",
                left: s.cursorBlink ? "calc(100% - 16px)" : "2px",
              }}
            />
          </button>
        </label>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="w-px h-4 shrink-0"
      style={{ background: "var(--border-subtle)" }}
    />
  );
}
