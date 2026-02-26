import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useAtom } from "jotai";
import { onboardingSeenAtom } from "../atoms/app";
import { MOD_KEY } from "../lib/platform";

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
    target: "[data-prompt-pane]",
    title: "Prompt Editor",
    message: `Build context-rich prompts with @mentions. Use ${MOD_KEY}+P to quickly focus the editor.`,
    position: "top",
  },
  {
    target: "[data-onboard='site-switcher']",
    title: "Connect Your Site",
    message: "Add your WordPress site URL and API key to enable @mentions and site-aware prompting.",
    position: "top",
  },
];

const VIEWPORT_PAD = 12;

/** Compute tooltip position anchored to target, then clamp within the viewport. */
function computePosition(
  targetRect: DOMRect,
  tooltipW: number,
  tooltipH: number,
  preferred: TooltipStep["position"],
): { top: number; left: number } {
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (preferred) {
    case "right":
      top = targetRect.top + targetRect.height / 2 - tooltipH / 2;
      left = targetRect.right + gap;
      break;
    case "left":
      top = targetRect.top + targetRect.height / 2 - tooltipH / 2;
      left = targetRect.left - gap - tooltipW;
      break;
    case "bottom":
      top = targetRect.bottom + gap;
      left = targetRect.left + targetRect.width / 2 - tooltipW / 2;
      break;
    case "top":
      top = targetRect.top - gap - tooltipH;
      left = targetRect.left + targetRect.width / 2 - tooltipW / 2;
      break;
  }

  // Clamp to viewport
  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - tooltipW - VIEWPORT_PAD));
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - tooltipH - VIEWPORT_PAD));

  return { top, left };
}

export function OnboardingTooltips() {
  const [seen, setSeen] = useAtom(onboardingSeenAtom);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // First pass: find the target, mark ready so tooltip renders (invisible) for measurement
  useEffect(() => {
    if (seen || step >= STEPS.length) return;
    setReady(false);
    setPos(null);

    const timer = setTimeout(() => {
      if (step >= STEPS.length) return;
      const target = document.querySelector(STEPS[step].target);
      if (!target) {
        setStep((s) => Math.min(s + 1, STEPS.length));
        return;
      }
      setReady(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [step, seen]);

  // Second pass: measure tooltip and compute clamped position
  useLayoutEffect(() => {
    if (!ready || seen || step >= STEPS.length) return;

    const el = tooltipRef.current;
    const target = document.querySelector(STEPS[step].target);
    if (!el || !target) return;

    const rect = target.getBoundingClientRect();
    const tooltipW = el.offsetWidth;
    const tooltipH = el.offsetHeight;

    setPos(computePosition(rect, tooltipW, tooltipH, STEPS[step].position));
  }, [ready, step, seen]);

  if (seen || step >= STEPS.length) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <div className="fixed inset-0 z-[90] pointer-events-none" style={{ background: "rgba(0,0,0,0.15)" }} />

      {ready && (
        <div
          ref={tooltipRef}
          className="fixed z-[95] w-[280px] rounded-xl border shadow-xl p-4 onboarding-tooltip backdrop-blur-xl"
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            background: "var(--surface)",
            borderColor: "var(--accent)",
            visibility: pos ? "visible" : "hidden",
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
