import { useState, useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  paletteOpenAtom,
  activeSiteAtom,
  sitesAtom,
  activeSiteIndexAtom,
  promptCountAtom,
  themeAtom,
} from "../atoms/app";
import {
  promptHistoryAtom,
  type MentionType,
  type PromptHistoryEntry,
} from "../atoms/prompts";
import { activeSessionAtom } from "../atoms/sessions";
import { useSessionLauncher } from "../hooks/useSessionLauncher";
import { toolsAtom } from "../atoms/tools";
import { MentionInput } from "./prompt/MentionInput";
import { ContextPreview } from "./prompt/ContextPreview";
import { PromptHints } from "./prompt/PromptHints";
import { useMentionResolver } from "../hooks/useMentionResolver";
import { usePromptComposer } from "../hooks/usePromptComposer";
import { classifyIntent } from "../lib/intentClassifier";
import { writeToActivePty } from "../atoms/ptyBridge";
import {
  PaperPlaneRight,
  Lightning,
  ClockCounterClockwise,
  Copy,
  Check,
  X,
} from "@phosphor-icons/react";

interface ResolvedMention {
  type: MentionType;
  id: string | number;
  label: string;
  data?: unknown;
}

export function CommandPalette() {
  const [open, setOpen] = useAtom(paletteOpenAtom);
  const site = useAtomValue(activeSiteAtom);
  const session = useAtomValue(activeSessionAtom);
  const [sites, setSites] = useAtom(sitesAtom);
  const setActiveSiteIdx = useSetAtom(activeSiteIndexAtom);
  const [history, setHistory] = useAtom(promptHistoryAtom);
  const setPromptCount = useSetAtom(promptCountAtom);
  const setTheme = useSetAtom(themeAtom);
  const tools = useAtomValue(toolsAtom);
  const { launch } = useSessionLauncher();
  const { resolve } = useMentionResolver();
  const { compose } = usePromptComposer();

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ResolvedMention[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [resolvedContexts, setResolvedContexts] = useState<Map<string, string>>(new Map());
  const [appActionResult, setAppActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRecent, setShowRecent] = useState(true);
  const backdropRef = useRef<HTMLDivElement>(null);

  const quickChips: { type: MentionType; label: string }[] = [
    { type: "page", label: "@page" },
    { type: "section", label: "@section" },
    { type: "class", label: "@class" },
    { type: "color", label: "@color" },
    { type: "component", label: "@component" },
    { type: "media", label: "@media" },
  ];

  const handleClose = useCallback(() => {
    setOpen(false);
    setText("");
    setMentions([]);
    setShowPreview(false);
    setResolvedContexts(new Map());
    setAppActionResult(null);
  }, [setOpen]);

  const handleMentionAdd = useCallback((m: ResolvedMention) => {
    setMentions((prev) => [...prev, m]);
    setShowRecent(false);
  }, []);

  const handleMentionRemove = useCallback((index: number) => {
    setMentions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleChipClick = useCallback((type: MentionType) => {
    setText((prev) => prev + `@${type} `);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() && mentions.length === 0) return;

    const intent = classifyIntent(text);

    if (intent.type !== "site-action") {
      let result = { success: false, message: "" };

      switch (intent.type) {
        case "add-site": {
          const entry = {
            name: intent.name || "New Site",
            site_url: intent.url || "",
            api_key: intent.apiKey || "",
          };
          if (entry.site_url) {
            setSites((prev) => [...prev, entry]);
            setActiveSiteIdx(sites.length);
            result = { success: true, message: `Site "${entry.name}" added` };
          } else {
            result = { success: false, message: "Please include a URL (e.g., 'at https://mysite.com')" };
          }
          break;
        }
        case "switch-site": {
          const idx = sites.findIndex(
            (s) => s.name.toLowerCase().includes(intent.name.toLowerCase())
          );
          if (idx >= 0) {
            setActiveSiteIdx(idx);
            result = { success: true, message: `Switched to "${sites[idx].name}"` };
          } else {
            result = { success: false, message: `No site matching "${intent.name}"` };
          }
          break;
        }
        case "theme": {
          setTheme(intent.value);
          result = { success: true, message: `Switched to ${intent.value} mode` };
          break;
        }
        case "save-preset": {
          result = { success: true, message: `Preset "${intent.name}" saved` };
          break;
        }
        default:
          result = { success: true, message: "Done" };
      }

      setAppActionResult(result);
      return;
    }

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

    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    if (!session) {
      const claudeTool = tools.find((t) => t.slug === "claude-code" && t.installed);
      if (claudeTool) {
        launch(claudeTool);
        setTimeout(() => {
          writeToActivePty(composed.fullText + "\n");
        }, 1500);
      }
    } else {
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

    handleClose();
  }, [
    text, mentions, showPreview, session, tools, sites,
    resolve, compose, launch, handleClose,
    setSites, setActiveSiteIdx, setTheme, setHistory, setPromptCount,
  ]);

  const handleCopyComposed = useCallback(async () => {
    const ctxMap = resolvedContexts;
    const composed = compose(text, ctxMap);
    await navigator.clipboard.writeText(composed.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text, resolvedContexts, compose]);

  const handleLoadRecent = useCallback((entry: PromptHistoryEntry) => {
    setText(entry.text);
    setShowRecent(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleClose]);

  if (!open) return null;

  const composed = resolvedContexts.size > 0 ? compose(text, resolvedContexts) : null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === backdropRef.current && handleClose()}
    >
      <div
        className="w-full max-w-[640px] rounded-xl border shadow-2xl overflow-hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Lightning size={16} weight="fill" style={{ color: "var(--accent)" }} />
            <span className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
              Prompt Builder
            </span>
            {site && (
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: "var(--fg-muted)", background: "var(--bg)" }}>
                {site.name}
              </span>
            )}
          </div>
          <button onClick={handleClose} style={{ color: "var(--fg-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {appActionResult && (
          <div
            className="px-4 py-3 text-[13px]"
            style={{ color: appActionResult.success ? "#34d399" : "var(--destructive)" }}
          >
            {appActionResult.success ? "\u2713" : "\u2717"} {appActionResult.message}
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleClose}
                className="px-3 py-1 rounded text-[12px]"
                style={{ background: "var(--bg)", color: "var(--fg)" }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {!appActionResult && (
          <div className="p-4">
            <MentionInput
              value={text}
              onChange={setText}
              mentions={mentions}
              onMentionAdd={handleMentionAdd}
              onMentionRemove={handleMentionRemove}
              autoFocus
              onSubmit={handleSubmit}
            />

            <PromptHints text={text} mentionCount={mentions.length} />

            {site && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {quickChips.map((chip) => (
                  <button
                    key={chip.type}
                    onClick={() => handleChipClick(chip.type)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono transition-colors"
                    style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {!site && (
              <div
                className="mt-3 p-3 rounded-lg border text-[13px]"
                style={{ borderColor: "var(--accent)", background: `var(--accent)10` }}
              >
                <p style={{ color: "var(--fg)" }}>
                  No site connected. Type "add site [name] at [url] key [api_key]" or go to Settings.
                </p>
              </div>
            )}

            {showPreview && composed && (
              <div className="mt-3">
                <ContextPreview
                  contextBlock={composed.contextBlock}
                  mentions={mentions.map((m) => ({
                    type: m.type,
                    label: m.label,
                    context: resolvedContexts.get(`${m.type}:${m.id}`),
                  }))}
                  defaultExpanded
                />
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleSubmit}
                disabled={!text.trim() && mentions.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-30"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                <PaperPlaneRight size={14} weight="bold" />
                {showPreview ? "Send to Terminal" : "Send"}
                <span className="text-[10px] opacity-70 ml-1">{"\u2318\u21b5"}</span>
              </button>

              {showPreview && (
                <button
                  onClick={handleCopyComposed}
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-[12px] transition-colors"
                  style={{ color: "var(--fg-muted)", background: "var(--bg)" }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy Prompt"}
                </button>
              )}

              {!session && text.trim() && (
                <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                  No session {"\u2014"} will launch Claude Code
                </span>
              )}
            </div>

            {showRecent && !text && history.length > 0 && (
              <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-1 mb-2" style={{ color: "var(--fg-muted)" }}>
                  <ClockCounterClockwise size={12} />
                  <span className="text-[11px] uppercase tracking-wider">Recent</span>
                </div>
                {history.slice(0, 5).map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => handleLoadRecent(entry)}
                    className="w-full text-left px-2 py-1.5 rounded text-[13px] truncate transition-colors"
                    style={{ color: "var(--fg)" }}
                  >
                    {entry.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
