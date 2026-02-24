import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { activeSiteAtom } from "../atoms/app";
import { mentionCacheAtom, CACHE_TTL_MS } from "../atoms/prompts";
import type { MentionToken } from "../atoms/prompts";
import { formatElementTree } from "../lib/contextFormatter";

export function useMentionResolver() {
  const site = useAtomValue(activeSiteAtom);
  const cache = useAtomValue(mentionCacheAtom);
  const setCache = useSetAtom(mentionCacheAtom);

  const resolve = useCallback(
    async (mention: MentionToken): Promise<string> => {
      if (!site || !mention.resolvedId) return "";

      const cacheKey = `${mention.type}:${mention.resolvedId}`;
      const cached = cache[cacheKey];
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.data as string;
      }

      let formatted = "";

      try {
        switch (mention.type) {
          case "page":
          case "section": {
            const resp = await invoke<{ elements: Array<{ id: string; name: string; label?: string; parent?: string; children?: string[]; settings?: Record<string, unknown> }> }>(
              "get_page_elements",
              { siteUrl: site.site_url, apiKey: site.api_key, pageId: Number(mention.resolvedId) }
            );
            formatted = formatElementTree(
              resp.elements,
              mention.displayName,
              mention.resolvedId
            );
            if (mention.type === "section") {
              const lines = formatted.split("\n");
              const sectionLines = lines.filter(
                (l) => l.includes("[section]") || l.startsWith("Page ")
              );
              formatted = sectionLines.join("\n");
            }
            break;
          }
          case "class": {
            formatted = `Global class: .${mention.displayName}`;
            break;
          }
          case "color": {
            const data = mention.resolvedData as { color?: string } | null;
            formatted = `Color: ${mention.displayName} (${data?.color ?? "unknown"})`;
            break;
          }
          case "variable": {
            const data = mention.resolvedData as { value?: string } | null;
            formatted = `CSS Variable: ${mention.displayName}: ${data?.value ?? "unknown"}`;
            break;
          }
          case "component": {
            formatted = `Reusable component: "${mention.displayName}"`;
            break;
          }
          case "media": {
            const data = mention.resolvedData as { url?: string; mimeType?: string } | null;
            formatted = `Media: ${mention.displayName} (${data?.mimeType ?? "file"}) ${data?.url ?? ""}`;
            break;
          }
          default: {
            formatted = `${mention.type}: ${mention.displayName}`;
          }
        }
      } catch (err) {
        formatted = `[Failed to load ${mention.type}: ${mention.displayName}]`;
      }

      setCache((prev) => ({
        ...prev,
        [cacheKey]: { data: formatted, fetchedAt: Date.now() },
      }));

      return formatted;
    },
    [site, cache, setCache]
  );

  return { resolve };
}
