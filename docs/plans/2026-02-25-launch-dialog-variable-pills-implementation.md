# Launch Dialog & Variable Pills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a tool launch modal with editable system prompt, inline variable pills with click-to-edit popovers, and remove the sidebar theme toggle.

**Architecture:** New `LaunchDialog` component wraps tool launch with configuration. A reusable `VariableEditor` component (contentEditable-based) replaces plain textareas wherever variables appear, rendering `{curly}`, `@mention`, and `{{double_curly}}` tokens as clickable pills with popover editing. Radix UI Dialog and Popover primitives are used throughout.

**Tech Stack:** React 19, Jotai atoms, Radix UI (Dialog, Popover), Tailwind CSS 4, TypeScript, Phosphor Icons

**Design doc:** `docs/plans/2026-02-25-launch-dialog-variable-pills-design.md`

---

## Task 1: Remove Sidebar Theme Toggle

**Files:**
- Modify: `gui/src/components/Sidebar.tsx`

**Step 1: Remove the theme toggle button and unused imports**

In `gui/src/components/Sidebar.tsx`, remove the theme toggle button (lines 483-491):

```tsx
// DELETE this entire button block:
<button
  className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors"
  style={{ color: "var(--fg-muted)" }}
  onClick={toggle}
  title={collapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
>
  {theme === "dark" ? <SunDim size={18} /> : <Moon size={18} />}
  {!collapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
</button>
```

Remove from imports:
- `Moon` and `SunDim` from `@phosphor-icons/react` (line 7)
- `useTheme` import (line 8)
- `const { theme, toggle } = useTheme();` (line 28)

**Step 2: Verify the build compiles**

Run: `cd gui && npm run build`
Expected: No errors. The theme toggle still works in SettingsDialog.

**Step 3: Commit**

```bash
git add gui/src/components/Sidebar.tsx
git commit -m "fix(gui): remove duplicate theme toggle from sidebar"
```

---

## Task 2: Add `launchDialogToolAtom` to App Atoms

**Files:**
- Modify: `gui/src/atoms/app.ts`

**Step 1: Add the atom**

At the bottom of `gui/src/atoms/app.ts`, add:

```typescript
import type { Tool } from "./tools";

// Launch dialog — holds the tool being configured before launch, or null when closed
export const launchDialogToolAtom = atom<Tool | null>(null);
```

Note: The `Tool` type import needs to be added. Check that `gui/src/atoms/tools.ts` exports the `Tool` interface (it does — `export interface Tool`... confirmed from the codebase read).

**Step 2: Verify the build compiles**

Run: `cd gui && npm run build`
Expected: No errors.

**Step 3: Commit**

```bash
git add gui/src/atoms/app.ts
git commit -m "feat(gui): add launchDialogToolAtom for tool launch modal"
```

---

## Task 3: Create `useVariableParser` Hook

**Files:**
- Create: `gui/src/hooks/useVariableParser.ts`

**Step 1: Create the parser hook**

Create `gui/src/hooks/useVariableParser.ts`:

```typescript
import { useMemo } from "react";

export type VarType = "curly" | "mention" | "double_curly";

export interface TextSegment {
  type: "text";
  value: string;
}

export interface VariableSegment {
  type: "variable";
  value: string;       // The full token as it appears in text, e.g. "{site_url}" or "@page"
  varName: string;     // Just the variable name, e.g. "site_url" or "page"
  varType: VarType;
}

export type Segment = TextSegment | VariableSegment;

/**
 * Parse a string into segments of plain text and variable tokens.
 * Recognizes: {curly_brace}, {{double_curly}}, @mention_type
 */
export function parseVariables(text: string): Segment[] {
  const segments: Segment[] = [];
  // Match {{double_curly}}, {single_curly}, or @word patterns
  const regex = /(\{\{[\w]+\}\}|\{[\w]+\}|@(?:page|section|element|class|color|variable|component|media)(?:\s+[^\s@{]+)?)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    let varName: string;
    let varType: VarType;

    if (token.startsWith("{{")) {
      varType = "double_curly";
      varName = token.slice(2, -2);
    } else if (token.startsWith("{")) {
      varType = "curly";
      varName = token.slice(1, -1);
    } else {
      varType = "mention";
      varName = token.slice(1); // Remove leading @
    }

    segments.push({ type: "variable", value: token, varName, varType });
    lastIndex = match.index + token.length;
  }

  // Trailing text
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * React hook wrapper around parseVariables with memoization.
 */
export function useVariableParser(text: string): Segment[] {
  return useMemo(() => parseVariables(text), [text]);
}
```

