import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import { activeSiteAtom, promptCountAtom, promptExpandedAtom } from "../atoms/app";
import {
  promptHistoryAtom,
  customPresetsAtom,
  hiddenPresetIdsAtom,
  presetOverridesAtom,
  allPresetsAtom,
  type MentionType,
  type PromptPreset,
  type PromptHistoryEntry,
  type ResolvedMention,
} from "../atoms/prompts";
import { activeSessionAtom } from "../atoms/sessions";
import { MentionInput, type MentionInputRef } from "./prompt/MentionInput";
import { PromptHints } from "./prompt/PromptHints";
import { ContextPreview } from "./prompt/ContextPreview";
import { useMentionResolver } from "../hooks/useMentionResolver";
import { usePromptComposer } from "../hooks/usePromptComposer";
import { writeToActivePty } from "../atoms/ptyBridge";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  PaperPlaneTilt,
  FloppyDisk,
  Copy,
  Check,
  ClockCounterClockwise,
  MagnifyingGlass,
  CornersOut,
  CornersIn,
  PencilSimple,
  Trash,
  TextAa,
} from "@phosphor-icons/react";

const QUICK_CHIPS: { type: MentionType; label: string }[] = [
  { type: "page", label: "@page" },
  { type: "section", label: "@section" },
  { type: "element", label: "@element" },
  { type: "class", label: "@class" },
  { type: "color", label: "@color" },
  { type: "variable", label: "@variable" },
  { type: "component", label: "@component" },
  { type: "media", label: "@media" },
  { type: "template", label: "@template" },
  { type: "form", label: "@form" },
  { type: "loop", label: "@loop" },
  { type: "condition", label: "@condition" },
];

