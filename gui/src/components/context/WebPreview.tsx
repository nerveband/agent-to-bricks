import { useState, useEffect, useRef, useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowSquareOut,
  Globe,
  GearSix,
  MagnifyingGlass,
  CheckCircle,
} from "@phosphor-icons/react";
import { useAtom, useSetAtom } from "jotai";
import { settingsOpenAtom, activeSiteAtom } from "../../atoms/app";

interface PageResult {
  id: number;
  title: string;
  slug: string;
  status: string;
  modified: string;
}

export function WebPreview({ siteUrl }: { siteUrl: string }) {
  const [site] = useAtom(activeSiteAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PageResult[]>([]);
  const [selectedPage, setSelectedPage] = useState<PageResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchPages = useCallback(
    async (searchQuery: string) => {
      if (!site?.site_url || !site?.api_key) return;
      setLoading(true);
      try {
        const pages = await invoke<PageResult[]>("search_pages", {
          siteUrl: site.site_url,
          apiKey: site.api_key,
          query: searchQuery,
          perPage: 20,
        });
        setResults(pages);
        setIsOpen(true);
      } catch (err) {
        console.error("Page search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [site]
  );

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedPage(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPages(value), 300);
  };

  const handleSelect = (page: PageResult) => {
    setSelectedPage(page);
    setQuery("");
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const baseUrl = siteUrl.replace(/\/+$/, "");

  const handleOpenSite = async () => {
    try {
      await openUrl(baseUrl);
    } catch (e) {
      console.error("Failed to open URL:", e);
    }
  };

  const handleOpenPage = async () => {
    if (!selectedPage) return;
    try {
      await openUrl(`${baseUrl}/?page_id=${selectedPage.id}`);
    } catch (e) {
      console.error("Failed to open URL:", e);
    }
  };

  if (!siteUrl) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center">
        <Globe
          size={40}
          className="mb-3"
          style={{ color: "var(--fg-muted)" }}
        />
        <p
          className="text-[14px] font-medium mb-2"
          style={{ color: "var(--fg)" }}
        >
          No site connected
        </p>
        <p
          className="text-[12px] mb-4"
          style={{ color: "var(--fg-muted)" }}
        >
          Connect your WordPress site in Settings to browse pages.
        </p>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-[13px] font-medium transition-colors"
          style={{
            background: "var(--accent)",
            color: "oklch(0.15 0.01 85)",
          }}
        >
          <GearSix size={14} />
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Site connection status */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded border"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg)",
        }}
      >
        <CheckCircle
          size={16}
          weight="fill"
          style={{ color: "var(--accent)" }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-[12px] font-medium truncate"
            style={{ color: "var(--fg)" }}
          >
            Connected
          </p>
          <p
            className="text-[11px] font-mono truncate"
            style={{ color: "var(--fg-muted)" }}
          >
            {baseUrl}
          </p>
        </div>
        <button
          onClick={handleOpenSite}
          className="p-1.5 rounded transition-colors shrink-0"
          style={{ color: "var(--fg-muted)" }}
          title="Open site in browser"
        >
          <ArrowSquareOut size={14} />
        </button>
      </div>

      {/* Page search */}
      <div>
        <label
          className="text-[11px] tracking-wider uppercase block mb-1.5"
          style={{ color: "var(--fg-muted)" }}
        >
          Find a page
        </label>
        <div ref={containerRef} className="relative">
          <div className="relative">
            <MagnifyingGlass
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--fg-muted)" }}
            />
            <input
              type="text"
              value={
                selectedPage
                  ? `${selectedPage.title} (ID: ${selectedPage.id})`
                  : query
              }
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (results.length === 0 && !selectedPage) {
                  searchPages("");
                } else if (results.length > 0 && !selectedPage) {
                  setIsOpen(true);
                }
              }}
              placeholder="Search pages..."
              className="w-full pl-7 pr-2 py-1.5 rounded border text-[13px]"
              style={{
                background: "var(--bg)",
                borderColor: "var(--border)",
                color: "var(--fg)",
              }}
            />
            {loading && (
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px]"
                style={{ color: "var(--fg-muted)" }}
              >
                ...
              </span>
            )}
          </div>
          {isOpen && results.length > 0 && (
            <div
              className="absolute z-10 w-full mt-1 rounded border shadow-lg max-h-[200px] overflow-y-auto"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              {results.map((page) => (
                <button
                  key={page.id}
                  onClick={() => handleSelect(page)}
                  className="w-full px-2.5 py-2 text-left transition-colors hover:bg-[var(--bg)] flex items-baseline gap-2"
                >
                  <span
                    className="text-[13px] flex-1 truncate"
                    style={{ color: "var(--fg)" }}
                  >
                    {page.title || "(no title)"}
                  </span>
                  <span
                    className="text-[10px] shrink-0 px-1.5 py-0.5 rounded font-medium"
                    style={{
                      background: page.status === "publish" ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)",
                      color: page.status === "publish" ? "#34d399" : "#fbbf24",
                    }}
                  >
                    {page.status === "publish" ? "Published" : page.status === "draft" ? "Draft" : page.status}
                  </span>
                </button>
              ))}
            </div>
          )}
          {isOpen && results.length === 0 && !loading && query && (
            <div
              className="absolute z-10 w-full mt-1 rounded border p-3 text-center"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              <p className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
                No pages found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleOpenSite}
          className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded text-[13px] font-medium transition-colors border"
          style={{
            borderColor: "var(--border)",
            color: "var(--fg)",
          }}
        >
          <Globe size={16} />
          Open Site in Browser
        </button>

        {selectedPage && (
          <button
            onClick={handleOpenPage}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded text-[13px] font-semibold transition-colors"
            style={{
              background: "var(--accent)",
              color: "oklch(0.15 0.01 85)",
            }}
          >
            <ArrowSquareOut size={16} />
            Open "{selectedPage.title}" in Browser
          </button>
        )}
      </div>

      {/* Selected page info */}
      {selectedPage && (
        <div
          className="p-3 rounded border space-y-1"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
          }}
        >
          <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
            {selectedPage.title}
          </p>
          <div className="flex gap-3">
            <span className="text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
              ID: {selectedPage.id}
            </span>
            <span className="text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
              /{selectedPage.slug}
            </span>
            <span
              className="text-[11px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: selectedPage.status === "publish" ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)",
                color: selectedPage.status === "publish" ? "#34d399" : "#fbbf24",
              }}
            >
              {selectedPage.status === "publish" ? "Published" : selectedPage.status === "draft" ? "Draft" : selectedPage.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
