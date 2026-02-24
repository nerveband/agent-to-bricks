import { useState, useCallback } from "react";
import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { Terminal } from "./Terminal";
import { usePty } from "../hooks/usePty";
import type { Terminal as XTerm } from "@xterm/xterm";

export function TerminalPanel() {
  const [activeSession] = useAtom(activeSessionAtom);
  const [terminal, setTerminal] = useState<XTerm | null>(null);

  const handleTerminalReady = useCallback((term: XTerm) => {
    setTerminal(term);
    term.focus();
  }, []);

  usePty(
    terminal,
    activeSession?.command ?? null,
    activeSession?.args ?? []
  );

  if (!activeSession) {
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
      className="h-full w-full"
      style={{ background: "var(--terminal)" }}
      role="region"
      aria-label="Terminal"
    >
      <Terminal onTerminalReady={handleTerminalReady} />
    </div>
  );
}
