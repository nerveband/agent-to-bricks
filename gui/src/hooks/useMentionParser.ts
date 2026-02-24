import { useMemo } from "react";
import type { MentionToken, MentionType } from "../atoms/prompts";

const MENTION_TYPES: MentionType[] = [
  "page", "section", "element", "class", "color", "variable", "component", "media",
];

const MENTION_REGEX = /@(page|section|element|class|color|variable|component|media)(?:\(([^)]*)\))?/g;

export interface ParsedPrompt {
  rawText: string;
  mentions: MentionToken[];
  textWithoutMentions: string;
}

export function parseMentions(text: string): ParsedPrompt {
  const mentions: MentionToken[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, "g");

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      type: match[1] as MentionType,
      query: match[2] ?? "",
      displayName: "",
      resolvedId: null,
      resolvedData: null,
      startPos: match.index,
      endPos: match.index + match[0].length,
    });
  }

  const textWithoutMentions = text.replace(regex, "").replace(/\s{2,}/g, " ").trim();

  return { rawText: text, mentions, textWithoutMentions };
}

export function useMentionParser(text: string): ParsedPrompt {
  return useMemo(() => parseMentions(text), [text]);
}

export { MENTION_TYPES };
