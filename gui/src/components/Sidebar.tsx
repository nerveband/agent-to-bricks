import { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { toolsAtom, activeToolSlugAtom } from "../atoms/tools";
import { sessionsAtom, activeSessionIdAtom } from "../atoms/sessions";
import { useSessionLauncher } from "../hooks/useSessionLauncher";
import { Gear, Moon, Plus, Question, SunDim } from "@phosphor-icons/react";
import { useTheme } from "../hooks/useTheme";
import { AddToolDialog } from "./AddToolDialog";

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const [tools] = useAtom(toolsAtom);
  const [activeToolSlug] = useAtom(activeToolSlugAtom);
  const [sessions] = useAtom(sessionsAtom);
  const [activeSessionId] = useAtom(activeSessionIdAtom);
  const setActiveSessionId = useSetAtom(activeSessionIdAtom);
  const setActiveToolSlug = useSetAtom(activeToolSlugAtom);
  const { launch } = useSessionLauncher();
  const { theme, toggle } = useTheme();
  const [addToolOpen, setAddToolOpen] = useState(false);

  return (
    <nav
      className="flex flex-col border-r bg-[var(--surface)] transition-all duration-200 select-none"
      style={{
        width: collapsed ? 56 : 240,
        borderColor: "var(--border)",
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div
        className="p-3 flex items-center gap-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="font-bold text-sm tracking-tight"
          style={{ color: "var(--accent)" }}
        >
          {collapsed ? "AB" : "Agent to Bricks"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 mb-1">
            <p
              className="text-[11px] tracking-widest uppercase"
              style={{ color: "var(--fg-muted)" }}
            >
              {!collapsed && "Tools"}
            </p>
            <button
              onClick={() => setAddToolOpen(true)}
              className="flex items-center justify-center w-5 h-5 rounded transition-colors"
              style={{ color: "var(--fg-muted)" }}
              title="Add tool"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
          {tools.map((tool) => {
            const isActive = tool.slug === activeToolSlug;
            const statusColor = isActive
              ? "var(--accent)"
              : tool.installed
                ? "var(--fg-muted)"
                : "var(--destructive)";

            return (
              <button
                key={tool.slug}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[13px] transition-colors duration-75"
                style={{
                  background: isActive ? "var(--border)" : undefined,
                  borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                }}
                title={collapsed ? tool.name : undefined}
                onClick={() => {
                  if (tool.installed) {
                    launch(tool);
                  }
                }}
              >
                <span
                  className="relative flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold font-mono shrink-0"
                  style={{ background: "var(--bg)" }}
                >
                  {tool.icon}
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${isActive ? "animate-pulse-dot" : "opacity-40"}`}
                    style={{ background: statusColor }}
                  />
                </span>
                {!collapsed && (
                  <span className="truncate tracking-tight">{tool.name}</span>
                )}
              </button>
            );
          })}
        </div>

        {sessions.length > 0 && (
          <div className="mb-4">
            <p
              className="text-[11px] tracking-widest uppercase px-2 mb-1"
              style={{ color: "var(--fg-muted)" }}
            >
              {!collapsed && "Sessions"}
            </p>
            {sessions.map((session) => (
              <button
                key={session.id}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[13px] transition-colors duration-75"
                style={{
                  background: session.id === activeSessionId ? "var(--border)" : undefined,
                }}
                onClick={() => {
                  setActiveSessionId(session.id);
                  setActiveToolSlug(session.toolSlug);
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${session.status === "running" ? "animate-pulse-dot" : "opacity-30"}`}
                  style={{
                    background: session.status === "running" ? "var(--accent)" : "var(--fg-muted)",
                  }}
                />
                {!collapsed && (
                  <span className="truncate flex-1 text-left">
                    {session.toolSlug}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="p-2 border-t flex flex-col gap-1"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors"
          style={{ color: "var(--fg-muted)" }}
        >
          <Gear size={18} />
          {!collapsed && "Settings"}
        </button>
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors"
          style={{ color: "var(--fg-muted)" }}
          onClick={toggle}
          title={collapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
        >
          {theme === "dark" ? <SunDim size={18} /> : <Moon size={18} />}
          {!collapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
        </button>
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors"
          style={{ color: "var(--fg-muted)" }}
        >
          <Question size={18} />
          {!collapsed && "Help"}
        </button>
      </div>

      <AddToolDialog open={addToolOpen} onOpenChange={setAddToolOpen} />
    </nav>
  );
}
