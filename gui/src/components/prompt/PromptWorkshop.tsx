import { useState, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeSiteAtom, promptCountAtom } from "../../atoms/app";
import {
  promptHistoryAtom,
  customPresetsAtom,
  type PromptPreset,
  type PromptHistoryEntry,
  type ResolvedMention,
} from "../../atoms/prompts";
import { activeSessionAtom } from "../../atoms/sessions";
import { MentionInput } from "./MentionInput";
import { PromptHints } from "./PromptHints";
import { ContextPreview } from "./ContextPreview";
import { PresetList } from "./PresetList";
import { LearnCard } from "./LearnCard";
import { useMentionResolver } from "../../hooks/useMentionResolver";
import { usePromptComposer } from "../../hooks/usePromptComposer";
import { writeToActivePty } from "../../atoms/ptyBridge";
import {
  PaperPlaneRight,
  FloppyDisk,
  Copy,
  Check,
  ClockCounterClockwise,
  Notebook,
} from "@phosphor-icons/react";

export function PromptWorkshop() {
  const site = useAtomValue(activeSiteAtom);
  const session = useAtomValue(activeSessionAtom);
  const [history, setHistory] = useAtom(promptHistoryAtom);
  const setCustomPresets = useSetAtom(customPresetsAtom);
  const setPromptCount = useSetAtom(promptCountAtom);
  const { resolve } = useMentionResolver();
  const { compose } = usePromptComposer();

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ResolvedMention[]>([]);
  const [resolvedContexts, setResolvedContexts] = useState<Map<string, string>>(new Map());
  const [lastComposed, setLastComposed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"presets" | "history">("presets");

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

    setLastComposed(composed.fullText);

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

  return (
    <div className="flex flex-col h-full p-3 gap-3" data-prompt-workshop>
      {site ? (
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#34d399" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }} />
          {site.name} ({(() => { try { return new URL(site.site_url).hostname; } catch { return site.site_url; } })()})
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--accent)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
          No site connected — use Settings or type "add site..." in Cmd+P
        </div>
      )}

      <div>
        <MentionInput
          value={text}
          onChange={setText}
          mentions={mentions}
          onMentionAdd={handleMentionAdd}
          onMentionRemove={handleMentionRemove}
          maxRows={8}
          onSubmit={handleSend}
        />
        <PromptHints text={text} mentionCount={mentions.length} />

        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={handleSend}
            disabled={(!text.trim() && mentions.length === 0) || !session}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-medium transition-colors disabled:opacity-30"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            <PaperPlaneRight size={12} weight="bold" />
            Send
          </button>
          <button
            onClick={handleSavePreset}
            disabled={!text.trim()}
            className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors disabled:opacity-30"
            style={{ color: "var(--fg-muted)", background: "var(--bg)" }}
          >
            <FloppyDisk size={12} />
            Save
          </button>
          <button
            onClick={handleCopy}
            disabled={!text.trim()}
            className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors disabled:opacity-30"
            style={{ color: "var(--fg-muted)", background: "var(--bg)" }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {mentions.length > 0 && (
        <ContextPreview
          contextBlock={compose(text, resolvedContexts).contextBlock}
          mentions={mentions.map((m) => ({ type: m.type, label: m.label }))}
        />
      )}

      {lastComposed && <LearnCard composedPrompt={lastComposed} />}

      <div className="flex items-center gap-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setView("presets")}
          className="flex items-center gap-1 text-[12px]"
          style={{ color: view === "presets" ? "var(--accent)" : "var(--fg-muted)" }}
        >
          <Notebook size={12} />
          Presets
        </button>
        <button
          onClick={() => setView("history")}
          className="flex items-center gap-1 text-[12px]"
          style={{ color: view === "history" ? "var(--accent)" : "var(--fg-muted)" }}
        >
          <ClockCounterClockwise size={12} />
          History
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === "presets" ? (
          <PresetList onSelect={handlePresetSelect} />
        ) : (
          <div className="space-y-1">
            {history.length === 0 && (
              <p className="text-[13px] px-2 py-4" style={{ color: "var(--fg-muted)" }}>
                No prompts yet. Send your first prompt above.
              </p>
            )}
            {history.map((entry, i) => (
              <button
                key={i}
                onClick={() => {
                  setText(entry.text);
                  setView("presets");
                }}
                className="w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors"
                style={{ color: "var(--fg)" }}
              >
                <div className="truncate">{entry.text}</div>
                <div className="text-[10px]" style={{ color: "var(--fg-muted)" }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                  {entry.mentions.length > 0 && ` \u00b7 ${entry.mentions.length} references`}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
