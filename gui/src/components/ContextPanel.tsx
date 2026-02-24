export function ContextPanel() {
  return (
    <aside
      className="w-[320px] border-l overflow-y-auto"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
      }}
      role="complementary"
      aria-label="Context panel"
    >
      <div className="p-4">
        <h2 className="text-[15px] font-semibold tracking-tight mb-3">
          Welcome
        </h2>
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: "var(--fg-muted)" }}
        >
          Select a tool from the sidebar to get started, or add a new coding
          tool.
        </p>
      </div>
    </aside>
  );
}
