import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface MentionPillProps {
  type: string;
  label: string;
  sublabel?: string;
  linkUrl?: string;
  /** Color value (hex/rgb/hsl) for color type previews */
  colorValue?: string;
  /** Image URL for media type previews */
  imageUrl?: string;
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

export function MentionPill({ type, label, sublabel, linkUrl, colorValue, imageUrl, onClick, onRemove }: MentionPillProps) {
  const color = TYPE_COLORS[type] ?? "var(--fg-muted)";
  const pillRef = useRef<HTMLSpanElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hasPreview = !!colorValue || !!imageUrl || !!linkUrl;

  const handleMouseEnter = () => {
    if (!hasPreview) return;
    hoverTimer.current = setTimeout(() => {
      if (pillRef.current) {
        const rect = pillRef.current.getBoundingClientRect();
        setPreviewPos({ top: rect.bottom + 4, left: rect.left });
        setShowPreview(true);
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current);
    setShowPreview(false);
  };

  return (
    <>
      <span
        ref={pillRef}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-mono mention-pill"
        style={{
          background: `${color}20`,
          border: `1px solid ${color}40`,
          color,
          cursor: onClick ? "pointer" : undefined,
        }}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={
          linkUrl
            ? `${label} — ${linkUrl}\nClick to change`
            : sublabel
            ? `${label} (${sublabel}) — click to change`
            : `${label} — click to change`
        }
      >
        {/* Inline color swatch for color mentions */}
        {colorValue && (
          <span
            className="w-3 h-3 rounded-sm shrink-0 border"
            style={{ backgroundColor: colorValue, borderColor: `${color}60` }}
          />
        )}
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
              openUrl(linkUrl);
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

      {/* Hover preview tooltip */}
      {showPreview && hasPreview && createPortal(
        <div
          className="fixed z-[10000] rounded-lg border overflow-hidden pointer-events-none"
          style={{
            top: previewPos.top,
            left: previewPos.left,
            background: "var(--surface-dark)",
            borderColor: "var(--border-subtle)",
            boxShadow: "var(--shadow-floating)",
            maxWidth: 240,
          }}
          onMouseEnter={handleMouseLeave}
        >
          {colorValue && (
            <div className="flex items-center gap-2 p-2">
              <span
                className="w-10 h-10 rounded border shrink-0"
                style={{ backgroundColor: colorValue, borderColor: "var(--border)" }}
              />
              <div className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                {colorValue}
              </div>
            </div>
          )}
          {imageUrl && (
            <img
              src={imageUrl}
              alt={label}
              loading="lazy"
              className="w-full h-auto"
              style={{ maxHeight: 160, objectFit: "contain" }}
            />
          )}
          {linkUrl && !colorValue && !imageUrl && (
            <div className="p-2 text-[11px]" style={{ color: "var(--fg-muted)" }}>
              {linkUrl}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
