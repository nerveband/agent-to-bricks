import { useEffect } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { sidebarOpenAtom } from "../atoms/app";
import { toolsAtom } from "../atoms/tools";
import { useSessionLauncher } from "./useSessionLauncher";

export function useKeyboardShortcuts() {
  const setSidebar = useSetAtom(sidebarOpenAtom);
  const tools = useAtomValue(toolsAtom);
  const { launch } = useSessionLauncher();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const inTerminal = (e.target as HTMLElement)?.closest(".xterm");

      // Cmd+P → focus prompt editor
      if (meta && e.key === "p") {
        e.preventDefault();
        const promptInput = document.querySelector<HTMLTextAreaElement>(
          "[data-prompt-pane] textarea"
        );
        promptInput?.focus();
        return;
      }

      if (inTerminal) return;

      // Cmd+B → toggle sidebar
      if (meta && e.key === "b") {
        e.preventDefault();
        setSidebar((prev) => !prev);
      }

      // Cmd+N → new session
      if (meta && e.key === "n") {
        e.preventDefault();
        const defaultTool = tools.find((t) => t.slug === "claude-code" && t.installed)
          || tools.find((t) => t.installed);
        if (defaultTool) launch(defaultTool);
        return;
      }

      // Escape → focus terminal
      if (e.key === "Escape") {
        const termTextarea =
          document.querySelector<HTMLTextAreaElement>(".xterm textarea");
        if (termTextarea) {
          e.preventDefault();
          termTextarea.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSidebar, tools, launch]);
}
