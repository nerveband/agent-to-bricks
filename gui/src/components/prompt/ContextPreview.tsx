import { useState } from "react";
import { CaretDown, CaretRight, Copy, Check } from "@phosphor-icons/react";
import { estimateTokens } from "../../lib/contextFormatter";

interface ContextPreviewProps {
  contextBlock: string;
  mentions: Array<{ type: string; label: string; context?: string }>;
  defaultExpanded?: boolean;
}

export function ContextPreview({
  contextBlock,
  mentions,
  defaultExpanded = false,
}: ContextPreviewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const tokens = estimateTokens(contextBlock);

  if (mentions.length === 0) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(contextBlock);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-lg border text-[13px]"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ color: "var(--fg-muted)" }}
      >
        {expanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
        <span className="flex-1">
          Context: {mentions.length} reference{mentions.length !== 1 ? "s" : ""} (~{tokens} tokens)
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="mt-2 space-y-1">
            {mentions.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-mono opacity-50">@{m.type}</span>
                <span style={{ color: "var(--fg)" }}>{m.label}</span>
              </div>
            ))}
          </div>

          {contextBlock && (
            <pre
              className="mt-2 p-2 rounded text-[12px] overflow-x-auto whitespace-pre-wrap font-mono"
              style={{
                background: "var(--surface)",
                color: "var(--fg-muted)",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {contextBlock}
            </pre>
          )}

          <button
            onClick={handleCopy}
            className="mt-2 flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
            style={{ color: "var(--fg-muted)", background: "var(--surface)" }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy full context"}
          </button>
        </div>
      )}
    </div>
  );
}
