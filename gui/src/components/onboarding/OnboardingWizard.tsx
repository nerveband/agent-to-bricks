import { useState } from "react";
import { useSetAtom } from "jotai";
import { onboardingCompleteAtom } from "../../atoms/app";
import { toolsAtom, type Tool } from "../../atoms/tools";
import { WelcomeStep } from "./WelcomeStep";
import { DetectionStep } from "./DetectionStep";
import { ReadyStep } from "./ReadyStep";

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const setComplete = useSetAtom(onboardingCompleteAtom);
  const setTools = useSetAtom(toolsAtom);
  const [detectedTools, setDetectedTools] = useState<Tool[]>([]);

  const handleDetectionComplete = (tools: Tool[]) => {
    setDetectedTools(tools);
    setTools(tools);
    setStep(2);
  };

  const handleFinish = () => {
    setComplete(true);
  };

  return (
    <div
      className="h-full flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
      {step === 1 && (
        <DetectionStep onComplete={handleDetectionComplete} />
      )}
      {step === 2 && (
        <ReadyStep tools={detectedTools} onComplete={handleFinish} />
      )}
    </div>
  );
}
