import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom } from "../atoms/app";

export function useKeyboardShortcuts() {
  const setSidebar = useSetAtom(sidebarOpenAtom);
  const setContext = useSetAtom(contextPanelOpenAtom);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Don't intercept shortcuts when terminal is focused
      const inTerminal = (e.target as HTMLElement)?.closest(".xterm");
      if (inTerminal) return;

      if (meta && e.key === "b") {
        e.preventDefault();
        setSidebar((prev) => !prev);
      }

      if (meta && e.key === "\\") {
        e.preventDefault();
        setContext((prev) => !prev);
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
  }, [setSidebar, setContext]);
}