export function PromptPane() {
  const site = useAtomValue(activeSiteAtom);
  const session = useAtomValue(activeSessionAtom);
  const [history, setHistory] = useAtom(promptHistoryAtom);
  const setCustomPresets = useSetAtom(customPresetsAtom);
  const setHiddenPresetIds = useSetAtom(hiddenPresetIdsAtom);
  const setPresetOverrides = useSetAtom(presetOverridesAtom);
  const setPromptCount = useSetAtom(promptCountAtom);
  const allPresets = useAtomValue(allPresetsAtom);
  const { resolve } = useMentionResolver();
  const { compose } = usePromptComposer();

  const mentionInputRef = useRef<MentionInputRef>(null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ResolvedMention[]>([]);
  const [resolvedContexts, setResolvedContexts] = useState<Map<string, string>>(new Map());
  const [copied, setCopied] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");
  const [expanded, setExpanded] = useAtom(promptExpandedAtom);

  // Inline editing state
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"name" | "prompt" | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the edit input when editing starts
  useEffect(() => {
    if (editingPresetId && editingField === "name") {
      requestAnimationFrame(() => editInputRef.current?.focus());
    } else if (editingPresetId && editingField === "prompt") {
      requestAnimationFrame(() => editTextareaRef.current?.focus());
    }
  }, [editingPresetId, editingField]);

  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return allPresets;
    const q = presetSearch.toLowerCase();
    return allPresets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [allPresets, presetSearch]);

  const handleMentionAdd = useCallback((m: ResolvedMention) => {
    setMentions((prev) => [...prev, m]);
  }, []);

  const handleMentionRemove = useCallback((index: number) => {
    setMentions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePresetSelect = useCallback((preset: PromptPreset) => {
    setText(preset.prompt);
    setMentions([]);
    setResolvedContexts(new Map());
  }, []);

  const handleChipClick = useCallback((type: MentionType) => {
    mentionInputRef.current?.openAutocomplete(type);
  }, []);

  const handleSend = useCallback(async () => {
    if (!text.trim() && mentions.length === 0) return;

    const ctxMap = new Map<string, string>();
    for (const m of mentions) {
      const ctx = await resolve({
        type: m.type,
        query: "",
        displayName: m.label,
        resolvedId: m.id,
        resolvedData: m.data,
        startPos: 0,
        endPos: 0,
      });
      ctxMap.set(`${m.type}:${m.id}`, ctx);
    }
    setResolvedContexts(ctxMap);

    const composed = compose(text, ctxMap);

    if (session) {
      writeToActivePty(composed.fullText + "\n");
    }

    const entry: PromptHistoryEntry = {
      text,
      composedText: composed.fullText,
      timestamp: Date.now(),
      mentions: mentions.map((m) => ({ type: m.type, displayName: m.label })),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 50));
    setPromptCount((c) => c + 1);

    setText("");
    setMentions([]);
  }, [text, mentions, session, resolve, compose, setHistory, setPromptCount]);

  const handleSavePreset = useCallback(() => {
    if (!text.trim()) return;
    const name = prompt("Preset name:");
    if (!name) return;
    const preset: PromptPreset = {
      id: `custom-${Date.now()}`,
      name,
      description: text.slice(0, 80),
      prompt: text,
      category: "build",
      builtin: false,
    };
    setCustomPresets((prev) => [...prev, preset]);
  }, [text, setCustomPresets]);

  const handleCopy = useCallback(async () => {
    const composed = compose(text, resolvedContexts);
    await navigator.clipboard.writeText(composed.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text, resolvedContexts, compose]);

  // --- Preset management ---
  const handleDeletePreset = useCallback((preset: PromptPreset) => {
    if (preset.builtin) {
      setHiddenPresetIds((prev) => [...prev, preset.id]);
    } else {
      setCustomPresets((prev) => prev.filter((p) => p.id !== preset.id));
    }
  }, [setHiddenPresetIds, setCustomPresets]);

  const handleStartRename = useCallback((preset: PromptPreset) => {
    setEditingPresetId(preset.id);
    setEditingField("name");
    setEditValue(preset.name);
  }, []);

  const handleStartEditPrompt = useCallback((preset: PromptPreset) => {
    setEditingPresetId(preset.id);
    setEditingField("prompt");
    setEditValue(preset.prompt);
  }, []);

  const handleFinishEdit = useCallback(() => {
    if (!editingPresetId || !editingField || !editValue.trim()) {
      setEditingPresetId(null);
      setEditingField(null);
      return;
    }

    // Find the preset in allPresets to check if builtin
    const preset = allPresets.find((p) => p.id === editingPresetId);
    if (!preset) {
      setEditingPresetId(null);
      setEditingField(null);
      return;
    }

    if (preset.builtin) {
      // Use overrides for built-in presets
      setPresetOverrides((prev) => ({
        ...prev,
        [preset.id]: {
          ...prev[preset.id],
          [editingField]: editValue.trim(),
          ...(editingField === "prompt" ? { description: editValue.trim().slice(0, 80) } : {}),
        },
      }));
    } else {
      // Directly modify custom presets
      setCustomPresets((prev) =>
        prev.map((p) =>
          p.id === editingPresetId
            ? {
                ...p,
                [editingField]: editValue.trim(),
                ...(editingField === "prompt" ? { description: editValue.trim().slice(0, 80) } : {}),
              }
            : p
        )
      );
    }

    setEditingPresetId(null);
    setEditingField(null);
  }, [editingPresetId, editingField, editValue, allPresets, setPresetOverrides, setCustomPresets]);

  /* ─── Layout ─── */
  return (
    <div className="flex flex-col relative z-40 h-full" data-prompt-pane>

      {/* Toolbar strip */}
      <div
        className="h-10 px-5 flex items-center gap-5 text-xs font-medium shrink-0"
        style={{ color: "var(--fg-muted)" }}
      >
        <button
          onClick={handleSavePreset}
          disabled={!text.trim()}
          className="flex items-center gap-[6px] hover:text-[var(--fg)] transition-colors disabled:opacity-30"
        >
          <FloppyDisk size={14} /> Save
        </button>
        <button
          onClick={handleCopy}
          disabled={!text.trim()}
          className="flex items-center gap-[6px] hover:text-[var(--fg)] transition-colors disabled:opacity-30"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <PromptHints text={text} mentionCount={mentions.length} />
        <span className="ml-auto" />
      </div>

      {/* Prompt textarea container */}
      <div className={`px-5 pb-4 flex flex-col relative ${expanded ? "flex-1 min-h-0" : ""}`}>
        <div className={`glass-input p-3 rounded-xl flex flex-col relative transition-all duration-300 group ${expanded ? "flex-1 min-h-0" : ""}`}>
          {/* Maximize button */}
          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-6 h-6 rounded flex items-center justify-center transition-all border"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--fg-muted)",
                background: "var(--surface-dark)",
              }}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <CornersIn size={14} /> : <CornersOut size={14} />}
            </button>
          </div>

          <div className={`flex-1 min-w-0 ${expanded ? "h-full" : ""}`}>
            <MentionInput
              ref={mentionInputRef}
              value={text}
              onChange={setText}
              mentions={mentions}
              onMentionAdd={handleMentionAdd}
              onMentionRemove={handleMentionRemove}
              onSubmit={handleSend}
              placeholder="Describe what you want to build... (@ to reference)"
              expanded={expanded}
              siteUrl={site?.site_url}
            />
          </div>
          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={(!text.trim() && mentions.length === 0) || !session}
            className="absolute bottom-3 right-3 w-[34px] h-[34px] rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 z-20"
            style={{
              background: "var(--yellow)",
              color: "#000",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
            title={session ? "Send (Cmd+Enter)" : "No active session"}
          >
            <PaperPlaneTilt size={16} weight="bold" />
          </button>
        </div>
      </div>

      {mentions.length > 0 && (
        <div className="px-5 pb-2 shrink-0">
          <ContextPreview
            contextBlock={compose(text, resolvedContexts).contextBlock}
            mentions={mentions.map((m) => ({ type: m.type, label: m.label }))}
          />
        </div>
      )}

      {/* Tags reference strip */}
      <div className="px-5 pb-4 flex items-center gap-2 overflow-x-auto shrink-0">
        {site && (
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 white-glass border rounded-md text-[11px] font-mono whitespace-nowrap shadow-sm"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
              style={{ background: "var(--green)" }}
            />
            <span className="tracking-tight font-medium" style={{ color: "var(--fg)" }}>
              {site.name}
            </span>
            {site.environment && (
              <span
                className="px-2 py-[2px] rounded font-bold text-[10px] shadow-sm tracking-widest ml-1"
                style={{ background: "var(--yellow)", color: "#000" }}
              >
                {site.environmentLabel ||
                  (site.environment === "production" ? "PROD" :
                   site.environment === "staging" ? "STG" : "LOCAL")}
              </span>
            )}
          </div>
        )}
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.type}
            onClick={() => handleChipClick(chip.type)}
            className="tag-btn px-2.5 py-1.5 rounded-md text-[11px] font-mono cursor-pointer"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Presets section — flex-1 to fill remaining space, scrollable */}
      {!expanded && (
        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 pt-4 pill-glass border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {/* Inline edit overlay for prompt editing */}
          {editingPresetId && editingField === "prompt" && (
            <div
              className="mb-3 rounded-xl border p-3"
              style={{ background: "var(--surface-dark)", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: "var(--fg-muted)" }}>
                  Edit Prompt
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingPresetId(null); setEditingField(null); }}
                    className="text-[11px] px-2 py-0.5 rounded"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFinishEdit}
                    className="text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{ background: "var(--yellow)", color: "#000" }}
                  >
                    Save
                  </button>
                </div>
              </div>
              <textarea
                ref={editTextareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setEditingPresetId(null); setEditingField(null); }
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleFinishEdit();
                }}
                className="w-full rounded-lg px-3 py-2 text-[12px] outline-none glass-input border"
                style={{ borderColor: "var(--border-subtle)", color: "var(--fg)", minHeight: 60, resize: "vertical" }}
                rows={3}
              />
            </div>
          )}

          {/* Search input */}
          <div
            className="mb-3 flex items-center gap-2 glass-input border rounded-lg px-3 py-2 text-[12px] max-w-xs transition-colors focus-within:text-[var(--fg)]"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fg-subtle)" }}
          >
            <MagnifyingGlass size={14} />
            <input
              type="text"
              value={presetSearch}
              onChange={(e) => setPresetSearch(e.target.value)}
              placeholder="Search presets..."
              className="bg-transparent border-none outline-none w-full placeholder-[var(--fg-subtle)]"
              style={{ color: "var(--fg)" }}
            />
          </div>

          {/* Preset chips with context menu */}
          <div className="flex flex-wrap gap-2">
            {filteredPresets.map((preset) => (
              <ContextMenu.Root key={preset.id}>
                <ContextMenu.Trigger asChild>
                  {editingPresetId === preset.id && editingField === "name" ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleFinishEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleFinishEdit();
                        if (e.key === "Escape") { setEditingPresetId(null); setEditingField(null); }
                      }}
                      className="preset-btn px-3 py-1.5 text-[11px] font-sans rounded-md font-medium outline-none"
                      style={{
                        background: "var(--yellow)",
                        color: "#000",
                        minWidth: 60,
                        width: `${Math.max(editValue.length * 7, 60)}px`,
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => handlePresetSelect(preset)}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        handleStartRename(preset);
                      }}
                      className="preset-btn px-3 py-1.5 text-[11px] font-sans rounded-md font-medium"
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  )}
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Content
                    className="context-menu-content min-w-[180px] rounded-xl py-2"
                  >
                    <ContextMenu.Item
                      className="context-menu-item flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-pointer outline-none"
                      onSelect={() => handleStartRename(preset)}
                    >
                      <TextAa size={15} style={{ color: "var(--fg-muted)" }} />
                      <span>Rename</span>
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="context-menu-item flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-pointer outline-none"
                      onSelect={() => handleStartEditPrompt(preset)}
                    >
                      <PencilSimple size={15} style={{ color: "var(--fg-muted)" }} />
                      <span>Edit Prompt</span>
                    </ContextMenu.Item>
                    <ContextMenu.Separator
                      className="my-1 mx-3 h-px"
                      style={{ background: "var(--border-subtle)" }}
                    />
                    <ContextMenu.Item
                      className="context-menu-item flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-pointer outline-none"
                      onSelect={() => handleDeletePreset(preset)}
                    >
                      <Trash size={15} style={{ color: "var(--destructive)" }} />
                      <span style={{ color: "var(--destructive)" }}>Delete</span>
                    </ContextMenu.Item>
                  </ContextMenu.Content>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            ))}
            {filteredPresets.length === 0 && presetSearch && (
              <span className="text-[11px] px-2 py-1" style={{ color: "var(--fg-muted)" }}>
                No matches
              </span>
            )}
          </div>

          {/* Recent history */}
          {history.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1 mb-1.5" style={{ color: "var(--fg-muted)" }}>
                <ClockCounterClockwise size={11} />
                <span className="text-[10px] uppercase tracking-wider font-medium">Recent</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.slice(0, 8).map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => setText(entry.text)}
                    className="preset-btn px-3 py-1.5 text-[11px] font-sans rounded-md truncate max-w-[200px]"
                    title={entry.text}
                  >
                    {entry.text.length > 40 ? entry.text.slice(0, 40) + "..." : entry.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
