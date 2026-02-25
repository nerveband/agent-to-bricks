import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { activeToolAtom } from "../atoms/tools";
import { activeSiteAtom } from "../atoms/app";
import { useState, useEffect } from "react";
import { SiteSwitcher } from "./SiteSwitcher";

export function StatusBar() {
  const [session] = useAtom(activeSessionAtom);
  const [tool] = useAtom(activeToolAtom);
  const [site] = useAtom(activeSiteAtom);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!session || session.status !== "running") {
      setElapsed("");
      return;
    }
    const interval = setInterval(() => {
      const ms = Date.now() - session.startedAt;
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) setElapsed(`${h}h ${m % 60}m`);
      else if (m > 0) setElapsed(`${m}m ${s % 60}s`);
      else setElapsed(`${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return (
    <footer className="status-bar h-8 shrink-0 flex items-center px-4 text-[10px] font-mono relative z-50"
      style={{ color: "var(--fg-muted)" }}
    >
      {/* Site indicator */}
      <div className="flex items-center gap-2 mr-4">
        <div data-onboard="site-switcher">
          <SiteSwitcher />
        </div>
        {site?.environment && (
          <span
            className="px-1.5 py-[1px] rounded font-bold text-[9px] shadow-sm tracking-widest ml-1"
            style={{
              background: "var(--yellow)",
              color: "#000",
            }}
          >
            {site.environmentLabel ||
              (site.environment === "production" ? "PROD" :
               site.environment === "staging" ? "STG" : "LOCAL")}
          </span>
        )}
      </div>

      {/* Separator */}
      <div className="h-3 w-[1px] mx-2" style={{ background: "var(--border)" }} />

      {/* Session info */}
      {session && tool ? (
        <span
          className="ml-2 font-semibold animate-session-active"
          style={{ color: "var(--yellow)" }}
        >
          Session Active ({tool.name})
        </span>
      ) : (
        <span className="ml-2">No active session</span>
      )}

      {elapsed && (
        <>
          <div className="h-3 w-[1px] mx-2" style={{ background: "var(--border)" }} />
          <span>{elapsed}</span>
        </>
      )}
    </footer>
  );
}
