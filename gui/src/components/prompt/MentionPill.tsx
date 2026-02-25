interface MentionPillProps {
  type: string;
  label: string;
  onRemove: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  page: "#4a9eff",
  section: "#a78bfa",
  element: "#34d399",
  class: "#f59e0b",
  color: "#f472b6",
  variable: "#22d3ee",
  component: "#fb923c",
  media: "#a3e635",
};

export function MentionPill({ type, label, onRemove }: MentionPillProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-mono mention-pill"
      style={{
        background: `${TYPE_COLORS[type] ?? "var(--fg-muted)"}20`,
        border: `1px solid ${TYPE_COLORS[type] ?? "var(--fg-muted)"}40`,
        color: TYPE_COLORS[type] ?? "var(--fg-muted)",
      }}
    >
      <span className="opacity-60">@{type}</span>
      <span className="font-sans font-medium" style={{ color: "var(--fg)" }}>
        {label}
      </span>
      <button
        onClick={onRemove}
        className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}
