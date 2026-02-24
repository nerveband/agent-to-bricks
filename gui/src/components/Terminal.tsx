import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  onTerminalReady: (terminal: XTerm) => void;
}

export function Terminal({ onTerminalReady }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new XTerm({
      fontFamily: '"Geist Mono", "JetBrains Mono", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      theme: {
        background: "#191a1f",
        foreground: "#e4e4e7",
        cursor: "#d4a017",
        selectionBackground: "rgba(212, 160, 23, 0.2)",
      },
      cursorBlink: true,
      cursorStyle: "bar",
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // WebGL not available, canvas fallback
    }

    fitAddon.fit();
    termRef.current = term;
    onTerminalReady(term);

    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore fit errors during teardown
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [onTerminalReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
