export function TerminalPanel() {
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
