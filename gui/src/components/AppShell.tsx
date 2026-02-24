import { useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom, onboardingSeenAtom } from "../atoms/app";
import { Sidebar } from "./Sidebar";
import { TerminalPanel } from "./TerminalPanel";
import { ContextPanel } from "./ContextPanel";
import { StatusBar } from "./StatusBar";
import { CommandPalette } from "./CommandPalette";
import { OnboardingTooltips } from "./OnboardingTooltips";
import { useToolDetection } from "../hooks/useToolDetection";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export function AppShell() {
  useToolDetection();
  useKeyboardShortcuts();
  const [sidebarOpen] = useAtom(sidebarOpenAtom);
  const [contextOpen] = useAtom(contextPanelOpenAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const setContextOpen = useSetAtom(contextPanelOpenAtom);
  const onboardingSeen = useAtomValue(onboardingSeenAtom);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 1200;
      if (width < 700) {
        setSidebarOpen(false);
        setContextOpen(false);
      } else if (width < 1000) {
        setContextOpen(false);
      }
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [setSidebarOpen, setContextOpen]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        <Sidebar collapsed={!sidebarOpen} />
        <main className="flex-1 min-w-0">
          <TerminalPanel />
        </main>
        {contextOpen && <ContextPanel />}
      </div>
      <StatusBar />
      <CommandPalette />
      {!onboardingSeen && <OnboardingTooltips />}
    </div>
  );
}
