import { useAutoUpdater } from "../hooks/useAutoUpdater";

export function UpdateNotification() {
  const {
    available,
    version,
    downloading,
    progress,
    error,
    dismissed,
    installUpdate,
    dismiss,
  } = useAutoUpdater();

  if (!available || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-xl p-4 shadow-lg border"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
        maxWidth: 340,
      }}
    >
      {downloading ? (
        <div className="space-y-2">
          <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
            Updating to v{version}...
          </p>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-input)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: "var(--yellow)",
              }}
            />
          </div>
          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
            {progress}% — App will restart when done
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p
              className="text-[13px] font-medium"
              style={{ color: "var(--fg)" }}
            >
              Update available: v{version}
            </p>
            {error && (
              <p className="text-[11px] mt-1" style={{ color: "#ef4444" }}>
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={installUpdate}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{
                background: "var(--yellow)",
                color: "var(--bg)",
              }}
            >
              Update Now
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-[12px]"
              style={{ color: "var(--fg-muted)" }}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
