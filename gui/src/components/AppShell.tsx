import { useAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom } from "../atoms/app";
import { Sidebar } from "./Sidebar";
import { TerminalPanel } from "./TerminalPanel";
import { ContextPanel } from "./ContextPanel";
import { StatusBar } from "./StatusBar";

export function AppShell() {
  const [sidebarOpen] = useAtom(sidebarOpenAtom);
  const [contextOpen] = useAtom(contextPanelOpenAtom);

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
