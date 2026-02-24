interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-[400px] px-6">
      <h1
        className="text-[28px] font-bold tracking-tight mb-3"
        style={{ color: "var(--accent)" }}
      >
        Agent to Bricks
      </h1>
      <p
        className="text-[15px] leading-relaxed mb-8"
        style={{ color: "var(--fg-muted)" }}
      >
        Launch, manage, and orchestrate your coding agents from a single
        interface. Let's get you set up.
      </p>
      <button
        onClick={onNext}
        className="font-semibold text-[14px] rounded px-6 py-2.5 transition-colors cursor-pointer"
        style={{
          background: "var(--accent)",
          color: "oklch(0.15 0.01 85)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--accent-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "var(--accent)")
        }
      >
        Get Started
      </button>
    </div>
  );
}
