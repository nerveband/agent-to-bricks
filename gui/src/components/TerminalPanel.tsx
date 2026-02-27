import { useState, useCallback, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { sessionsAtom, activeSessionAtom, type Session } from "../atoms/sessions";
import { themeAtom, sitesAtom, settingsOpenAtom } from "../atoms/app";
import { terminalSettingsOpenAtom } from "../atoms/terminal";
import { Terminal } from "./Terminal";
import { TerminalSettingsBar } from "./TerminalSettingsBar";
import { usePty } from "../hooks/usePty";
import { Plus } from "@phosphor-icons/react";
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
  const setSettingsOpen = useSetAtom(settingsOpenAtom);

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
  const settingsBarOpen = useAtomValue(terminalSettingsOpenAtom);

  if (sessions.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      className="h-full w-full flex flex-col"
      role="region"
      aria-label="Terminal"
    >
      <div className="flex-1 relative min-h-0">
        {sessions.map((session) => (
          <SessionTerminal
            key={session.id}
            session={session}
            isActive={session.id === activeSession?.id}
            colorScheme={theme}
          />
        ))}
      </div>
      {settingsBarOpen && <TerminalSettingsBar />}
    </div>
  );
}
