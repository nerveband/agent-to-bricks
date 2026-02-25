import { useMemo } from "react";
import type { MentionToken, MentionType } from "../atoms/prompts";

const MENTION_TYPES: MentionType[] = [
  "page", "section", "element", "class", "color", "variable", "component", "media",
  "template", "form", "loop", "condition",
];

const MENTION_REGEX = /@(page|section|element|class|color|variable|component|media|template|form|loop|condition)(?:\(([^)]*)\))?/g;

export interface ParsedPrompt {
  rawText: string;
  mentions: MentionToken[];
  textWithoutMentions: string;
}

export function parseMentions(text: string): ParsedPrompt {
  const mentions: MentionToken[] = [];
  const regex = new RegExp(MENTION_REGEX.source, "g");
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    mentions.push({
      type: m[1] as MentionType,
      query: m[2] ?? "",
      displayName: "",
      resolvedId: null,
      resolvedData: null,
      startPos: m.index,
      endPos: m.index + m[0].length,
    });
  }

  const textWithoutMentions = text.replace(regex, "").replace(/\s{2,}/g, " ").trim();

  return { rawText: text, mentions, textWithoutMentions };
}

export function useMentionParser(text: string): ParsedPrompt {
  return useMemo(() => parseMentions(text), [text]);
}

export { MENTION_TYPES };
