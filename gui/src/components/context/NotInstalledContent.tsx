import { Copy, ArrowSquareOut } from "@phosphor-icons/react";
import type { Tool } from "../../atoms/tools";

interface NotInstalledContentProps {
  tool: Tool;
}

export function NotInstalledContent({ tool }: NotInstalledContentProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-4">
      <h2 className="text-[15px] font-semibold tracking-tight mb-1">
        {tool.name}
      </h2>
      <p
        className="text-[13px] leading-relaxed mb-4"
        style={{ color: "var(--fg-muted)" }}
      >
        Not installed. Install it to get started.
      </p>

      {tool.installInstructions.npm && (
        <div className="mb-3">
          <p
            className="text-[11px] tracking-widest uppercase mb-1"
            style={{ color: "var(--fg-muted)" }}
          >
            Via npm
          </p>
          <div
            className="flex items-center gap-2 p-2 rounded font-mono text-[12px]"
            style={{ background: "var(--bg)" }}
          >
            <code className="flex-1 truncate">
              {tool.installInstructions.npm}
            </code>
            <button
              onClick={() => copyToClipboard(tool.installInstructions.npm!)}
              className="shrink-0 p-1 rounded transition-colors"
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      {tool.installInstructions.brew && (
        <div className="mb-3">
          <p
            className="text-[11px] tracking-widest uppercase mb-1"
            style={{ color: "var(--fg-muted)" }}
          >
            Via Homebrew
          </p>
          <div
            className="flex items-center gap-2 p-2 rounded font-mono text-[12px]"
            style={{ background: "var(--bg)" }}
          >
            <code className="flex-1 truncate">
              {tool.installInstructions.brew}
            </code>
            <button
              onClick={() => copyToClipboard(tool.installInstructions.brew!)}
              className="shrink-0 p-1 rounded transition-colors"
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      {tool.installInstructions.url && (
        <div className="mb-3">
          <a
            href={tool.installInstructions.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px]"
            style={{ color: "var(--accent)" }}
          >
            Installation guide <ArrowSquareOut size={14} />
          </a>
        </div>
      )}

      <p
        className="text-[12px] mt-4"
        style={{ color: "var(--fg-muted)" }}
      >
        After installing, restart the app or click a tool to re-detect.
      </p>
    </div>
  );
}
