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
  const regex = /(\{\{[\w]+\}\}|\{[\w]+\}|@(?:page|section|element|class|color|variable|component|media|template|form|loop|condition)(?:\s+[^\s@{]+)?)/g;

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
