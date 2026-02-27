import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { Terminal as XTerm, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { terminalSettingsAtom } from "../atoms/terminal";

/* Terminal themes — branded to match the concept:
   Dark: deep near-black bg with yellow cursor, green/yellow accents
   Light: clean white bg with warm yellow cursor
   Both use JetBrains Mono for that authentic terminal feel */
const THEMES: Record<"light" | "dark", ITheme> = {
  dark: {
    background: "#00000000",
    foreground: "#E5E7EB",
    cursor: "#FACC15",
    cursorAccent: "#08080a",
    selectionBackground: "rgba(250, 204, 21, 0.18)",
    selectionForeground: "#FACC15",
    black: "#0B0B0E",
    red: "#f87171",
    green: "#22C55E",
    yellow: "#FACC15",
    blue: "#60a5fa",
    magenta: "#c084fc",
    cyan: "#22d3ee",
    white: "#E5E7EB",
    brightBlack: "#6B7280",
    brightRed: "#fca5a5",
    brightGreen: "#86efac",
    brightYellow: "#fde68a",
    brightBlue: "#93c5fd",
    brightMagenta: "#d8b4fe",
    brightCyan: "#67e8f9",
    brightWhite: "#fafafa",
  },
  light: {
    background: "#ffffff00",
    foreground: "#030712",
    cursor: "#EBA40A",
    cursorAccent: "#fafafa",
    selectionBackground: "rgba(234, 179, 8, 0.15)",
    selectionForeground: "#030712",
    black: "#030712",
    red: "#dc2626",
    green: "#16A34A",
    yellow: "#EBA40A",
    blue: "#2563eb",
    magenta: "#9333ea",
    cyan: "#0891b2",
    white: "#E5E7EB",
    brightBlack: "#71717a",
    brightRed: "#ef4444",
    brightGreen: "#22c55e",
    brightYellow: "#ca8a04",
    brightBlue: "#3b82f6",
    brightMagenta: "#a855f7",
    brightCyan: "#06b6d4",
    brightWhite: "#fafafa",
  },
};

interface TerminalProps {
  colorScheme: "light" | "dark";
  onTerminalReady: (terminal: XTerm) => void;
}

export function Terminal({ colorScheme, onTerminalReady }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const settings = useAtomValue(terminalSettingsAtom);

  const fontFamily = `"${settings.fontFamily}", monospace`;

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    let disposed = false;
    let observer: ResizeObserver | null = null;
    let term: XTerm | null = null;

    const init = async () => {
      try {
        await document.fonts.load(`12px ${fontFamily}`);
      } catch {
        // Font may already be loaded or unavailable; proceed anyway
      }

      if (disposed || !containerRef.current) return;

      term = new XTerm({
        fontFamily,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        letterSpacing: settings.letterSpacing,
        scrollback: settings.scrollback,
        theme: THEMES[colorScheme],
        cursorBlink: settings.cursorBlink,
        cursorStyle: settings.cursorStyle,
        cursorWidth: settings.cursorWidth,
        allowTransparency: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      term.loadAddon(fitAddon);

      observer = new ResizeObserver(() => {
        if (disposed) return;
        try {
          fitAddon.fit();
        } catch {
          // ignore fit errors during teardown
        }
      });
      observer.observe(containerRef.current);

      term.open(containerRef.current);

      fitAddon.fit();
      termRef.current = term;
      onTerminalReady(term);
    };

    init();

    return () => {
      disposed = true;
      observer?.disconnect();
      term?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [onTerminalReady]);

  // Update xterm theme live when color scheme changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = THEMES[colorScheme];
    }
  }, [colorScheme]);

  // Live-update mutable xterm options when settings change
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const ff = `"${settings.fontFamily}", monospace`;
    term.options.fontSize = settings.fontSize;
    term.options.fontFamily = ff;
    term.options.lineHeight = settings.lineHeight;
    term.options.letterSpacing = settings.letterSpacing;
    term.options.scrollback = settings.scrollback;
    term.options.cursorStyle = settings.cursorStyle;
    term.options.cursorWidth = settings.cursorWidth;
    term.options.cursorBlink = settings.cursorBlink;

    try {
      fitAddonRef.current?.fit();
    } catch {
      // ignore fit errors
    }
  }, [settings]);

  return (
    <div
      className="h-full w-full relative"
      style={{ background: "transparent", padding: `${settings.padding}px` }}
    >
      <div ref={containerRef} className="h-full w-full overflow-hidden relative z-10" />
    </div>
  );
}
