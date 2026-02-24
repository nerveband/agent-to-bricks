import { useState } from "react";
import { useAtomValue } from "jotai";
import { experienceLevelAtom, promptCountAtom, hintPreferenceAtom } from "../../atoms/app";
import { Copy, Check, CaretDown, CaretRight, GraduationCap } from "@phosphor-icons/react";

interface LearnCardProps {
  composedPrompt: string;
  cliEquivalent?: string;
}

export function LearnCard({ composedPrompt, cliEquivalent }: LearnCardProps) {
  const experience = useAtomValue(experienceLevelAtom);
  const hintPref = useAtomValue(hintPreferenceAtom);
  const promptCount = useAtomValue(promptCountAtom);
  const [expanded, setExpanded] = useState(
    hintPref === "always" || (hintPref === "auto" && promptCount <= 10)
  );
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const shouldShow =
    hintPref === "always" ||
    (hintPref === "auto" && (experience === "beginner" || promptCount <= 50));

  if (!shouldShow || !composedPrompt) return null;

  const copyRaw = async () => {
    await navigator.clipboard.writeText(composedPrompt);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const copyCli = async () => {
    if (cliEquivalent) {
      await navigator.clipboard.writeText(cliEquivalent);
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    }
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
        <GraduationCap size={14} />
        {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
        <span>What just happened</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          <div className="mt-2">
            <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--fg-muted)" }}>
              Without the GUI, you could type:
            </div>
            <pre
              className="p-2 rounded text-[12px] whitespace-pre-wrap font-mono"
              style={{ background: "var(--surface)", color: "var(--fg)" }}
            >
              {composedPrompt}
            </pre>
            <button
              onClick={copyRaw}
              className="mt-1 flex items-center gap-1 text-[11px]"
              style={{ color: "var(--fg-muted)" }}
            >
              {copiedRaw ? <Check size={10} /> : <Copy size={10} />}
              {copiedRaw ? "Copied" : "Copy"}
            </button>
          </div>

          {cliEquivalent && (
            <div>
              <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--fg-muted)" }}>
                CLI equivalent:
              </div>
              <pre
                className="p-2 rounded text-[12px] whitespace-pre-wrap font-mono"
                style={{ background: "var(--surface)", color: "var(--fg)" }}
              >
                {cliEquivalent}
              </pre>
              <button
                onClick={copyCli}
                className="mt-1 flex items-center gap-1 text-[11px]"
                style={{ color: "var(--fg-muted)" }}
              >
                {copiedCli ? <Check size={10} /> : <Copy size={10} />}
                {copiedCli ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
