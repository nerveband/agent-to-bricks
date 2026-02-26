import { useRef, useEffect } from "react";
import { useAtomValue } from "jotai";
import {
  toolsDetectedAtom,
  bricksCliAtom,
  detectionLogAtom,
} from "../atoms/tools";
import {
  Copy,
  ArrowSquareOut,
  ArrowClockwise,
  Warning,
  CheckCircle,
  XCircle,
  Info,
  WarningCircle,
} from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface BricksCliGateProps {
  onRedetect: () => Promise<void>;
  children: React.ReactNode;
}

/**
 * Gate that blocks the entire app UI until Bricks CLI is detected.
 * Shows a verbose detection log during scanning, then installation
 * instructions if Bricks CLI is missing.
 */
export function BricksCliGate({ onRedetect, children }: BricksCliGateProps) {
  const detected = useAtomValue(toolsDetectedAtom);
  const bricksCli = useAtomValue(bricksCliAtom);
  const logEntries = useAtomValue(detectionLogAtom);

  // Still running initial detection — show verbose log
  if (!detected) {
    return (
      <div className="h-full w-full">
        <div className="glass-base w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
          <div className="noise-overlay" />
          <div className="relative z-10 max-w-lg w-full px-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                style={{
                  borderColor: "var(--accent)",
                  borderTopColor: "transparent",
                }}
              />
              <div>
                <h1
                  className="text-[15px] font-semibold tracking-tight"
                  style={{ color: "var(--fg)" }}
                >
                  Detecting tools
                </h1>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Scanning your system for installed CLI tools...
                </p>
              </div>
            </div>

            {/* Log output */}
            <DetectionLog entries={logEntries} />
          </div>
        </div>
      </div>
    );
  }

  // Bricks CLI found — render the app normally
  if (bricksCli?.installed) {
    return <>{children}</>;
  }

  // Bricks CLI NOT found — show blocking gate with log + install instructions
  return (
    <div className="h-full w-full">
      <div className="glass-base w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
        <div className="noise-overlay" />

        <div
          className="relative z-10 max-w-lg w-full px-6 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 40px)" }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center border"
              style={{
                background: "var(--bg)",
                borderColor: "var(--border)",
                boxShadow: "0 0 30px rgba(250,204,21,0.08)",
              }}
            >
              <Warning
                size={28}
                weight="duotone"
                style={{ color: "var(--yellow)" }}
              />
            </div>
          </div>

          {/* Title */}
          <h1
            className="text-[18px] font-semibold tracking-tight text-center mb-1"
            style={{ color: "var(--fg)" }}
          >
            Bricks CLI Required
          </h1>
          <p
            className="text-[13px] text-center leading-relaxed mb-4"
            style={{ color: "var(--fg-muted)" }}
          >
            Agent to Bricks needs the{" "}
            <span
              className="font-mono font-medium"
              style={{ color: "var(--fg)" }}
            >
              bricks
            </span>{" "}
            CLI to pull pages, push changes, and communicate with your
            WordPress site.
          </p>

          {/* Detection log (collapsed) */}
          <details
            className="mb-4 rounded-lg border"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
            }}
          >
            <summary
              className="px-3 py-2 cursor-pointer text-[11px] font-medium select-none"
              style={{ color: "var(--fg-muted)" }}
            >
              Detection log ({logEntries.length} entries)
            </summary>
            <div className="px-1 pb-1">
              <DetectionLog entries={logEntries} />
            </div>
          </details>

          {/* Install instructions card */}
          <div
            className="rounded-xl border p-4 mb-4"
            style={{
              background: "var(--bg)",
              borderColor: "var(--border)",
            }}
          >
            <p
              className="text-[11px] tracking-widest uppercase mb-3 font-medium"
              style={{ color: "var(--fg-muted)" }}
            >
              Install Bricks CLI
            </p>

            <InstallOption
              label="Via Go"
              command="go install github.com/agent-to-bricks/cli/cmd/bricks@latest"
            />

            <div
              className="my-3 h-px"
              style={{ background: "var(--border-subtle)" }}
            />

            <div className="flex items-center justify-between">
              <span
                className="text-[12px]"
                style={{ color: "var(--fg-muted)" }}
              >
                Or download from the website
              </span>
              <button
                onClick={() =>
                  openUrl(
                    "https://agenttobricks.com/getting-started/installation/"
                  )
                }
                className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
                style={{ color: "var(--accent)" }}
              >
                Installation guide <ArrowSquareOut size={12} />
              </button>
            </div>
          </div>

          {/* Re-check button */}
          <button
            onClick={onRedetect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors border"
            style={{
              background: "var(--accent)",
              color: "oklch(0.15 0.01 85)",
              borderColor: "transparent",
            }}
          >
            <ArrowClockwise size={15} weight="bold" />
            Re-check for Bricks CLI
          </button>

          <p
            className="text-[11px] text-center mt-3 mb-4"
            style={{ color: "var(--fg-subtle)" }}
          >
            Install the CLI, then click the button above to re-detect.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared sub-components ---------- */

function DetectionLog({
  entries,
}: {
  entries: { text: string; status: string }[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new entries appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div
      ref={scrollRef}
      className="rounded-lg border overflow-y-auto font-mono text-[11px] leading-[1.7]"
      style={{
        background: "oklch(0.13 0.005 260)",
        borderColor: "var(--border)",
        maxHeight: 220,
        minHeight: 80,
      }}
    >
      <div className="p-2.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <LogIcon status={entry.status} />
            <span
              style={{
                color:
                  entry.status === "ok"
                    ? "oklch(0.75 0.15 145)"
                    : entry.status === "error"
                      ? "oklch(0.7 0.2 25)"
                      : entry.status === "warn"
                        ? "oklch(0.8 0.15 80)"
                        : "var(--fg-muted)",
              }}
            >
              {entry.text}
            </span>
          </div>
        ))}
        {/* Blinking cursor */}
        {entries.length > 0 && (
          <span
            className="inline-block w-[6px] h-[13px] ml-5 animate-pulse"
            style={{ background: "var(--accent)", opacity: 0.7 }}
          />
        )}
      </div>
    </div>
  );
}

