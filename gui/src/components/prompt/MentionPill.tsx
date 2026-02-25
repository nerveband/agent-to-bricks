import { ArrowSquareOut } from "@phosphor-icons/react";

interface MentionPillProps {
  type: string;
  label: string;
  sublabel?: string;
  linkUrl?: string;
  onClick?: () => void;
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
  template: "#c084fc",
  form: "#38bdf8",
  loop: "#fb7185",
  condition: "#fbbf24",
};

export function MentionPill({ type, label, sublabel, linkUrl, onClick, onRemove }: MentionPillProps) {
  const color = TYPE_COLORS[type] ?? "var(--fg-muted)";

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-mono mention-pill"
      style={{
        background: `${color}20`,
        border: `1px solid ${color}40`,
        color,
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
      title={
        linkUrl
          ? `${label} — ${linkUrl}\nClick to change`
          : sublabel
          ? `${label} (${sublabel}) — click to change`
          : `${label} — click to change`
      }
    >
      <span className="opacity-60">@{type}</span>
      <span className="font-sans font-medium" style={{ color: "var(--fg)" }}>
        {label}
      </span>
      {sublabel && (
        <span className="text-[10px] opacity-50 font-sans">{sublabel}</span>
      )}
      {linkUrl && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(linkUrl, "_blank");
          }}
          className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
          aria-label={`Open ${label} in browser`}
          title={`Open ${linkUrl}`}
        >
          <ArrowSquareOut size={11} />
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}
