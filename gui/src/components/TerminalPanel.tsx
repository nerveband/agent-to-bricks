import { useState, useCallback, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { sessionsAtom, activeSessionAtom, type Session } from "../atoms/sessions";
import { themeAtom, sitesAtom, activeSiteIndexAtom, settingsOpenAtom } from "../atoms/app";
import { Terminal } from "./Terminal";
import { usePty } from "../hooks/usePty";
import { GlobeSimple, Plus, ArrowRight } from "@phosphor-icons/react";
import type { Terminal as XTerm } from "@xterm/xterm";

/**
 * SessionTerminal renders one terminal + PTY connection for a single session.
 * Each session gets its own xterm instance and PTY process. When inactive,
 * the container is hidden with display:none so scrollback is preserved.
 */
function SessionTerminal({
  session,
  isActive,
  colorScheme,
}: {
  session: Session;
  isActive: boolean;
  colorScheme: "light" | "dark";
}) {
  const [terminal, setTerminal] = useState<XTerm | null>(null);

  const handleReady = useCallback((term: XTerm) => {
    setTerminal(term);
  }, []);

  usePty(terminal, session.command, session.args, isActive, session.cwd);

  // Focus when becoming active
  useEffect(() => {
    if (isActive && terminal) {
      terminal.focus();
    }
  }, [isActive, terminal]);

  return (
    <div
      className="absolute inset-0"
      style={{ display: isActive ? "block" : "none" }}
    >
      <Terminal colorScheme={colorScheme} onTerminalReady={handleReady} />
    </div>
  );
}

function EmptyState() {
  const sites = useAtomValue(sitesAtom);
  const setActiveSiteIdx = useSetAtom(activeSiteIndexAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);

  const handleSelectSite = (idx: number) => {
    setActiveSiteIdx(idx);
  };

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center font-sans relative"
      style={{ color: "var(--fg-muted)" }}
      role="region"
      aria-label="Terminal"
    >
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="space-y-2">
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--fg)" }}>
            Ready to manage your Bricks Builder website
          </h2>
          <p className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>
            Select a tool from the sidebar to start a session.
          </p>
        </div>

        {sites.length > 0 && (
          <div className="space-y-2">
            <div
              className="text-[10px] font-medium tracking-[0.15em] uppercase"
              style={{ color: "var(--fg-subtle)" }}
            >
              Your Sites
            </div>
            <div className="space-y-1.5">
              {sites.map((site, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSite(i)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all hover:border-[var(--yellow)]"
                  style={{
                    background: "var(--white-glass)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <GlobeSimple size={16} style={{ color: "var(--yellow)" }} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>
                      {site.name}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: "var(--fg-subtle)" }}>
                      {site.site_url}
                    </div>
                  </div>
                  {site.environment && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0"
                      style={{ background: "var(--yellow)", color: "#000" }}
                    >
                      {site.environment === "production" ? "PROD" : site.environment === "staging" ? "STG" : "LOCAL"}
                    </span>
                  )}
                  <ArrowRight size={12} style={{ color: "var(--fg-subtle)" }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {sites.length === 0 && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all"
            style={{
              background: "var(--yellow)",
              color: "#000",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            <Plus size={14} weight="bold" />
            Connect a Site
          </button>
        )}
      </div>
    </div>
  );
}

export function TerminalPanel() {
  const [sessions] = useAtom(sessionsAtom);
  const [activeSession] = useAtom(activeSessionAtom);
  const [theme] = useAtom(themeAtom);

  if (sessions.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      className="h-full w-full relative"
      role="region"
      aria-label="Terminal"
    >
      {sessions.map((session) => (
        <SessionTerminal
          key={session.id}
          session={session}
          isActive={session.id === activeSession?.id}
          colorScheme={theme}
        />
      ))}
    </div>
  );
}
