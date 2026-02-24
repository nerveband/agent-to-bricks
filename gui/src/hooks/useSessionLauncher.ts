import { useSetAtom, useAtom } from "jotai";
import { sessionsAtom, activeSessionIdAtom } from "../atoms/sessions";
import { activeToolSlugAtom, type Tool } from "../atoms/tools";
import { useCallback } from "react";

export function useSessionLauncher() {
  const [, setSessions] = useAtom(sessionsAtom);
  const setActiveSessionId = useSetAtom(activeSessionIdAtom);
  const setActiveToolSlug = useSetAtom(activeToolSlugAtom);

  const launch = useCallback(
    (tool: Tool) => {
      const id = crypto.randomUUID();
      const session = {
        id,
        toolSlug: tool.slug,
        command: tool.command,
        args: tool.args,
        status: "running" as const,
        startedAt: Date.now(),
      };
      setSessions((prev) => [...prev, session]);
      setActiveSessionId(id);
      setActiveToolSlug(tool.slug);
    },
    [setSessions, setActiveSessionId, setActiveToolSlug]
  );

  return { launch };
}
