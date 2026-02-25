import { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { toolsAtom, activeToolSlugAtom, toolCustomFlagsAtom, toolWorkingDirsAtom } from "../atoms/tools";
import { sessionsAtom, activeSessionIdAtom } from "../atoms/sessions";
import { settingsOpenAtom, helpOpenAtom, launchDialogToolAtom } from "../atoms/app";
import { useSessionLauncher } from "../hooks/useSessionLauncher";
import { Gear, Plus, Question, PencilSimple, Play, Trash, Terminal, FolderOpen, MagnifyingGlass, X } from "@phosphor-icons/react";
import { AddToolDialog } from "./AddToolDialog";
import { SettingsDialog } from "./SettingsDialog";
import { HelpDialog } from "./HelpDialog";
import { LaunchDialog } from "./LaunchDialog";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

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
  const { launchTerminal } = useSessionLauncher();
  const setLaunchDialogTool = useSetAtom(launchDialogToolAtom);
  const setSessions = useSetAtom(sessionsAtom);

  const [addToolOpen, setAddToolOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useAtom(settingsOpenAtom);
  const [helpOpen, setHelpOpen] = useAtom(helpOpenAtom);
  const [toolFlags, setToolFlags] = useAtom(toolCustomFlagsAtom);
  const [toolDirs, setToolDirs] = useAtom(toolWorkingDirsAtom);
  const [editingToolSlug, setEditingToolSlug] = useState<string | null>(null);
  const [editingDirSlug, setEditingDirSlug] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");

  const browseForDir = async (slug: string, target: "tool" | "session") => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select working directory",
      });
      if (selected && typeof selected === "string") {
        if (target === "tool") {
          setToolDirs((prev) => ({ ...prev, [slug]: selected }));
        } else {
          setSessions((prev) =>
            prev.map((s) => (s.id === slug ? { ...s, cwd: selected } : s))
          );
        }
      }
    } catch {
      // User cancelled
    }
  };

  return (
    <nav
      className="flex flex-col h-full select-none relative z-20"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="px-4 pb-3 pt-3">
        <button
          className="w-full text-left font-semibold text-sm tracking-wide hover:opacity-80 transition-opacity"
          style={{
            color: "var(--yellow)",
            filter: "drop-shadow(0 0 8px rgba(250,204,21,0.2))",
          }}
        >
          {collapsed ? "AB" : "Agent to Bricks"}
        </button>
      </div>

      {/* Tools */}
      <div className="flex-1 overflow-y-auto px-3 mt-2">
        <div className="mb-4" data-onboard="tools">
          <div className="flex items-center justify-between px-2 mb-2">
            <p
              className="text-[10px] font-medium tracking-[0.2em] uppercase"
              style={{ color: "var(--fg-subtle)" }}
            >
              {!collapsed && "Tools"}
            </p>
            <button
              onClick={() => setAddToolOpen(true)}
              className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:text-[var(--fg)]"
              style={{ color: "var(--fg-subtle)" }}
              title="Add tool"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {tools.map((tool) => {
              const isActive = tool.slug === activeToolSlug;
              const isEditing = editingToolSlug === tool.slug;

              return (
                <div key={tool.slug}>
                  <ContextMenu.Root>
                    <ContextMenu.Trigger asChild>
                      <button
                        className={`tool-item w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-[13px] transition-all text-left group ${
                          isActive
                            ? "tool-active white-glass border font-medium relative shadow-sm"
                            : "tool-inactive hover:bg-[var(--white-glass)]"
                        }`}
                        style={{
                          color: isActive ? "var(--fg)" : "var(--fg-muted)",
                          borderColor: isActive ? "var(--border-subtle)" : "transparent",
                        }}
                        title={collapsed ? tool.name : (toolDirs[tool.slug] || undefined)}
                        onClick={() => {
                          if (tool.installed) {
                            setLaunchDialogTool(tool);
                          }
                        }}
                      >
                        {/* Monogram badge */}
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[9px] transition-all border ${
                            isActive
                              ? "glass-input border-[var(--border)]"
                              : "pill-glass border-[var(--border-subtle)] group-hover:border-[var(--border)] group-hover:text-[var(--fg)]"
                          }`}
                          style={{
                            color: isActive ? "var(--yellow)" : "var(--fg-subtle)",
                            boxShadow: isActive ? "var(--shadow-glow)" : undefined,
                          }}
                        >
                          {tool.icon}
                        </div>
                        {!collapsed && (
                          <span className="truncate tracking-tight">{tool.name}</span>
                        )}
                        {/* Active indicator dot */}
                        {isActive && (
                          <div
                            className="absolute w-1.5 h-1.5 rounded-full right-3 top-[10px]"
                            style={{
                              background: "var(--yellow)",
                              boxShadow: "var(--shadow-glow)",
                            }}
                          />
                        )}
                      </button>
                    </ContextMenu.Trigger>
                    <ContextMenu.Portal>
                      <ContextMenu.Content
                        className="context-menu-content min-w-[220px] rounded-xl py-2 text-[13px]"
                      >
                        <div className="px-3 py-1.5 flex flex-col">
                          <ContextMenu.Item
                            className="context-menu-item flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer outline-none group"
                            style={{ color: "var(--fg-muted)" }}
                            disabled={!tool.installed}
                            onSelect={() => { if (tool.installed) setLaunchDialogTool(tool); }}
                          >
                            <Play size={15} />
                            New session
                          </ContextMenu.Item>
                          <ContextMenu.Item
                            className="context-menu-item flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer outline-none group"
                            style={{ color: "var(--fg-muted)" }}
                            onSelect={() => setEditingToolSlug(isEditing ? null : tool.slug)}
                          >
                            <PencilSimple size={15} />
                            Edit flags
                          </ContextMenu.Item>
                        </div>

                        <div className="h-px w-full my-1" style={{ background: "var(--border-subtle)" }} />

                        <div className="px-3 py-1.5 flex flex-col">
                          <ContextMenu.Item
                            className="context-menu-item flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer outline-none group"
                            style={{ color: "var(--fg-muted)" }}
                            onSelect={() => browseForDir(tool.slug, "tool")}
                          >
                            <FolderOpen size={15} />
                            Browse path...
                          </ContextMenu.Item>
                          <ContextMenu.Item
                            className="context-menu-item flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer outline-none group"
                            style={{ color: "var(--fg-muted)" }}
                            onSelect={() => setEditingDirSlug(editingDirSlug === tool.slug ? null : tool.slug)}
                          >
                            <PencilSimple size={15} />
                            Type path
                          </ContextMenu.Item>
                        </div>

                        <div className="h-px w-full my-1" style={{ background: "var(--border-subtle)" }} />

                        <div className="px-3 py-1.5 flex flex-col">
                          <ContextMenu.Item
                            className="context-menu-item flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer outline-none group"
                            style={{ color: "var(--fg-muted)" }}
                            onSelect={() => setSettingsOpen(true)}
                          >
                            <Gear size={15} />
                            Settings
                          </ContextMenu.Item>
                        </div>
                      </ContextMenu.Content>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>

                  {/* Inline flags editor */}
                  {isEditing && !collapsed && (
                    <div className="px-2 pb-1.5">
                      <input
                        type="text"
                        autoFocus
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-1p-ignore
                        value={toolFlags[tool.slug] ?? ""}
                        onChange={(e) =>
                          setToolFlags((prev) => ({
                            ...prev,
                            [tool.slug]: e.target.value,
                          }))
                        }
                        onBlur={() => setEditingToolSlug(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") {
                            setEditingToolSlug(null);
                          }
                        }}
                        placeholder="--flags here"
                        className="w-full px-2 py-1 rounded border text-[11px] font-mono glass-input"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--fg)",
                        }}
                      />
                    </div>
                  )}

                  {/* Inline working directory editor */}
                  {editingDirSlug === tool.slug && !collapsed && (
                    <div className="px-2 pb-1.5 flex gap-1">
                      <input
                        type="text"
                        autoFocus
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={toolDirs[tool.slug] ?? ""}
                        onChange={(e) =>
                          setToolDirs((prev) => ({
                            ...prev,
                            [tool.slug]: e.target.value,
                          }))
                        }
                        onBlur={() => setEditingDirSlug(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") {
                            setEditingDirSlug(null);
                          }
                        }}
                        placeholder="/path/to/project"
                        className="flex-1 min-w-0 px-2 py-1 rounded border text-[11px] font-mono glass-input"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--fg)",
                        }}
                      />
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          browseForDir(tool.slug, "tool");
                          setEditingDirSlug(null);
                        }}
                        className="px-1.5 py-1 rounded border text-[11px]"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--fg-muted)",
                        }}
                        title="Browse"
                      >
                        <FolderOpen size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sessions */}
        {sessions.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <p
                className="text-[10px] font-medium tracking-[0.2em] uppercase"
                style={{ color: "var(--fg-subtle)" }}
              >
                {!collapsed && "Sessions"}
              </p>
            </div>
            {!collapsed && sessions.length > 3 && (
              <div className="px-2 mb-1.5 relative">
                <MagnifyingGlass
                  size={11}
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--fg-muted)" }}
                />
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Filter sessions..."
                  className="w-full pl-6 pr-2 py-1 rounded border text-[11px] glass-input"
                  style={{
                    borderColor: "var(--border-subtle)",
                    color: "var(--fg)",
                  }}
                />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {sessions.filter((s) => {
                if (!sessionSearch.trim()) return true;
                const q = sessionSearch.toLowerCase();
                return (s.displayName || s.toolSlug).toLowerCase().includes(q);
              }).map((session) => {
                const isRenaming = renamingSessionId === session.id;
                const isActiveSession = session.id === activeSessionId;
                return (
                  <div key={session.id}>
                    <ContextMenu.Root>
                      <ContextMenu.Trigger asChild>
                        <div
                          className={`group flex items-center w-full rounded-lg transition-all duration-150 ${
                            isActiveSession
                              ? "white-glass border shadow-sm"
                              : "hover:bg-[var(--white-glass)]"
                          }`}
                          style={{
                            borderColor: isActiveSession ? "var(--border-subtle)" : "transparent",
                            color: isActiveSession ? "var(--fg)" : "var(--fg-muted)",
                          }}
                        >
                          <button
                            className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-[13px]"
                            title={session.cwd || undefined}
                            onClick={() => {
                              setActiveSessionId(session.id);
                              setActiveToolSlug(session.toolSlug);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (!collapsed) {
                                setRenamingSessionId(session.id);
                                setRenameValue(session.displayName || session.toolSlug);
                              }
                            }}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${session.status === "running" ? "animate-pulse-dot" : "opacity-40"}`}
                              style={{
                                background: session.status === "running"
                                  ? "var(--green)"
                                  : "var(--fg-muted)",
                              }}
                            />
                            {!collapsed && (
                              <span className="truncate flex-1 text-left">
                                {session.displayName || session.toolSlug}
                              </span>
                            )}
                          </button>
                          {!collapsed && (
                            <button
                              className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 mr-1 rounded transition-opacity"
                              style={{ color: "var(--fg-muted)" }}
                              title="Close session"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessions((prev) => prev.filter((s) => s.id !== session.id));
                                if (activeSessionId === session.id) {
                                  const remaining = sessions.filter((s) => s.id !== session.id);
                                  setActiveSessionId(remaining[0]?.id ?? null);
                                }
                              }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </ContextMenu.Trigger>
                      <ContextMenu.Portal>
                        <ContextMenu.Content
                          className="context-menu-content min-w-[220px] rounded-xl py-2 text-[13px]"
                        >
                          <div className="px-3 py-1.5 flex flex-col">
                            <ContextMenu.Item
                              className="context-menu-item flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer outline-none group"
                              style={{ color: "var(--fg-muted)" }}
                              onSelect={() => {
                                setRenamingSessionId(session.id);
                                setRenameValue(session.displayName || session.toolSlug);
                              }}
                            >
                              <PencilSimple size={15} />
                              Rename
                            </ContextMenu.Item>
                            <ContextMenu.Item
                              className="context-menu-item flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer outline-none group"
                              style={{ color: "var(--fg-muted)" }}
                              onSelect={() => browseForDir(session.id, "session")}
                            >
                              <FolderOpen size={15} />
                              Set working directory
                            </ContextMenu.Item>
                          </div>

                          <div className="h-px w-full my-1" style={{ background: "var(--border-subtle)" }} />

                          <div className="px-3 py-1.5 flex flex-col">
                            <ContextMenu.Item
                              className="context-menu-item flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer outline-none group"
                              style={{ color: "var(--destructive)" }}
                              onSelect={() => {
                                setSessions((prev) => prev.filter((s) => s.id !== session.id));
                                if (activeSessionId === session.id) {
                                  const remaining = sessions.filter((s) => s.id !== session.id);
                                  setActiveSessionId(remaining[0]?.id ?? null);
                                }
                              }}
                            >
                              <Trash size={15} />
                              Delete
                            </ContextMenu.Item>
                          </div>
                        </ContextMenu.Content>
                      </ContextMenu.Portal>
                    </ContextMenu.Root>

                    {/* Inline rename editor */}
                    {isRenaming && !collapsed && (
                      <div className="px-2 pb-1">
                        <input
                          type="text"
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => {
                            if (renameValue.trim()) {
                              setSessions((prev) =>
                                prev.map((s) =>
                                  s.id === session.id ? { ...s, displayName: renameValue.trim() } : s
                                )
                              );
                            }
                            setRenamingSessionId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === "Escape") {
                              setRenamingSessionId(null);
                            }
                          }}
                          className="w-full px-2 py-1 rounded border text-[11px] glass-input"
                          style={{
                            borderColor: "var(--border-subtle)",
                            color: "var(--fg)",
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="p-3 mb-2 flex flex-col gap-0.5 relative z-20">
        <button
          className="nav-item w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-all text-[13px] text-left group"
          style={{ color: "var(--fg-muted)" }}
          onClick={() => launchTerminal()}
          title={collapsed ? "New Terminal" : undefined}
        >
          <Terminal size={16} className="group-hover:text-[var(--fg)]" style={{ color: "var(--fg-subtle)" }} />
          {!collapsed && "Terminal"}
        </button>
        <button
          className="nav-item w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-all text-[13px] text-left group"
          style={{ color: "var(--fg-muted)" }}
          onClick={() => setSettingsOpen(true)}
        >
          <Gear size={16} className="group-hover:text-[var(--fg)]" style={{ color: "var(--fg-subtle)" }} />
          {!collapsed && "Settings"}
        </button>
        <button
          className="nav-item w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-all text-[13px] text-left group"
          style={{ color: "var(--fg-muted)" }}
          onClick={() => setHelpOpen(true)}
        >
          <Question size={16} className="group-hover:text-[var(--fg)]" style={{ color: "var(--fg-subtle)" }} />
          {!collapsed && "Help"}
        </button>
      </div>

      <AddToolDialog open={addToolOpen} onOpenChange={setAddToolOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <LaunchDialog />
    </nav>
  );
}
