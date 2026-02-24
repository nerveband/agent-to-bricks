import { useState, useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import { sessionsAtom, activeSessionAtom, type Session } from "../atoms/sessions";
import { Terminal } from "./Terminal";
import { usePty } from "../hooks/usePty";
import type { Terminal as XTerm } from "@xterm/xterm";

/**
 * SessionTerminal renders one terminal + PTY connection for a single session.
 * Each session gets its own xterm instance and PTY process. When inactive,
 * the container is hidden with display:none so scrollback is preserved.
 */
function SessionTerminal({
  session,
  isActive,
}: {
  session: Session;
  isActive: boolean;
}) {
  const [terminal, setTerminal] = useState<XTerm | null>(null);

  const handleReady = useCallback(
    (term: XTerm) => {
      setTerminal(term);
      if (isActive) term.focus();
    },
    [isActive]
  );

  usePty(terminal, session.command, session.args);

  // Focus when becoming active
  useEffect(() => {
    if (isActive && terminal) {
      terminal.focus();
    }
  }, [isActive, terminal]);

  return (
    <div
      className="h-full w-full absolute inset-0"
      style={{ display: isActive ? "block" : "none" }}
    >
      <Terminal onTerminalReady={handleReady} />
    </div>
  );
}

export function TerminalPanel() {
  const [sessions] = useAtom(sessionsAtom);
  const [activeSession] = useAtom(activeSessionAtom);

  if (sessions.length === 0) {
    return (
      <div
        className="h-full w-full flex items-center justify-center font-mono text-sm"
        style={{ background: "var(--terminal)", color: "var(--fg-muted)" }}
        role="region"
        aria-label="Terminal"
      >
        Select a tool to start a session
      </div>
    );
  }

  return (
    <div
      className="h-full w-full relative"
      style={{ background: "var(--terminal)" }}
      role="region"
      aria-label="Terminal"
    >
      {sessions.map((session) => (
        <SessionTerminal
          key={session.id}
          session={session}
          isActive={session.id === activeSession?.id}
        />
      ))}
    </div>
  );
}
