export type AppIntent =
  | { type: "add-site"; name?: string; url?: string; apiKey?: string }
  | { type: "switch-site"; name: string }
  | { type: "update-config"; field: string; value: string }
  | { type: "save-preset"; name: string }
  | { type: "update-setting"; key: string; value: string }
  | { type: "theme"; value: "dark" | "light" }
  | { type: "show-history" }
  | { type: "site-action" };

const patterns: Array<{ regex: RegExp; extract: (m: RegExpMatchArray, text: string) => AppIntent }> = [
  {
    regex: /^(?:add|new|connect)\s+(?:a\s+)?site\b/i,
    extract: (_m, text) => {
      const nameMatch = text.match(/(?:called|named)\s+"?([^"]+?)"?\s+(?:at|url)/i);
      const urlMatch = text.match(/(?:at|url)\s+(https?:\/\/\S+)/i);
      const keyMatch = text.match(/(?:key|api[_-]?key)\s+(\S+)/i);
      return {
        type: "add-site",
        name: nameMatch?.[1]?.trim(),
        url: urlMatch?.[1]?.trim(),
        apiKey: keyMatch?.[1]?.trim(),
      };
    },
  },
  {
    regex: /^(?:switch|change|use)\s+(?:to\s+)?(?:the\s+)?(?:site\s+)?["']?(.+?)["']?\s*(?:site)?$/i,
    extract: (m) => ({ type: "switch-site", name: m[1].trim() }),
  },
  {
    regex: /(?:change|update|set)\s+(?:my\s+)?api[_\s-]?key\s+(?:to\s+)?(\S+)/i,
    extract: (m) => ({ type: "update-config", field: "api_key", value: m[1] }),
  },
  {
    regex: /save\s+(?:this\s+)?(?:as\s+)?(?:a\s+)?(?:preset|template)\s*(?:called|named)?\s*["']?(.+?)["']?$/i,
    extract: (m) => ({ type: "save-preset", name: m[1].trim() }),
  },
  {
    regex: /(?:set|change)\s+(?:default\s+)?tool\s+(?:to\s+)?(\w+)/i,
    extract: (m) => ({ type: "update-setting", key: "default_tool", value: m[1] }),
  },
  {
    regex: /(?:use|switch\s+to|enable)\s+(dark|light)\s*(?:mode|theme)?/i,
    extract: (m) => ({ type: "theme", value: m[1].toLowerCase() as "dark" | "light" }),
  },
  {
    regex: /(?:show|view|open)\s+(?:my\s+)?(?:prompt\s+)?history/i,
    extract: () => ({ type: "show-history" }),
  },
];

export function classifyIntent(text: string): AppIntent {
  const trimmed = text.trim();
  for (const { regex, extract } of patterns) {
    const match = trimmed.match(regex);
    if (match) return extract(match, trimmed);
  }
  return { type: "site-action" };
}
