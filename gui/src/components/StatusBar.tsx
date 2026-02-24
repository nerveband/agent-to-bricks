import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { activeToolAtom } from "../atoms/tools";
import { useState, useEffect } from "react";

export function StatusBar() {
  const [session] = useAtom(activeSessionAtom);
  const [tool] = useAtom(activeToolAtom);
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
    <footer
      className="h-7 border-t flex items-center px-3 gap-3 text-[12px] font-mono"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        color: "var(--fg-muted)",
      }}
    >
      {session && tool ? (
        <>
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full animate-pulse-dot"
              style={{ background: "var(--accent)" }}
            />
            {tool.name}
          </span>
          {tool.version && (
            <>
              <span style={{ color: "var(--border)" }}>|</span>
              <span>{tool.version}</span>
            </>
          )}
          {elapsed && (
            <>
              <span style={{ color: "var(--border)" }}>|</span>
              <span>{elapsed}</span>
            </>
          )}
        </>
      ) : (
        <span>No active session</span>
      )}
    </footer>
  );
}
