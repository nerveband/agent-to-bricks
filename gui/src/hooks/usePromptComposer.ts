import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeSiteAtom, siteContextSentAtom } from "../atoms/app";
import { estimateTokens } from "../lib/contextFormatter";

export interface ComposedPrompt {
  fullText: string;
  contextBlock: string;
  instruction: string;
  tokenEstimate: number;
}

export function usePromptComposer() {
  const site = useAtomValue(activeSiteAtom);
  const siteContextSent = useAtomValue(siteContextSentAtom);
  const setSiteContextSent = useSetAtom(siteContextSentAtom);

  const compose = useCallback(
    (rawText: string, resolvedContexts: Map<string, string>, options?: { forceSiteContext?: boolean }): ComposedPrompt => {
      const contextParts: string[] = [];
      const includeSiteHeader = options?.forceSiteContext || !siteContextSent;

      if (site && includeSiteHeader) {
        contextParts.push(
          `Site: ${site.site_url} | ${site.name}`
        );
      }

      for (const [_key, context] of resolvedContexts) {
        if (context) contextParts.push(context);
      }

      const contextBlock = contextParts.length > 0
        ? contextParts.join("\n\n")
        : "";

      const instruction = rawText
        .replace(/@(page|section|element|class|color|variable|component|media)\([^)]*\)/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      const fullParts: string[] = [];
      if (contextBlock) fullParts.push(contextBlock);
      if (instruction) fullParts.push(`Instruction: ${instruction}`);

      const fullText = fullParts.join("\n\n");

      return {
        fullText,
        contextBlock,
        instruction,
        tokenEstimate: estimateTokens(fullText),
      };
    },
    [site, siteContextSent]
  );

  const markSiteContextSent = useCallback(() => {
    setSiteContextSent(true);
  }, [setSiteContextSent]);

  const resetSiteContext = useCallback(() => {
    setSiteContextSent(false);
  }, [setSiteContextSent]);

  return { compose, markSiteContextSent, resetSiteContext };
}
