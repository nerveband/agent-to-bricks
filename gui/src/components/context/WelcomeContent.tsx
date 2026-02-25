import { useAtom, useSetAtom } from "jotai";
import { toolsAtom } from "../../atoms/tools";
import { activeSiteAtom, settingsOpenAtom } from "../../atoms/app";
import { useSessionLauncher } from "../../hooks/useSessionLauncher";
import { writeToActivePty } from "../../atoms/ptyBridge";
import {
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
  Upload,
  Atom,
  Globe,
  GearSix,
} from "@phosphor-icons/react";

export function WelcomeContent() {
  const [tools] = useAtom(toolsAtom);
  const [site] = useAtom(activeSiteAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const { launch } = useSessionLauncher();

  const isConnected = !!(site?.site_url && site?.api_key);

  return (
    <div className="p-4">
      <h2 className="text-[15px] font-semibold tracking-tight mb-1">
        Agent to Bricks
      </h2>
      <p
        className="text-[12px] leading-relaxed mb-4"
        style={{ color: "var(--fg-muted)" }}
      >
        Build Bricks Builder pages with AI coding agents.
      </p>

      {/* Connection Status */}
      <div
        className="flex items-center gap-3 p-3 rounded-lg border mb-4"
        style={{
          borderColor: isConnected
            ? "oklch(0.7 0.15 145)"
            : "var(--border)",
          background: "var(--bg)",
        }}
      >
        {isConnected ? (
          <>
            <CheckCircle
              size={20}
              weight="fill"
              style={{ color: "oklch(0.7 0.15 145)" }}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-medium"
                style={{ color: "var(--fg)" }}
              >
                Site connected
              </p>
              <p
                className="text-[11px] font-mono truncate"
                style={{ color: "var(--fg-muted)" }}
              >
                {site.site_url}
              </p>
            </div>
          </>
        ) : (
          <>
            <WarningCircle
              size={20}
              weight="fill"
              style={{ color: "var(--fg-muted)" }}
              className="shrink-0"
            />
            <div className="flex-1">
              <p
                className="text-[13px] font-medium"
                style={{ color: "var(--fg)" }}
              >
                Not connected
              </p>
              <p
                className="text-[11px]"
                style={{ color: "var(--fg-muted)" }}
              >
                Set up your site to use page workflows
              </p>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="shrink-0 px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{
                background: "var(--accent)",
                color: "oklch(0.15 0.01 85)",
              }}
            >
              Setup
            </button>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <h3
        className="text-[11px] tracking-widest uppercase mb-2"
        style={{ color: "var(--fg-muted)" }}
      >
        Quick Actions
      </h3>
      <div className="flex flex-col gap-1.5 mb-4">
        <QuickActionButton
          icon={<Upload size={15} weight="bold" className="rotate-180" />}
          label="Pull a Page"
          description="Download page elements"
          onClick={() => writeToActivePty("bricks pull --page ")}
          disabled={!isConnected}
        />
        <QuickActionButton
          icon={<Atom size={15} weight="bold" />}
          label="Generate a Section"
          description="AI-create from description"
          onClick={() => writeToActivePty("bricks generate section --page ")}
          disabled={!isConnected}
        />
        {isConnected && (
          <QuickActionButton
            icon={<Globe size={15} weight="bold" />}
            label="Open Website"
            description={site.site_url}
            onClick={async () => {
              try {
                const { openUrl } = await import("@tauri-apps/plugin-opener");
                await openUrl(site.site_url);
              } catch (e) {
                console.error("Failed to open URL:", e);
              }
            }}
          />
        )}
        <QuickActionButton
          icon={<GearSix size={15} weight="bold" />}
          label="Settings"
          description="Configure site and tools"
          onClick={() => setSettingsOpen(true)}
        />
      </div>

      {/* Tool Status */}
      <h3
        className="text-[11px] tracking-widest uppercase mb-2"
        style={{ color: "var(--fg-muted)" }}
      >
        Tools
      </h3>
      <div className="flex flex-col gap-2">
        {tools.map((tool) => (
          <button
            key={tool.slug}
            onClick={() => tool.installed && launch(tool)}
            disabled={!tool.installed}
            className="flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors"
            style={{
              borderColor: "var(--border)",
              opacity: tool.installed ? 1 : 0.5,
            }}
          >
            <span
              className="flex items-center justify-center w-7 h-7 rounded font-mono text-[10px] font-bold shrink-0"
              style={{ background: "var(--bg)", color: "var(--accent)" }}
            >
              {tool.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium">{tool.name}</div>
              <div
                className="text-[11px] truncate"
                style={{
                  color: tool.installed
                    ? "oklch(0.7 0.15 145)"
                    : "var(--fg-muted)",
                }}
              >
                {tool.installed
                  ? tool.version || "Installed"
                  : "Not installed"}
              </div>
            </div>
            {tool.installed && (
              <ArrowSquareOut
                size={14}
                style={{ color: "var(--fg-muted)" }}
                className="shrink-0"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded text-left transition-colors"
      style={{
        color: "var(--fg)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span
        className="flex items-center justify-center w-7 h-7 rounded shrink-0"
        style={{ background: "var(--bg)" }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium leading-tight">{label}</div>
        <div
          className="text-[11px] leading-tight truncate"
          style={{ color: "var(--fg-muted)" }}
        >
          {description}
        </div>
      </div>
    </button>
  );
}
