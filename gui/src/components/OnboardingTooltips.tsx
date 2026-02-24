import { useState, useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { onboardingSeenAtom } from "../atoms/app";

interface TooltipStep {
  target: string;
  title: string;
  message: string;
  position: "top" | "bottom" | "left" | "right";
}

const STEPS: TooltipStep[] = [
  {
    target: "[data-onboard='tools']",
    title: "Your AI Tools",
    message: "Installed coding tools appear here. Click one to start a session.",
    position: "right",
  },
  {
    target: "[data-onboard='prompt-btn']",
    title: "Smart Prompt Builder",
    message: "Build context-rich prompts with @mentions that reference your site's pages, sections, and styles.",
    position: "right",
  },
  {
    target: "[data-onboard='palette-hint']",
    title: "Quick Prompting",
    message: "Press Cmd+P anytime for the command palette \u2014 fast prompting from anywhere.",
    position: "bottom",
  },
  {
    target: "[data-onboard='site-switcher']",
    title: "Connect Your Site",
    message: "Add your WordPress site URL and API key to enable @mentions and site-aware prompting.",
    position: "top",
  },
];

export function OnboardingTooltips() {
  const [seen, setSeen] = useAtom(onboardingSeenAtom);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seen || step >= STEPS.length) return;

    // Small delay to let the UI render the target elements
    const timer = setTimeout(() => {
      const target = document.querySelector(STEPS[step].target);
      if (!target) {
        setStep((s) => s + 1);
        return;
      }

      const rect = target.getBoundingClientRect();
      const s = STEPS[step];
      let top = 0;
      let left = 0;

      switch (s.position) {
        case "right":
          top = rect.top + rect.height / 2;
          left = rect.right + 12;
          break;
        case "bottom":
          top = rect.bottom + 12;
          left = rect.left + rect.width / 2;
          break;
        case "top":
          top = rect.top - 12;
          left = rect.left + rect.width / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2;
          left = rect.left - 12;
          break;
      }

      setPos({ top, left });
    }, 300);

    return () => clearTimeout(timer);
  }, [step, seen]);

  if (seen || step >= STEPS.length) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <div className="fixed inset-0 z-[90] pointer-events-none" style={{ background: "rgba(0,0,0,0.15)" }} />

      {pos && (
        <div
          ref={tooltipRef}
          className="fixed z-[95] max-w-[280px] rounded-xl border shadow-xl p-4"
          style={{
            top: pos.top,
            left: pos.left,
            background: "var(--surface)",
            borderColor: "var(--accent)",
            transform:
              current.position === "right" ? "translateY(-50%)" :
              current.position === "left" ? "translate(-100%, -50%)" :
              current.position === "bottom" ? "translateX(-50%)" :
              "translate(-50%, -100%)",
          }}
        >
          <div className="text-[14px] font-medium mb-1" style={{ color: "var(--fg)" }}>
            {current.title}
          </div>
          <div className="text-[13px] mb-3" style={{ color: "var(--fg-muted)" }}>
            {current.message}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: i === step ? "var(--accent)" : "var(--border)" }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSeen(true)}
                className="text-[12px] px-2 py-1 rounded"
                style={{ color: "var(--fg-muted)" }}
              >
                Skip
              </button>
              <button
                onClick={() => {
                  if (isLast) setSeen(true);
                  else setStep((s) => s + 1);
                }}
                className="text-[12px] px-3 py-1 rounded font-medium"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                {isLast ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
