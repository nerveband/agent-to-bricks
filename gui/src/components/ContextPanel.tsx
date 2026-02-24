import { useState } from "react";
import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { activeToolAtom } from "../atoms/tools";
import { activeSiteAtom } from "../atoms/app";
import { WelcomeContent } from "./context/WelcomeContent";
import { ToolReference } from "./context/ToolReference";
import { NotInstalledContent } from "./context/NotInstalledContent";
import { PromptWorkshop } from "./prompt/PromptWorkshop";
import { WebPreview } from "./context/WebPreview";
import { Lightning, Browser } from "@phosphor-icons/react";

type PanelView = "main" | "prompts" | "preview";

export function ContextPanel() {
  const [session] = useAtom(activeSessionAtom);
  const [tool] = useAtom(activeToolAtom);
  const [site] = useAtom(activeSiteAtom);
  const [view, setView] = useState<PanelView>("prompts");

  let content;
  if (view === "prompts") {
    content = <PromptWorkshop />;
  } else if (view === "preview") {
    content = <WebPreview siteUrl={site?.site_url || ""} />;
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
      <div
        className="flex items-center justify-end gap-1 px-3 py-1.5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setView(view === "prompts" ? "main" : "prompts")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
          style={{
            color: view === "prompts" ? "var(--accent)" : "var(--fg-muted)",
          }}
          title="Prompt Workshop"
        >
          <Lightning size={14} weight={view === "prompts" ? "fill" : "bold"} />
          Prompts
        </button>
        <button
          onClick={() => setView(view === "preview" ? "main" : "preview")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[12px] transition-colors"
          style={{
            color: view === "preview" ? "var(--accent)" : "var(--fg-muted)",
          }}
          title="Preview website"
        >
          <Browser size={14} weight={view === "preview" ? "fill" : "bold"} />
          Preview
        </button>
      </div>
      <div className="flex-1 min-h-0">{content}</div>
    </aside>
  );
}
