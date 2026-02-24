export function StatusBar() {
  return (
    <footer
      className="h-7 border-t flex items-center px-3 gap-3 text-[12px] font-mono"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        color: "var(--fg-muted)",
      }}
    >
      <span>No active session</span>
    </footer>
  );
}
