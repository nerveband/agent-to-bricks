import { useAtom } from "jotai";
import { toolsAtom } from "../../atoms/tools";
import { useSessionLauncher } from "../../hooks/useSessionLauncher";

export function WelcomeContent() {
  const [tools] = useAtom(toolsAtom);
  const { launch } = useSessionLauncher();

  return (
    <div className="p-4">
      <h2 className="text-[15px] font-semibold tracking-tight mb-3">
        Welcome
      </h2>
      <p
        className="text-[13px] leading-relaxed mb-4"
        style={{ color: "var(--fg-muted)" }}
      >
        Launch a coding tool to get started.
      </p>
      <div className="flex flex-col gap-2">
        {tools.map((tool) => (
          <button
            key={tool.slug}
            onClick={() => tool.installed && launch(tool)}
            disabled={!tool.installed}
            className="flex items-center gap-3 p-3 rounded-lg border text-left transition-colors"
            style={{
              borderColor: "var(--border)",
              opacity: tool.installed ? 1 : 0.5,
            }}
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded font-mono text-xs font-bold"
              style={{ background: "var(--bg)" }}
            >
              {tool.icon}
            </span>
            <div>
              <div className="text-[13px] font-medium">{tool.name}</div>
              <div
                className="text-[11px]"
                style={{ color: "var(--fg-muted)" }}
              >
                {tool.installed
                  ? tool.version || "Installed"
                  : "Not installed"}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
