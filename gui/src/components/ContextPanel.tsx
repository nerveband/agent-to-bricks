import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { activeToolAtom } from "../atoms/tools";
import { WelcomeContent } from "./context/WelcomeContent";
import { ToolReference } from "./context/ToolReference";
import { NotInstalledContent } from "./context/NotInstalledContent";

export function ContextPanel() {
  const [session] = useAtom(activeSessionAtom);
  const [tool] = useAtom(activeToolAtom);

  let content;
  if (!tool) {
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
      className="w-[320px] border-l overflow-y-auto"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      role="complementary"
      aria-label="Context panel"
    >
      {content}
    </aside>
  );
}
