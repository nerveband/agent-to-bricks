interface ToolReferenceProps {
  toolSlug: string;
}

const TOOL_REFERENCES: Record<
  string,
  { title: string; commands: { cmd: string; desc: string }[]; tips: string[] }
> = {
  "claude-code": {
    title: "Claude Code",
    commands: [
      { cmd: "/help", desc: "Show available commands" },
      { cmd: "/model", desc: "Switch model" },
      { cmd: "/compact", desc: "Compact conversation" },
      { cmd: "/clear", desc: "Clear conversation" },
      { cmd: "/cost", desc: "Show token usage" },
    ],
    tips: [
      "Use Escape to interrupt a response",
      "Shift+Tab cycles permission modes",
      "Type @ to reference files",
    ],
  },
  codex: {
    title: "Codex",
    commands: [
      { cmd: "--model", desc: "Specify model" },
      { cmd: "--full-auto", desc: "Auto-approve all actions" },
      { cmd: "--quiet", desc: "Non-interactive mode" },
    ],
    tips: [
      "Codex runs in a sandboxed environment",
      "Use --full-auto for autonomous operation",
    ],
  },
  opencode: {
    title: "OpenCode",
    commands: [
      { cmd: "/help", desc: "Show available commands" },
      { cmd: "/model", desc: "Switch model" },
      { cmd: "/compact", desc: "Compact context" },
    ],
    tips: [
      "OpenCode supports multiple LLM providers",
      "Configure providers in ~/.config/opencode/",
    ],
  },
};

export function ToolReference({ toolSlug }: ToolReferenceProps) {
  const ref = TOOL_REFERENCES[toolSlug];
  if (!ref) {
    return (
      <div className="p-4">
        <p
          className="text-[13px]"
          style={{ color: "var(--fg-muted)" }}
        >
          No reference available for this tool.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-[15px] font-semibold tracking-tight mb-3">
        {ref.title} Reference
      </h2>

      <div className="mb-4">
        <h3
          className="text-[11px] tracking-widest uppercase mb-2"
          style={{ color: "var(--fg-muted)" }}
        >
          Commands
        </h3>
        <div className="flex flex-col gap-1">
          {ref.commands.map((c) => (
            <div
              key={c.cmd}
              className="flex items-baseline gap-2 text-[13px]"
            >
              <code
                className="font-mono text-[12px] px-1 rounded shrink-0"
                style={{
                  background: "var(--bg)",
                  color: "var(--accent)",
                }}
              >
                {c.cmd}
              </code>
              <span style={{ color: "var(--fg-muted)" }}>{c.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3
          className="text-[11px] tracking-widest uppercase mb-2"
          style={{ color: "var(--fg-muted)" }}
        >
          Tips
        </h3>
        <ul className="flex flex-col gap-1">
          {ref.tips.map((tip, i) => (
            <li
              key={i}
              className="text-[13px] leading-relaxed"
              style={{ color: "var(--fg-muted)" }}
            >
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
