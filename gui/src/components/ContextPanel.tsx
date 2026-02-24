import { useState } from "react";
import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { activeToolAtom } from "../atoms/tools";
import { WelcomeContent } from "./context/WelcomeContent";
import { ToolReference } from "./context/ToolReference";
import { NotInstalledContent } from "./context/NotInstalledContent";
import { ConfigEditor } from "./context/ConfigEditor";
import { Gear } from "@phosphor-icons/react";

type PanelView = "main" | "config";

export function ContextPanel() {
  const [session] = useAtom(activeSessionAtom);
  const [tool] = useAtom(activeToolAtom);
  const [view, setView] = useState<PanelView>("main");

  let content;
  if (view === "config" && tool) {
    content = <ConfigEditor tool={tool} onBack={() => setView("main")} />;
  } else if (!tool) {
    content = <WelcomeContent />;
  } else if (!tool.installed) {
    content = <NotInstalledContent tool={tool} />;
  } else if (session?.status === "running") {
    content = <ToolReference toolSlug={tool.slug} />;
  } else {
    content = <WelcomeContent />;
  }

  return (
    <aside
      className="w-[320px] border-l overflow-y-auto flex flex-col"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      role="complementary"
      aria-label="Context panel"
    >
      {tool && view !== "config" && (
        <div
          className="flex items-center justify-end px-3 py-1.5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={() => setView("config")}
            className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
            style={{ color: "var(--fg-muted)" }}
            title={`Edit ${tool.name} config`}
          >
            <Gear size={14} />
            Config
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0">{content}</div>
    </aside>
  );
}
