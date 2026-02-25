import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom, paletteOpenAtom } from "../atoms/app";
import { toolsAtom } from "../atoms/tools";
import { useSessionLauncher } from "./useSessionLauncher";

export function useKeyboardShortcuts() {
  const setSidebar = useSetAtom(sidebarOpenAtom);
  const setContext = useSetAtom(contextPanelOpenAtom);
  const setPalette = useSetAtom(paletteOpenAtom);
  const tools = useAtomValue(toolsAtom);
  const { launch } = useSessionLauncher();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      const inTerminal = (e.target as HTMLElement)?.closest(".xterm");

      if (meta && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        setPalette((prev) => !prev);
        return;
      }

      if (meta && e.key === "p" && e.shiftKey) {
        e.preventDefault();
        setPalette(true);
        return;
      }

      if (inTerminal) return;

      if (meta && e.key === "b") {
        e.preventDefault();
        setSidebar((prev) => !prev);
      }

      if (meta && e.key === "\\") {
        e.preventDefault();
        setContext((prev) => !prev);
      }

      if (meta && e.key === "k") {
        e.preventDefault();
        setContext(true);
        setTimeout(() => {
          const editor = document.querySelector<HTMLTextAreaElement>(
            "[data-prompt-workshop] textarea"
          );
          editor?.focus();
        }, 100);
      }

      if (meta && e.key === "n") {
        e.preventDefault();
        const defaultTool = tools.find((t) => t.slug === "claude-code" && t.installed)
          || tools.find((t) => t.installed);
        if (defaultTool) launch(defaultTool);
        return;
      }

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
  }, [setSidebar, setContext, setPalette, tools, launch]);
}
