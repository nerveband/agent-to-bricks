import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { activeSiteAtom } from "../atoms/app";
import type { MentionType } from "../atoms/prompts";

export interface SearchResult {
  id: string | number;
  label: string;
  sublabel?: string;
  data?: unknown;
}

export function useMentionSearch(type: MentionType | null, query: string) {
  const site = useAtomValue(activeSiteAtom);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!type || !site) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);

    if (!query && !["color", "variable"].includes(type)) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await fetchByType(type, query, site.site_url, site.api_key);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [type, query, site]);

  return { results, loading };
}

async function fetchByType(
  type: MentionType,
  query: string,
  siteUrl: string,
  apiKey: string
): Promise<SearchResult[]> {
  switch (type) {
    case "page":
    case "section": {
      const pages = await invoke<{ id: number; title: string; slug: string }[]>(
        "search_pages",
        { siteUrl, apiKey, query, perPage: 10 }
      );
      return pages.map((p) => ({
        id: p.id,
        label: p.title,
        sublabel: `/${p.slug}`,
        data: p,
      }));
    }
    case "element": {
      const resp = await invoke<{ results: { elementId: string; elementType: string; elementLabel: string; postTitle: string }[] }>(
        "search_elements",
        { siteUrl, apiKey, elementType: query || undefined, perPage: 10 }
      );
      return (resp.results ?? []).map((e) => ({
        id: e.elementId,
        label: e.elementLabel || e.elementType,
        sublabel: e.postTitle,
        data: e,
      }));
    }
    case "class": {
      const resp = await invoke<{ classes: { id: number; name: string; framework: string }[] }>(
        "get_global_classes",
        { siteUrl, apiKey, framework: null }
      );
      const classes = resp.classes ?? [];
      const filtered = query
        ? classes.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
        : classes;
      return filtered.slice(0, 20).map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: c.framework ?? "custom",
        data: c,
      }));
    }
    case "color": {
      const resp = await invoke<{ colorPalette: { color: string; slug: string }[] }>(
        "get_site_styles",
        { siteUrl, apiKey }
      );
      const colors = resp.colorPalette ?? [];
      return colors.map((c) => ({
        id: c.slug,
        label: c.slug,
        sublabel: c.color,
        data: c,
      }));
    }
    case "variable": {
      const resp = await invoke<{ variables: { name: string; value: string }[] }>(
        "get_site_variables",
        { siteUrl, apiKey }
      );
      const vars = resp.variables ?? [];
      const filtered = query
        ? vars.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
        : vars;
      return filtered.slice(0, 20).map((v) => ({
        id: v.name,
        label: v.name,
        sublabel: v.value,
        data: v,
      }));
    }
    case "component": {
      const resp = await invoke<{ components: { id: number; title: string; elementCount: number }[] }>(
        "get_components",
        { siteUrl, apiKey }
      );
      return (resp.components ?? []).map((c) => ({
        id: c.id,
        label: c.title,
        sublabel: `${c.elementCount ?? 0} elements`,
        data: c,
      }));
    }
    case "media": {
      const resp = await invoke<{ media: { id: number; title: string; url: string; mimeType: string }[] }>(
        "get_media",
        { siteUrl, apiKey, search: query || null }
      );
      return (resp.media ?? []).map((m) => ({
        id: m.id,
        label: m.title,
        sublabel: m.mimeType,
        data: m,
      }));
    }
    default:
      return [];
  }
}
