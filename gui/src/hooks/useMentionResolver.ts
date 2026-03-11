import { useCallback, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { activeSiteAtom } from "../atoms/app";
import { mentionCacheAtom, CACHE_TTL_MS } from "../atoms/prompts";
import type { MentionToken } from "../atoms/prompts";
import { formatElementTree } from "../lib/contextFormatter";

export function useMentionResolver() {
  const site = useAtomValue(activeSiteAtom);
  const cache = useAtomValue(mentionCacheAtom);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const setCache = useSetAtom(mentionCacheAtom);

  const resolve = useCallback(
    async (mention: MentionToken): Promise<string> => {
      if (!site || !mention.resolvedId) return "";

      const cacheKey = `${mention.type}:${mention.resolvedId}`;
      const cached = cacheRef.current[cacheKey];
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
          case "query":
          case "loop": {
            const data = mention.resolvedData as { postTitle?: string; elementType?: string; settings?: Record<string, unknown> } | null;
            const query = data?.settings?.query as Record<string, unknown> | undefined;
            const postTypes = Array.isArray(query?.post_type)
              ? query?.post_type.filter((v): v is string => typeof v === "string")
              : [];
            const querySummary = [
              typeof query?.objectType === "string" ? query.objectType : undefined,
              postTypes.length > 0 ? `post_type=${postTypes.join(",")}` : undefined,
            ].filter(Boolean).join(" · ");
            formatted = `Query element: ${mention.displayName}${data?.elementType ? ` (${data.elementType})` : ""}${data?.postTitle ? ` on ${data.postTitle}` : ""}${querySummary ? ` [${querySummary}]` : ""}`;
            break;
          }
          case "product": {
            const data = mention.resolvedData as { sku?: string; price?: string; status?: string; slug?: string } | null;
            formatted = `WooCommerce product: ${mention.displayName}${data?.sku ? ` (SKU ${data.sku})` : ""}${data?.price ? ` price ${data.price}` : ""}${data?.status ? ` status ${data.status}` : ""}${data?.slug ? ` slug ${data.slug}` : ""}`;
            break;
          }
          case "product-category": {
            const data = mention.resolvedData as { slug?: string; count?: number } | null;
            formatted = `WooCommerce product category: ${mention.displayName}${data?.slug ? ` (${data.slug})` : ""}${typeof data?.count === "number" ? ` with ${data.count} products` : ""}`;
            break;
          }
          case "product-tag": {
            const data = mention.resolvedData as { slug?: string; count?: number } | null;
            formatted = `WooCommerce product tag: ${mention.displayName}${data?.slug ? ` (${data.slug})` : ""}${typeof data?.count === "number" ? ` with ${data.count} products` : ""}`;
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
    [site, setCache]
  );

  return { resolve };
}
