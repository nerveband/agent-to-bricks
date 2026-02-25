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
  imageUrl?: string;
}

export function useMentionSearch(
  type: MentionType | null,
  query: string,
  sectionPageId?: number | null
) {
  const site = useAtomValue(activeSiteAtom);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!type || !site) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await fetchByType(type, query, site.site_url, site.api_key, sectionPageId ?? null);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [type, query, site, sectionPageId]);

  return { results, loading };
}

async function fetchByType(
  type: MentionType,
  query: string,
  siteUrl: string,
  apiKey: string,
  sectionPageId: number | null
): Promise<SearchResult[]> {
  switch (type) {
    case "page": {
      const pages = await invoke<{ id: number; title: string; slug: string }[]>(
        "search_pages",
        { siteUrl, apiKey, query, perPage: 10 }
      );
      return pages.map((p) => ({
        id: p.id,
        label: p.title,
        sublabel: `ID: ${p.id} · /${p.slug}`,
        data: p,
      }));
    }
    case "section": {
      if (sectionPageId) {
        // Fetch elements for the selected page
        const resp = await invoke<{ elements: { id: string; name: string; label: string | null; parent: string | null }[]; count: number }>(
          "get_page_elements",
          { siteUrl, apiKey, pageId: sectionPageId }
        );
        // Show elements — prefer top-level (no parent or parent is "0"/falsy)
        const elements = resp.elements ?? [];
        const topLevel = elements.filter((e) => !e.parent || e.parent === "0");
        // If no top-level found, show all elements
        const candidates = topLevel.length > 0 ? topLevel : elements;
        const filtered = query
          ? candidates.filter((e) => (e.label ?? e.name).toLowerCase().includes(query.toLowerCase()))
          : candidates;
        return filtered.map((e) => ({
          id: e.id,
          label: e.label || e.name,
          sublabel: `Element: ${e.name}`,
          data: { ...e, pageId: sectionPageId },
        }));
      }
      // No page selected yet — show pages to pick from
      const pages = await invoke<{ id: number; title: string; slug: string }[]>(
        "search_pages",
        { siteUrl, apiKey, query, perPage: 10 }
      );
      return pages.map((p) => ({
        id: p.id,
        label: p.title,
        sublabel: `ID: ${p.id} · /${p.slug}`,
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
        imageUrl: m.mimeType.startsWith("image/") ? m.url : undefined,
      }));
    }
    case "template": {
      const resp = await invoke<{ templates: { id: number; title: string; type: string }[] }>(
        "get_templates",
        { siteUrl, apiKey }
      );
      const templates = resp.templates ?? [];
      const filtered = query
        ? templates.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
        : templates;
      return filtered.slice(0, 20).map((t) => ({
        id: t.id,
        label: t.title,
        sublabel: t.type ?? "template",
        data: t,
      }));
    }
    case "form": {
      const resp = await invoke<{ results: { elementId: string; elementType: string; elementLabel: string; postTitle: string }[] }>(
        "search_elements",
        { siteUrl, apiKey, elementType: "form", perPage: 20 }
      );
      const forms = (resp.results ?? []).filter((e) =>
        !query || (e.elementLabel ?? e.elementType).toLowerCase().includes(query.toLowerCase())
      );
      return forms.map((e) => ({
        id: e.elementId,
        label: e.elementLabel || "Form",
        sublabel: e.postTitle,
        data: e,
      }));
    }
    case "loop": {
      const resp = await invoke<{ results: { elementId: string; elementType: string; elementLabel: string; postTitle: string }[] }>(
        "search_elements",
        { siteUrl, apiKey, elementType: "posts", perPage: 20 }
      );
      const loops = (resp.results ?? []).filter((e) =>
        !query || (e.elementLabel ?? e.elementType).toLowerCase().includes(query.toLowerCase())
      );
      return loops.map((e) => ({
        id: e.elementId,
        label: e.elementLabel || "Query Loop",
        sublabel: e.postTitle,
        data: e,
      }));
    }
    case "condition": {
      // Conditions are freeform references — show common condition types
      const CONDITIONS = [
        { id: "logged-in", label: "User Logged In", sublabel: "Show only to logged-in users" },
        { id: "logged-out", label: "User Logged Out", sublabel: "Show only to logged-out users" },
        { id: "post-type", label: "Post Type", sublabel: "Match specific post type" },
        { id: "page-template", label: "Page Template", sublabel: "Match page template" },
        { id: "user-role", label: "User Role", sublabel: "Match user role" },
        { id: "date-range", label: "Date Range", sublabel: "Show within date range" },
        { id: "dynamic-data", label: "Dynamic Data", sublabel: "Based on dynamic field value" },
        { id: "browser", label: "Browser / Device", sublabel: "Target specific browser or device" },
      ];
      const filtered = query
        ? CONDITIONS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
        : CONDITIONS;
      return filtered.map((c) => ({ ...c, data: c }));
    }
    default:
      return [];
  }
}