**Step 2: Verify the build compiles**

Run: `cd gui && npm run build`
Expected: No errors.

**Step 3: Commit**

```bash
git add gui/src/hooks/useVariableParser.ts
git commit -m "feat(gui): add useVariableParser hook for tokenizing variables"
```

---

## Task 4: Create `VariablePillPopover` Component

**Files:**
- Create: `gui/src/components/prompt/VariablePillPopover.tsx`

**Step 1: Create the popover component**

Create `gui/src/components/prompt/VariablePillPopover.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, X } from "@phosphor-icons/react";
import type { VarType } from "../../hooks/useVariableParser";

const VAR_COLORS: Record<VarType, string> = {
  curly: "var(--accent)",
  mention: "#4a9eff",
  double_curly: "#22d3ee",
};

interface VariablePillPopoverProps {
  varName: string;
  varType: VarType;
  resolvedValue?: string;
  onApply: (newValue: string) => void;
  children: React.ReactNode;
}

export function VariablePillPopover({
  varName,
  varType,
  resolvedValue,
  onApply,
  children,
}: VariablePillPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(resolvedValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(resolvedValue ?? "");
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [open, resolvedValue]);

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const accentColor = VAR_COLORS[varType];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="rounded-lg border p-3 shadow-lg z-[100] w-[240px]"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `${accentColor}20`, color: accentColor }}
            >
              {varName}
            </span>
            <Popover.Close asChild>
              <button className="p-0.5 rounded" style={{ color: "var(--fg-muted)" }}>
                <X size={12} />
              </button>
            </Popover.Close>
          </div>

          {resolvedValue && (
            <p className="text-[10px] mb-1.5 truncate" style={{ color: "var(--fg-muted)" }}>
              Current: {resolvedValue}
            </p>
          )}

          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApply();
              if (e.key === "Escape") setOpen(false);
              e.stopPropagation();
            }}
            className="w-full px-2 py-1.5 rounded border text-[12px] font-mono mb-2"
            style={{
              background: "var(--bg)",
              borderColor: "var(--border)",
              color: "var(--fg)",
            }}
            placeholder="New value..."
          />

          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => setOpen(false)}
              className="px-2 py-1 rounded text-[11px] border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{ background: "var(--accent)", color: "oklch(0.15 0.01 85)" }}
            >
              <Check size={10} weight="bold" />
              Apply
            </button>
          </div>

          <Popover.Arrow style={{ fill: "var(--border)" }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

**Step 2: Verify the build compiles**

Run: `cd gui && npm run build`
Expected: No errors.

**Step 3: Commit**

```bash
git add gui/src/components/prompt/VariablePillPopover.tsx
git commit -m "feat(gui): add VariablePillPopover for inline variable editing"
```

---

## Task 5: Create `VariableEditor` Component

**Files:**
- Create: `gui/src/components/prompt/VariableEditor.tsx`

This is the core component — a contentEditable div that renders variable tokens as styled pill spans.

**Step 1: Create the VariableEditor**

Create `gui/src/components/prompt/VariableEditor.tsx`:

```tsx
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
};

