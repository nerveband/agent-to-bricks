import { useRef, useCallback, useEffect, useState } from "react";
import { parseVariables, type VarType } from "../../hooks/useVariableParser";
import { VariablePillPopover } from "./VariablePillPopover";

const VAR_COLORS: Record<VarType, string> = {
  curly: "var(--accent)",
  mention: "#4a9eff",
  double_curly: "#22d3ee",
};

/** Mention sub-type colors (matching existing MentionPill palette) */
const MENTION_COLORS: Record<string, string> = {
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

interface VariableEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Map of varName → resolved value for display in popovers */
  resolvedValues?: Record<string, string>;
  /** Called when a variable value is changed via the popover */
  onVariableChange?: (varName: string, newValue: string) => void;
  /** Called when a @mention pill is clicked — lets parent open autocomplete */
  onMentionPillClick?: (mentionType: string, fullToken: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  readOnly?: boolean;
  expanded?: boolean;
  /** When true, renders with transparent bg and no border (for use inside glass-input containers) */
  embedded?: boolean;
}

export function VariableEditor({
  value,
  onChange,
  resolvedValues = {},
  onVariableChange,
  onMentionPillClick,
  placeholder,
  rows = 3,
  className = "",
  readOnly = false,
  expanded = false,
  embedded = false,
}: VariableEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const isComposing = useRef(false);
  const lastValue = useRef(value);
  const [activePill, setActivePill] = useState<{
    varName: string;
    varType: VarType;
    varValue: string;
    rect: DOMRect;
  } | null>(null);

  // Get plain text from contentEditable, preserving newlines from <br> and <div> blocks
  const getPlainText = useCallback((): string => {
    if (!editorRef.current) return "";
    // Use innerText which respects visual line breaks from contentEditable
    return editorRef.current.innerText ?? "";
  }, []);

  // Save and restore cursor position
  const saveCursor = useCallback((): number => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return 0;
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(editorRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }, []);

  const restoreCursor = useCallback((offset: number) => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;

    const walk = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    let node: Node | null;

    while ((node = walk.nextNode())) {
      const len = (node.textContent ?? "").length;
      if (charCount + len >= offset) {
        const range = document.createRange();
        range.setStart(node, offset - charCount);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      charCount += len;
    }
  }, []);

  // Render segments into the contentEditable div
  const renderContent = useCallback(() => {
    if (!editorRef.current) return;
    const segments = parseVariables(value);

    // Build HTML from segments
    const frag = document.createDocumentFragment();

    for (const seg of segments) {
      if (seg.type === "text") {
        // Split by newlines to create proper line breaks
        const lines = seg.value.split("\n");
        lines.forEach((line, i) => {
          if (i > 0) frag.appendChild(document.createElement("br"));
          if (line) frag.appendChild(document.createTextNode(line));
        });
      } else {
        const pill = document.createElement("span");
        const color = seg.varType === "mention"
          ? (MENTION_COLORS[seg.varName.split(" ")[0]] ?? "#4a9eff")
          : VAR_COLORS[seg.varType];

        pill.className = "variable-pill";
        pill.contentEditable = "false";
        pill.dataset.varName = seg.varName;
        pill.dataset.varType = seg.varType;
        pill.dataset.varValue = seg.value;
        pill.style.cssText = `
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-family: var(--font-mono, monospace);
          font-weight: 500;
          background: ${color}20;
          border: 1px solid ${color}40;
          color: ${color};
          cursor: pointer;
          user-select: none;
          vertical-align: baseline;
          line-height: 20px;
        `;
        pill.textContent = seg.value;
        frag.appendChild(pill);
      }
    }

    // If empty, ensure there's at least a br for the placeholder to show
    if (frag.childNodes.length === 0) {
      frag.appendChild(document.createElement("br"));
    }

    editorRef.current.innerHTML = "";
    editorRef.current.appendChild(frag);
  }, [value]);

  // Re-render when value changes externally (not from user typing)
  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      const cursor = focused ? saveCursor() : 0;
      renderContent();
      if (focused) restoreCursor(cursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Initial render only
  useEffect(() => {
    renderContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    const text = getPlainText();
    lastValue.current = text;
    onChange(text);
  }, [onChange, getPlainText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent Enter from creating divs — insert br instead
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      handleInput();
    }
  }, [handleInput]);

  const handlePillClick = useCallback((e: React.MouseEvent) => {
    const pill = (e.target as HTMLElement).closest(".variable-pill") as HTMLElement | null;
    if (!pill) return;
    e.preventDefault();
    e.stopPropagation();

    const varType = pill.dataset.varType as VarType | undefined;
    const varName = pill.dataset.varName ?? "";
    const varValue = pill.dataset.varValue ?? "";

    // For @mention pills, delegate to parent to open autocomplete
    if (varType === "mention" && onMentionPillClick) {
      const mentionType = varName.split(" ")[0]; // e.g. "page" from "page Homepage"
      onMentionPillClick(mentionType, varValue);
      return;
    }

    setActivePill({
      varName,
      varType: varType ?? "curly",
      varValue,
      rect: pill.getBoundingClientRect(),
    });
  }, [onMentionPillClick]);

  // Approximate row height for min-height
  const minHeight = rows * 22;

  return (
    <div className={`relative ${expanded ? "h-full" : ""}`}>
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => {
          isComposing.current = false;
          handleInput();
        }}
        onClick={handlePillClick}
        data-placeholder={placeholder}
        className={`variable-editor w-full ${embedded ? "" : "rounded-lg px-3 py-2"} text-[14px] outline-none transition-colors whitespace-pre-wrap break-words ${className}`}
        style={{
          background: embedded ? "transparent" : "var(--bg)",
          color: "var(--fg)",
          border: embedded ? "none" : `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
          fontFamily: "var(--font-sans, inherit)",
          lineHeight: expanded ? "1.625" : "22px",
          minHeight: expanded ? undefined : `${minHeight}px`,
          height: expanded ? "100%" : undefined,
          resize: expanded ? undefined : (embedded ? undefined : "vertical"),
          overflow: "auto",
          ...(embedded ? { paddingBottom: "2rem" } : {}),
        }}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
      />

      {activePill && (
        <VariablePillPopover
          varName={activePill.varName}
          varType={activePill.varType}
          resolvedValue={resolvedValues[activePill.varName]}
          anchorRect={activePill.rect}
          onApply={(newValue) => {
            if (onVariableChange) {
              onVariableChange(activePill.varName, newValue);
            } else {
              // Replace the variable token in the text with the new value
              const oldToken = activePill.varType === "double_curly"
                ? `{{${activePill.varName}}}`
                : activePill.varType === "curly"
                ? `{${activePill.varName}}`
                : activePill.varValue;
              if (oldToken) {
                const newText = value.replace(oldToken, newValue);
                onChange(newText);
              }
            }
            setActivePill(null);
          }}
          onClose={() => setActivePill(null)}
        />
      )}
    </div>
  );
}
