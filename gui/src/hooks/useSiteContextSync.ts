import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { activeSiteAtom, sessionPrePromptAtom } from "../atoms/app";
import { activeSessionAtom } from "../atoms/sessions";
import { writeToActivePty } from "../atoms/ptyBridge";
import { buildSiteContextPrompt } from "./useSessionLauncher";

/**
 * When the active site changes while a coding tool session is running,
 * send a context update prompt to the terminal so the AI knows the new site.
 */
export function useSiteContextSync() {
  const site = useAtomValue(activeSiteAtom);
  const session = useAtomValue(activeSessionAtom);
  const promptTemplate = useAtomValue(sessionPrePromptAtom);
  const prevSiteUrl = useRef<string | null>(null);

  useEffect(() => {
    const currentUrl = site?.site_url ?? null;

    // Skip the initial mount (no previous site to compare)
    if (prevSiteUrl.current === null) {
      prevSiteUrl.current = currentUrl;
      return;
    }

    // Only fire when the site actually changes
    if (currentUrl === prevSiteUrl.current) return;
    prevSiteUrl.current = currentUrl;

    // Only send if there's an active running session with a tool (not plain terminal)
    if (!session || session.status !== "running" || !session.command) return;
    if (!site) return;

    const prompt = [
      "--- Site switched ---",
      buildSiteContextPrompt(site, promptTemplate),
    ].join("\n");

    writeToActivePty(prompt + "\n");
  }, [site, session, promptTemplate]);
}
