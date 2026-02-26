import { useState, useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { sidebarOpenAtom, onboardingSeenAtom, promptExpandedAtom } from "../atoms/app";
import { Sidebar } from "./Sidebar";
import { TerminalPanel } from "./TerminalPanel";
import { PromptPane } from "./PromptPane";
import { StatusBar } from "./StatusBar";
import { ResizeHandle } from "./ResizeHandle";
import { OnboardingTooltips } from "./OnboardingTooltips";
import { BricksCliGate } from "./BricksCliGate";
import { useToolDetection } from "../hooks/useToolDetection";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useConfigPersistence } from "../hooks/useConfigPersistence";
import { useSiteContextSync } from "../hooks/useSiteContextSync";
import { useTheme } from "../hooks/useTheme";
import { UpdateNotification } from "./UpdateNotification";

export function AppShell() {
  const { redetect } = useToolDetection();
  useKeyboardShortcuts();
  useConfigPersistence();
  useSiteContextSync();
  useTheme();
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const onboardingSeen = useAtomValue(onboardingSeenAtom);
  const promptExpanded = useAtomValue(promptExpandedAtom);

  // Pane sizes (in pixels)
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [promptHeight, setPromptHeight] = useState(280);
  const savedPromptHeightRef = useRef(280);

  // Responsive collapse
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 1200;
      if (width < 700) {
        setSidebarOpen(false);
      }
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [setSidebarOpen]);

  // When expanded, take nearly all window height; when collapsed, restore saved height
  useEffect(() => {
    if (promptExpanded) {
      setPromptHeight((current) => {
        savedPromptHeightRef.current = current;
        return window.innerHeight - 80;
      });
    } else {
      setPromptHeight(savedPromptHeightRef.current);
    }
  }, [promptExpanded]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(180, Math.min(400, w + delta)));
  }, []);

  const handlePromptResize = useCallback((delta: number) => {
    setPromptHeight((h) => Math.max(80, Math.min(800, h - delta)));
  }, []);

  const effectiveSidebarWidth = sidebarOpen ? sidebarWidth : 56;

  return (
    <BricksCliGate onRedetect={redetect}>
      <div className="h-full w-full">
        <div className="glass-base w-full h-full flex flex-col relative overflow-hidden app-body">
          {/* Noise overlay */}
          <div className="noise-overlay" />

          {/* Main Workspace */}
          <div className="flex flex-1 min-h-0 relative z-10">
            {/* Sidebar */}
            <div
              className="glass-sidebar shrink-0 relative z-30"
              style={{ width: effectiveSidebarWidth }}
            >
              {/* Ambient sidebar glow */}
              <div
                className="absolute -right-[150px] top-1/2 w-[300px] h-[300px] rounded-full pointer-events-none opacity-10 blur-[80px]"
                style={{ background: "var(--yellow)" }}
              />
              <Sidebar collapsed={!sidebarOpen} />
            </div>

            {/* Sidebar resize handle */}
            {sidebarOpen && (
              <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
            )}

            {/* Main content: Terminal (top) + Prompt (bottom) */}
            <div className="flex-1 min-w-0 flex flex-col glass-terminal relative">
              {/* Scanlines */}
              <div className="scanlines" />
              {/* Ambient bleed */}
              <div className="ambient-bleed" />

              {/* Terminal area */}
              <main className="flex-1 min-h-0 relative z-10">
                <TerminalPanel />
              </main>

              {/* Terminal/Prompt resize handle */}
              <ResizeHandle direction="vertical" onResize={handlePromptResize} />

              {/* Prompt editor pane */}
              <div
                className="glass-bottom-panel flex-shrink-0 relative z-40"
                style={{ height: promptHeight, overflow: "hidden" }}
              >
                <PromptPane />
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <StatusBar />
        </div>

        {!onboardingSeen && <OnboardingTooltips />}
        <UpdateNotification />
      </div>
    </BricksCliGate>
  );
}
