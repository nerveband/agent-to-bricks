import { useAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom, onboardingCompleteAtom } from "../atoms/app";
import { Sidebar } from "./Sidebar";
import { TerminalPanel } from "./TerminalPanel";
import { ContextPanel } from "./ContextPanel";
import { StatusBar } from "./StatusBar";
import { useToolDetection } from "../hooks/useToolDetection";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { OnboardingWizard } from "./onboarding/OnboardingWizard";

export function AppShell() {
  const [onboardingComplete] = useAtom(onboardingCompleteAtom);
  useToolDetection(); // Scan for installed CLI tools on mount
  useKeyboardShortcuts();
  const [sidebarOpen] = useAtom(sidebarOpenAtom);
  const [contextOpen] = useAtom(contextPanelOpenAtom);

  if (!onboardingComplete) {
    return <OnboardingWizard />;
  }

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
    </div>
  );
}