interface VariableEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Map of varName → resolved value for display in popovers */
  resolvedValues?: Record<string, string>;
  /** Called when a variable value is changed via the popover */
  onVariableChange?: (varName: string, newValue: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  readOnly?: boolean;
}

export function VariableEditor({
  value,
  onChange,
  resolvedValues = {},
  onVariableChange,
  placeholder,
  rows = 3,
  className = "",
  readOnly = false,
}: VariableEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const isComposing = useRef(false);
  const lastValue = useRef(value);

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

  // Re-render when value changes externally
  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      const cursor = focused ? saveCursor() : 0;
      renderContent();
      if (focused) restoreCursor(cursor);
    }
  }, [value, focused, renderContent, saveCursor, restoreCursor]);

  // Initial render
  useEffect(() => {
    renderContent();
  }, [renderContent]);

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
    // The popover will handle this via data attributes
    // We set a state to track which pill is being edited
  }, []);

  // Approximate row height for min-height
  const minHeight = rows * 22;

  return (
    <div className="relative">
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
        className={`variable-editor w-full rounded-lg px-3 py-2 text-[14px] outline-none transition-colors whitespace-pre-wrap break-words ${className}`}
        style={{
          background: "var(--bg)",
          color: "var(--fg)",
          border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
          fontFamily: "var(--font-sans, inherit)",
          lineHeight: "22px",
          minHeight: `${minHeight}px`,
        }}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
      />
    </div>
  );
}
```

**Step 2: Add CSS for the placeholder pseudo-element**

In `gui/src/index.css`, add at the bottom (before the closing of any existing blocks):

```css
/* VariableEditor placeholder */
.variable-editor:empty::before,
.variable-editor:has(> br:only-child)::before {
  content: attr(data-placeholder);
  color: var(--fg-muted);
  opacity: 0.5;
  pointer-events: none;
}
```

**Step 3: Verify the build compiles**

Run: `cd gui && npm run build`
Expected: No errors.

**Step 4: Commit**

```bash
git add gui/src/components/prompt/VariableEditor.tsx gui/src/index.css
git commit -m "feat(gui): add VariableEditor with contentEditable pill rendering"
```

---

## Task 6: Create `LaunchDialog` Component

**Files:**
- Create: `gui/src/components/LaunchDialog.tsx`

**Step 1: Create the launch dialog**

Create `gui/src/components/LaunchDialog.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FolderOpen, Play } from "@phosphor-icons/react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { launchDialogToolAtom, activeSiteAtom, sessionPrePromptAtom } from "../atoms/app";
import { toolCustomFlagsAtom, toolWorkingDirsAtom } from "../atoms/tools";
import { useSessionLauncher } from "../hooks/useSessionLauncher";
import { VariableEditor } from "./prompt/VariableEditor";

