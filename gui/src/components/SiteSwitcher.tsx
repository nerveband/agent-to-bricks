import { useState, useRef, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { sitesAtom, activeSiteIndexAtom, settingsOpenAtom } from "../atoms/app";
import { mentionCacheAtom } from "../atoms/prompts";
import { CaretUpDown, Plus, Check } from "@phosphor-icons/react";

export function SiteSwitcher() {
  const [sites] = useAtom(sitesAtom);
  const [activeIdx, setActiveIdx] = useAtom(activeSiteIndexAtom);
  const activeSite = sites.length > 0 ? sites[activeIdx] : null;
  const setCache = useSetAtom(mentionCacheAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSwitch = (idx: number) => {
    setActiveIdx(idx);
    setCache({});
    setOpen(false);
  };

  if (sites.length === 0) {
    return (
      <button
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-1 text-[12px]"
        style={{ color: "var(--fg-muted)" }}
      >
        <Plus size={12} />
        Add Site
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[12px] transition-colors"
        style={{ color: "var(--fg-muted)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }} />
        {activeSite?.name ?? "No site"}
        <CaretUpDown size={10} />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 min-w-[200px] rounded-lg border shadow-lg overflow-hidden z-50"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {sites.map((site, i) => (
            <button
              key={i}
              onClick={() => handleSwitch(i)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
              style={{
                color: "var(--fg)",
                background: i === activeIdx ? "var(--border)" : undefined,
              }}
            >
              {i === activeIdx ? (
                <Check size={12} style={{ color: "#34d399" }} />
              ) : (
                <span className="w-3" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{site.name}</div>
                <div className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
                  {site.site_url}
                </div>
              </div>
            </button>
          ))}
          <div className="border-t" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => { setOpen(false); setSettingsOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors"
              style={{ color: "var(--fg-muted)" }}
            >
              <Plus size={12} />
              Add Site
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
