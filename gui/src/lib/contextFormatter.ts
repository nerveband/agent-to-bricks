interface Element {
  id: string;
  name: string;
  label?: string;
  parent?: string;
  children?: string[];
  settings?: Record<string, unknown>;
}

export function formatElementTree(
  elements: Element[],
  pageTitle: string,
  pageId: number | string
): string {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const roots = elements.filter((e) => !e.parent || e.parent === "0");

  const lines: string[] = [`Page "${pageTitle}" (ID: ${pageId}):`];

  function walk(el: Element, prefix: string, isLast: boolean) {
    const connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
    const label = el.label || el.name;
    const settingsSummary = summarizeSettings(el);
    lines.push(`${prefix}${connector}[${el.name}] ${label}${settingsSummary}`);

    const childPrefix = prefix + (isLast ? "    " : "\u2502   ");
    const childIds = el.children ?? [];
    childIds.forEach((cid, i) => {
      const child = byId.get(cid);
      if (child) walk(child, childPrefix, i === childIds.length - 1);
    });
  }

  roots.forEach((r, i) => walk(r, "", i === roots.length - 1));
  return lines.join("\n");
}

function summarizeSettings(el: Element): string {
  if (!el.settings) return "";
  const s = el.settings;
  const parts: string[] = [];
  if (s.tag && s.tag !== "div") parts.push(`<${s.tag}>`);
  if (typeof s.text === "string" && s.text.length > 0) {
    parts.push(`"${(s.text as string).slice(0, 50)}${(s.text as string).length > 50 ? "..." : ""}"`);
  }
  if (s.link && typeof s.link === "object" && (s.link as Record<string, unknown>).url) {
    parts.push(`-> ${(s.link as Record<string, unknown>).url}`);
  }
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

export function formatClassInfo(cls: { name: string; framework?: string; settings?: unknown }): string {
  return `.${cls.name}${cls.framework ? ` (${cls.framework})` : ""}`;
}

export function formatComponentSummary(comp: { title: string; elementCount?: number }): string {
  return `Component "${comp.title}" (${comp.elementCount ?? "?"} elements)`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