export function LaunchDialog() {
  const [tool, setTool] = useAtom(launchDialogToolAtom);
  const site = useAtomValue(activeSiteAtom);
  const [toolFlags, setToolFlags] = useAtom(toolCustomFlagsAtom);
  const [toolDirs, setToolDirs] = useAtom(toolWorkingDirsAtom);
  const [prePrompt, setPrePrompt] = useAtom(sessionPrePromptAtom);
  const { launch } = useSessionLauncher();

  const [cwd, setCwd] = useState("");
  const [flags, setFlags] = useState("");
  const [prompt, setPrompt] = useState("");

  const open = tool !== null;

  // Initialize local state when dialog opens
  useEffect(() => {
    if (tool) {
      setCwd(toolDirs[tool.slug] ?? "");
      setFlags(toolFlags[tool.slug] ?? "");
      setPrompt(prePrompt);
    }
  }, [tool, toolDirs, toolFlags, prePrompt]);

  const handleLaunch = () => {
    if (!tool) return;

    // Persist changes back to atoms
    if (cwd !== (toolDirs[tool.slug] ?? "")) {
      setToolDirs((prev) => ({ ...prev, [tool.slug]: cwd }));
    }
    if (flags !== (toolFlags[tool.slug] ?? "")) {
      setToolFlags((prev) => ({ ...prev, [tool.slug]: flags }));
    }
    if (prompt !== prePrompt) {
      setPrePrompt(prompt);
    }

    launch(tool, cwd || undefined);
    setTool(null);
  };

  const handleBrowse = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select working directory",
      });
      if (selected && typeof selected === "string") {
        setCwd(selected);
      }
    } catch {
      // User cancelled
    }
  };

  // Build resolved values map from active site for pill display
  const resolvedValues: Record<string, string> = {};
  if (site) {
    resolvedValues.site_url = site.site_url;
    resolvedValues.api_key = site.api_key;
    resolvedValues.site_name = site.name;
    resolvedValues.environment = site.environment ?? "";
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) setTool(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.5)" }}
        />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-h-[85vh] overflow-hidden rounded-lg border flex flex-col"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <Dialog.Title className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
              {tool && (
                <span
                  className="w-7 h-7 flex items-center justify-center rounded text-[10px] font-bold font-mono"
                  style={{ background: "var(--bg)", color: "var(--accent)" }}
                >
                  {tool.icon}
                </span>
              )}
              Launch {tool?.name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded transition-colors" style={{ color: "var(--fg-muted)" }}>
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Working Directory */}
            <div>
              <label
                className="text-[12px] font-medium mb-1.5 flex items-center gap-1.5"
                style={{ color: "var(--fg-muted)" }}
              >
                <FolderOpen size={14} />
                Working Directory
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="/path/to/project"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 px-3 py-2 rounded border text-[13px] font-mono"
                  style={{
                    background: "var(--bg)",
                    borderColor: "var(--border)",
                    color: "var(--fg)",
                  }}
                />
                <button
                  onClick={handleBrowse}
                  className="px-3 py-2 rounded border text-[13px] transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
                  title="Browse..."
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Flags */}
            <div>
              <label
                className="text-[12px] font-medium mb-1.5 block"
                style={{ color: "var(--fg-muted)" }}
              >
                Flags
              </label>
              <input
                type="text"
                value={flags}
                onChange={(e) => setFlags(e.target.value)}
                placeholder="--verbose --dangerously-skip-permissions"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                className="w-full px-3 py-2 rounded border text-[13px] font-mono"
                style={{
                  background: "var(--bg)",
                  borderColor: "var(--border)",
                  color: "var(--fg)",
                }}
              />
            </div>

            {/* System Context Prompt */}
            <div>
              <label
                className="text-[12px] font-medium mb-1.5 block"
                style={{ color: "var(--fg-muted)" }}
              >
                System Context Prompt
              </label>
              <p className="text-[10px] mb-2" style={{ color: "var(--fg-muted)" }}>
                Sent to the tool when the session starts. Click variables to see their values.
              </p>
              <VariableEditor
                value={prompt}
                onChange={setPrompt}
                resolvedValues={resolvedValues}
                rows={6}
                placeholder="Enter session context prompt..."
              />
            </div>

            {/* Variable reference */}
            <div
              className="p-3 rounded border"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            >
              <p className="text-[10px] font-medium mb-1.5" style={{ color: "var(--fg-muted)" }}>
                Available variables
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { var: "{site_url}", val: site?.site_url },
                  { var: "{api_key}", val: site?.api_key ? "***" : undefined },
                  { var: "{site_name}", val: site?.name },
                  { var: "{environment}", val: site?.environment },
                ].map((v) => (
                  <div key={v.var} className="flex items-center gap-2">
                    <code
                      className="text-[11px] px-1.5 py-0.5 rounded font-mono"
                      style={{ background: "var(--surface)", color: "var(--accent)" }}
                    >
                      {v.var}
                    </code>
                    {v.val && (
                      <span className="text-[10px] truncate" style={{ color: "var(--fg-muted)" }}>
                        {v.val}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setTool(null)}
              className="px-4 py-2 rounded text-[13px] border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleLaunch}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold transition-colors"
              style={{
                background: "var(--accent)",
                color: "oklch(0.15 0.01 85)",
              }}
            >
              <Play size={14} weight="fill" />
              Launch
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Step 2: Verify the build compiles**

Run: `cd gui && npm run build`
Expected: No errors.

**Step 3: Commit**

```bash
git add gui/src/components/LaunchDialog.tsx
git commit -m "feat(gui): add LaunchDialog modal for tool session configuration"
```

---

## Task 7: Wire Sidebar to Open LaunchDialog

**Files:**
- Modify: `gui/src/components/Sidebar.tsx`

**Step 1: Update the Sidebar tool click handler**

In `gui/src/components/Sidebar.tsx`:

1. Add import for `launchDialogToolAtom`:
```typescript
import { settingsOpenAtom, helpOpenAtom, launchDialogToolAtom } from "../atoms/app";
```

2. Add the setter inside the component:
```typescript
const setLaunchDialogTool = useSetAtom(launchDialogToolAtom);
```

3. Change the tool button `onClick` (around line 118-121) from:
```tsx
onClick={() => {
  if (tool.installed) {
    launch(tool);
  }
}}
```
to:
```tsx
onClick={() => {
  if (tool.installed) {
    setLaunchDialogTool(tool);
  }
}}
```

4. Also change the "New session" context menu item (around line 151) from:
```tsx
onSelect={() => { if (tool.installed) launch(tool); }}
```
to:
```tsx
onSelect={() => { if (tool.installed) setLaunchDialogTool(tool); }}
```

**Step 2: Add LaunchDialog to the Sidebar render**

Add `LaunchDialog` import and render it alongside other dialogs at the bottom of the `Sidebar` component return, right before the closing `</nav>`:

```tsx
import { LaunchDialog } from "./LaunchDialog";
```

Then near the bottom (around line 502-504), add:
```tsx
<LaunchDialog />
```

**Step 3: Verify the build compiles**

Run: `cd gui && npm run build`
Expected: No errors.

**Step 4: Commit**

```bash
git add gui/src/components/Sidebar.tsx
git commit -m "feat(gui): wire sidebar tool clicks to open LaunchDialog"
```

---

## Task 8: Integrate VariableEditor into PromptPane

**Files:**
- Modify: `gui/src/components/PromptPane.tsx`
- Modify: `gui/src/components/prompt/MentionInput.tsx`

**Step 1: Add VariableEditor to MentionInput**

This is an incremental change. The existing MentionInput uses a plain `<textarea>`. We replace it with the `VariableEditor` component for inline pill rendering, while keeping the @mention autocomplete functionality.

In `gui/src/components/prompt/MentionInput.tsx`, add the import:

```typescript
import { VariableEditor } from "./VariableEditor";
```

Replace the `<textarea>` element (lines 184-200) with:

```tsx
<VariableEditor
  value={value}
  onChange={(val) => {
    onChange(val);
    // Re-trigger autocomplete detection on input
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      setShowAutocomplete(true);
      setSelectedIndex(0);
      const typed = atMatch[1].toLowerCase();
      const typeMatch = [
        "page", "section", "element", "class", "color", "variable", "component", "media",
      ].find((t) => t.startsWith(typed));
      if (typed.length === 0) {
        setAutocompleteMode("type-picker");
        setSelectedType(null);
      } else if (typeMatch && typed.length >= 2) {
        setAutocompleteMode("search");
        setSelectedType(typeMatch as MentionType);
        setSearchQuery("");
      }
    } else {
      setShowAutocomplete(false);
    }
  }}
  placeholder={placeholder}
  rows={maxRows > 3 ? 8 : 2}
  className="font-sans"
/>
```

Note: The autoFocus and onSubmit behavior will need to be handled via a wrapper. For the initial integration, focus on getting the pill rendering working. The autocomplete dropdown positioning should still use the `autocompletePos` state.

**Step 2: Verify the build compiles**

Run: `cd gui && npm run build`
Expected: No errors.

**Step 3: Manual test**

1. Start the dev server: `cd gui && npm run tauri dev`
2. Click a tool — LaunchDialog should open
3. The system prompt should show `{site_url}`, `{api_key}`, `{site_name}`, `{environment}` as colored pills
4. Type in the prompt builder — `@page` should appear as a blue pill
5. Type `{description}` — should appear as a gold pill

**Step 4: Commit**

```bash
git add gui/src/components/prompt/MentionInput.tsx
git commit -m "feat(gui): integrate VariableEditor into MentionInput for inline pills"
```

---

## Task 9: Final Integration & Polish

**Files:**
- Potentially adjust: `gui/src/components/prompt/VariableEditor.tsx`
- Potentially adjust: `gui/src/index.css`

**Step 1: Add pill click-to-edit integration**

The `VariableEditor` currently renders pills but doesn't yet wire up the `VariablePillPopover` for click-to-edit (since React and contentEditable don't play nicely with portaled popovers inside the editable area).

The approach: Track the "active pill" being edited via state, and render the popover outside the contentEditable, positioned absolutely relative to the clicked pill element.

Add to `VariableEditor.tsx`:

1. State for the active pill:
```typescript
const [activePill, setActivePill] = useState<{
  varName: string;
  varType: VarType;
  rect: DOMRect;
} | null>(null);
```

2. Update the `handlePillClick` to set the active pill:
```typescript
const handlePillClick = useCallback((e: React.MouseEvent) => {
  const pill = (e.target as HTMLElement).closest(".variable-pill") as HTMLElement | null;
  if (!pill) return;
  e.preventDefault();
  e.stopPropagation();
  setActivePill({
    varName: pill.dataset.varName ?? "",
    varType: (pill.dataset.varType as VarType) ?? "curly",
    rect: pill.getBoundingClientRect(),
  });
}, []);
```

3. Render the popover outside the contentEditable div:
```tsx
{activePill && (
  <VariablePillPopover
    varName={activePill.varName}
    varType={activePill.varType}
    resolvedValue={resolvedValues[activePill.varName]}
    onApply={(newValue) => {
      onVariableChange?.(activePill.varName, newValue);
      setActivePill(null);
    }}
  >
    <span
      style={{
        position: "fixed",
        left: activePill.rect.left,
        top: activePill.rect.bottom + 4,
        width: 1,
        height: 1,
      }}
    />
  </VariablePillPopover>
)}
```

**Step 2: Verify the build compiles and test**

Run: `cd gui && npm run build`
Expected: No errors.

**Step 3: Commit**

```bash
git add gui/src/components/prompt/VariableEditor.tsx
git commit -m "feat(gui): add click-to-edit popover for variable pills"
```

---

## Task 10: Full Build Verification

**Step 1: Run the full build**

Run: `cd gui && npm run build`
Expected: Clean build with no TypeScript errors or warnings.

**Step 2: Manual smoke test**

Run: `cd gui && npm run tauri dev`

Test checklist:
- [ ] Clicking a tool opens the LaunchDialog (not immediate launch)
- [ ] LaunchDialog shows Working Directory, Flags, System Prompt
- [ ] System prompt shows {variables} as gold pills
- [ ] Clicking a pill opens the popover with current resolved value
- [ ] Cancel closes LaunchDialog without launching
- [ ] Launch starts the session with configured values
- [ ] Sidebar no longer has the theme toggle button
- [ ] Theme toggle still works in Settings
- [ ] Right-click context menu on tools still works
- [ ] PromptPane textarea shows @mentions as colored pills
- [ ] Preset selection loads text with pills rendered

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat(gui): polish launch dialog and variable pills integration"
```