function LogIcon({ status }: { status: string }) {
  const size = 12;
  const className = "shrink-0 mt-[3px]";
  switch (status) {
    case "ok":
      return (
        <CheckCircle
          size={size}
          weight="fill"
          className={className}
          style={{ color: "oklch(0.7 0.15 145)" }}
        />
      );
    case "error":
      return (
        <XCircle
          size={size}
          weight="fill"
          className={className}
          style={{ color: "oklch(0.7 0.2 25)" }}
        />
      );
    case "warn":
      return (
        <WarningCircle
          size={size}
          weight="fill"
          className={className}
          style={{ color: "oklch(0.8 0.15 80)" }}
        />
      );
    default:
      return (
        <Info
          size={size}
          weight="fill"
          className={className}
          style={{ color: "var(--fg-subtle)" }}
        />
      );
  }
}

function InstallOption({
  label,
  command,
}: {
  label: string;
  command: string;
}) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <p
        className="text-[11px] mb-1.5 font-medium"
        style={{ color: "var(--fg-muted)" }}
      >
        {label}
      </p>
      <div
        className="flex items-center gap-2 px-2.5 py-2 rounded font-mono text-[11px]"
        style={{ background: "var(--panel-bg, rgba(0,0,0,0.2))" }}
      >
        <code className="flex-1 truncate" style={{ color: "var(--fg)" }}>
          {command}
        </code>
        <button
          onClick={() => copyToClipboard(command)}
          className="shrink-0 p-1 rounded transition-colors hover:bg-[var(--white-glass)]"
          title="Copy to clipboard"
          style={{ color: "var(--fg-muted)" }}
        >
          <Copy size={13} />
        </button>
      </div>
    </div>
  );
}
