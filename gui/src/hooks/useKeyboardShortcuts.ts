import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom, paletteOpenAtom } from "../atoms/app";

export function useKeyboardShortcuts() {
  const setSidebar = useSetAtom(sidebarOpenAtom);
  const setContext = useSetAtom(contextPanelOpenAtom);
  const setPalette = useSetAtom(paletteOpenAtom);

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
  }, [setSidebar, setContext, setPalette]);
}
