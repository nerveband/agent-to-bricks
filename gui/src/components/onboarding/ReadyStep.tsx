import { Command } from "@phosphor-icons/react";
import type { Tool } from "../../atoms/tools";

interface ReadyStepProps {
  tools: Tool[];
  onComplete: () => void;
}

export function ReadyStep({ tools, onComplete }: ReadyStepProps) {
  const detectedTools = tools.filter((t) => t.installed);

  return (
    <div className="flex flex-col items-center text-center max-w-[400px] px-6">
      <h2
        className="text-[22px] font-bold tracking-tight mb-2"
        style={{ color: "var(--fg)" }}
      >
        All set.
      </h2>
      <p
        className="text-[14px] mb-6"
        style={{ color: "var(--fg-muted)" }}
      >
        {detectedTools.length > 0
          ? `${detectedTools.length} tool${detectedTools.length > 1 ? "s" : ""} ready to launch.`
          : "No tools detected, but you can add them later in Settings."}
      </p>

      {detectedTools.length > 0 && (
        <div className="w-full mb-6 grid gap-3">
          {detectedTools.map((tool) => (
            <div
              key={tool.slug}
              className="flex items-center gap-3 px-4 py-3 rounded"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded text-[11px] font-bold font-mono shrink-0"
                style={{ background: "var(--bg)", color: "var(--accent)" }}
              >
                {tool.icon}
              </span>
              <div className="text-left flex-1">
                <p
                  className="text-[14px] font-medium"
                  style={{ color: "var(--fg)" }}
                >
                  {tool.name}
                </p>
                {tool.version && (
                  <p
                    className="text-[12px] font-mono"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {tool.version}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="w-full mb-8 rounded px-4 py-3 text-left space-y-2"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="text-[12px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--fg-muted)" }}
        >
          Keyboard shortcuts
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[13px]" style={{ color: "var(--fg)" }}>
            Toggle sidebar
          </span>
          <kbd className="flex items-center gap-0.5 text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--fg-muted)" }}>
            <Command size={12} /> B
          </kbd>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px]" style={{ color: "var(--fg)" }}>
            Toggle context panel
          </span>
          <kbd className="flex items-center gap-0.5 text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--fg-muted)" }}>
            <Command size={12} /> I
          </kbd>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px]" style={{ color: "var(--fg)" }}>
            New session
          </span>
          <kbd className="flex items-center gap-0.5 text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--fg-muted)" }}>
            <Command size={12} /> N
          </kbd>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="font-semibold text-[14px] rounded px-6 py-2.5 transition-colors cursor-pointer"
        style={{
          background: "var(--accent)",
          color: "oklch(0.15 0.01 85)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--accent-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "var(--accent)")
        }
      >
        Start
      </button>
    </div>
  );
}
