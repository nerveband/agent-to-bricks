import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { experienceLevelAtom, hintPreferenceAtom, promptCountAtom } from "../../atoms/app";
import { Lightbulb, CheckCircle } from "@phosphor-icons/react";

interface PromptHintsProps {
  text: string;
  mentionCount: number;
}

interface Hint {
  message: string;
  priority: number;
}

const VAGUE_PATTERNS: Array<{ regex: RegExp; hint: string }> = [
  { regex: /\bmake it (?:better|nicer|good|modern|clean)\b/i, hint: "Try describing specifics — colors, layout, typography, spacing" },
  { regex: /\bimprove\b/i, hint: "What should improve? Visual design, performance, content, structure?" },
  { regex: /\bfix it\b/i, hint: "Describe what's broken — spacing off, wrong color, missing element?" },
  { regex: /\bupdate\b(?!.*(?:section|heading|button|text|image|hero|footer|nav))/i, hint: "Update what specifically? Try naming the section or element type" },
  { regex: /\bchange\b(?!.*(?:to|from|color|font|size|width))/i, hint: "Change to what? Add the target value — color, size, text, etc." },
];

export function PromptHints({ text, mentionCount }: PromptHintsProps) {
  const experience = useAtomValue(experienceLevelAtom);
  const hintPref = useAtomValue(hintPreferenceAtom);
  const promptCount = useAtomValue(promptCountAtom);

  const shouldShow = useMemo(() => {
    if (hintPref === "never") return false;
    if (hintPref === "always") return true;
    if (experience === "advanced" || promptCount > 50) return false;
    if (experience === "intermediate" || promptCount > 10) return text.length > 5;
    return true;
  }, [hintPref, experience, promptCount, text]);

  const hints = useMemo((): Hint[] => {
    if (!text.trim() || !shouldShow) return [];
    const found: Hint[] = [];

    for (const { regex, hint } of VAGUE_PATTERNS) {
      if (regex.test(text)) {
        found.push({ message: hint, priority: 2 });
      }
    }

    if (
      text.length > 15 &&
      mentionCount === 0 &&
      /\b(?:page|section|hero|footer|header|nav|form|card)\b/i.test(text) &&
      !/@page/.test(text)
    ) {
      found.push({ message: "Which page? Type @ to reference a specific page", priority: 1 });
    }

    return found.sort((a, b) => a.priority - b.priority).slice(0, 1);
  }, [text, mentionCount, shouldShow]);

  if (!text.trim() || !shouldShow) return null;

  if (hints.length === 0 && text.length > 20 && mentionCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-1 py-1 text-[12px]" style={{ color: "#34d399" }}>
        <CheckCircle size={14} weight="fill" />
        <span>Good prompt</span>
      </div>
    );
  }

  if (hints.length === 0) return null;

  return (
    <div className="flex items-start gap-1.5 px-1 py-1 text-[12px]" style={{ color: "var(--fg-muted)" }}>
      <Lightbulb size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
      <span>{hints[0].message}</span>
    </div>
  );
}
