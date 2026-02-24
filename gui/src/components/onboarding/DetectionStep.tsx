import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { DEFAULT_TOOLS, type Tool } from "../../atoms/tools";

interface DetectionResult {
  command: string;
  installed: boolean;
  version: string | null;
  path: string | null;
}

interface DetectionStepProps {
  onComplete: (tools: Tool[]) => void;
}

interface ToolStatus {
  tool: Tool;
  scanning: boolean;
}

export function DetectionStep({ onComplete }: DetectionStepProps) {
  const [statuses, setStatuses] = useState<ToolStatus[]>([]);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    async function detect() {
      const results: ToolStatus[] = DEFAULT_TOOLS.map((t) => ({
        tool: { ...t, installed: false, version: null },
        scanning: true,
      }));
      setStatuses([...results]);

      for (let i = 0; i < DEFAULT_TOOLS.length; i++) {
        const def = DEFAULT_TOOLS[i];
        try {
          const result = await invoke<DetectionResult>("detect_tool", {
            command: def.command,
          });
          results[i] = {
            tool: { ...def, installed: result.installed, version: result.version },
            scanning: false,
          };
        } catch {
          results[i] = {
            tool: { ...def, installed: false, version: null },
            scanning: false,
          };
        }
        setStatuses([...results]);
      }

      setAllDone(true);
    }
    detect();
  }, []);

  const handleContinue = () => {
    onComplete(statuses.map((s) => s.tool));
  };

  return (
    <div className="flex flex-col items-center text-center max-w-[400px] px-6">
      <h2
        className="text-[22px] font-bold tracking-tight mb-2"
        style={{ color: "var(--fg)" }}
      >
        Detecting Tools
      </h2>
      <p
        className="text-[14px] mb-6"
        style={{ color: "var(--fg-muted)" }}
      >
        Scanning your system for installed coding agents...
      </p>

      <div className="w-full mb-8 space-y-3">
        {statuses.map((s) => (
          <div
            key={s.tool.slug}
            className="flex items-center gap-3 px-4 py-3 rounded"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {s.scanning ? (
              <span
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                style={{ borderColor: "var(--fg-muted)", borderTopColor: "transparent" }}
              />
            ) : s.tool.installed ? (
              <CheckCircle size={20} weight="fill" style={{ color: "var(--accent)" }} className="shrink-0" />
            ) : (
              <XCircle size={20} weight="fill" style={{ color: "var(--destructive)" }} className="shrink-0" />
            )}
            <span
              className="text-[14px] font-medium text-left flex-1"
              style={{ color: "var(--fg)" }}
            >
              {s.tool.name}
            </span>
            {!s.scanning && s.tool.version && (
              <span
                className="text-[12px] font-mono"
                style={{ color: "var(--fg-muted)" }}
              >
                {s.tool.version}
              </span>
            )}
            {!s.scanning && !s.tool.installed && (
              <span
                className="text-[12px]"
                style={{ color: "var(--fg-muted)" }}
              >
                Not found
              </span>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleContinue}
        disabled={!allDone}
        className="font-semibold text-[14px] rounded px-6 py-2.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "var(--accent)",
          color: "oklch(0.15 0.01 85)",
        }}
        onMouseEnter={(e) => {
          if (!e.currentTarget.disabled)
            e.currentTarget.style.background = "var(--accent-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--accent)";
        }}
      >
        Continue
      </button>
    </div>
  );
}
