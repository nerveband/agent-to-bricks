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
      className="flex flex-col border-r bg-[var(--surface)] h-full select-none"
      style={{ borderColor: "var(--border)" }}
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
        <div className="mb-4" data-onboard="tools">
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
            const isEditing = editingToolSlug === tool.slug;

            return (
              <div key={tool.slug}>
                <ContextMenu.Root>
                  <ContextMenu.Trigger asChild>
                    <button
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[13px] transition-all duration-150 ${isActive ? 'shadow-sm' : 'hover:bg-[var(--border)]'}`}
                      style={{
                        background: isActive ? "var(--accent)" : "transparent",
                        color: isActive ? "#ffffff" : "inherit",
                      }}
                      title={collapsed ? tool.name : undefined}
                      onClick={() => {
                        if (tool.installed) {
                          setLaunchDialogTool(tool);
                        }
                      }}
                    >
                      <span
                        className="relative flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold font-mono shrink-0"
                        style={{ background: "var(--bg)" }}
                      >
                        {tool.icon}
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface)] ${isActive ? "animate-pulse-dot" : "opacity-50"}`}
                          style={{ background: statusColor }}
                        />
                      </span>
                      {!collapsed && (
                        <span className="truncate tracking-tight">{tool.name}</span>
                      )}
                    </button>
                  </ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Content
                      className="min-w-[180px] rounded-lg p-1 text-[13px] shadow-lg border"
                      style={{
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <ContextMenu.Item
                        className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer outline-none data-[highlighted]:bg-[var(--border)]"
                        style={{ color: "var(--fg)" }}
                        disabled={!tool.installed}
                        onSelect={() => { if (tool.installed) setLaunchDialogTool(tool); }}
                      >
                        <Play size={14} />
                        New session
                      </ContextMenu.Item>
                      <ContextMenu.Separator
                        className="h-px my-1"
                        style={{ background: "var(--border)" }}
                      />
                      <ContextMenu.Item
                        className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer outline-none data-[highlighted]:bg-[var(--border)]"
                        style={{ color: "var(--fg)" }}
                        onSelect={() => setEditingToolSlug(isEditing ? null : tool.slug)}
                      >
                        <PencilSimple size={14} />
                        Edit flags
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer outline-none data-[highlighted]:bg-[var(--border)]"
                        style={{ color: "var(--fg)" }}
                        onSelect={() => browseForDir(tool.slug, "tool")}
                      >
                        <FolderOpen size={14} />
                        Browse path...
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer outline-none data-[highlighted]:bg-[var(--border)]"
                        style={{ color: "var(--fg)" }}
                        onSelect={() => setEditingDirSlug(editingDirSlug === tool.slug ? null : tool.slug)}
                      >
                        <PencilSimple size={14} />
                        Type path
                      </ContextMenu.Item>
                      <ContextMenu.Separator
                        className="h-px my-1"
                        style={{ background: "var(--border)" }}
                      />
                      <ContextMenu.Item
                        className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer outline-none data-[highlighted]:bg-[var(--border)]"
                        style={{ color: "var(--fg)" }}
                        onSelect={() => setSettingsOpen(true)}
                      >
                        <Gear size={14} />
                        Settings
                      </ContextMenu.Item>
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
                      className="w-full px-2 py-1 rounded border text-[11px] font-mono"
                      style={{
                        background: "var(--bg)",
                        borderColor: "var(--border)",
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
                      className="flex-1 min-w-0 px-2 py-1 rounded border text-[11px] font-mono"
                      style={{
                        background: "var(--bg)",
                        borderColor: "var(--border)",
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
                        borderColor: "var(--border)",
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

        {sessions.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between px-2 mb-1">
              <p
                className="text-[11px] tracking-widest uppercase"
                style={{ color: "var(--fg-muted)" }}
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
                  className="w-full pl-6 pr-2 py-1 rounded border text-[11px]"
                  style={{
                    background: "var(--bg)",
                    borderColor: "var(--border)",
                    color: "var(--fg)",
                  }}
                />
              </div>
            )}
            {sessions.filter((s) => {
              if (!sessionSearch.trim()) return true;
              const q = sessionSearch.toLowerCase();
              return (s.displayName || s.toolSlug).toLowerCase().includes(q);
            }).map((session) => {
              const isRenaming = renamingSessionId === session.id;
              return (
                <div key={session.id}>
                  <ContextMenu.Root>
                    <ContextMenu.Trigger asChild>
                      <div
                        className={`group flex items-center w-full rounded-md transition-all duration-150 ${session.id === activeSessionId ? 'shadow-sm' : 'hover:bg-[var(--border)]'}`}
                        style={{
                          background: session.id === activeSessionId ? "var(--accent)" : "transparent",
                          color: session.id === activeSessionId ? "#ffffff" : "inherit",
                        }}
                      >
                        <button
                          className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-[13px]"
                          onClick={() => {
                            setActiveSessionId(session.id);
                            setActiveToolSlug(session.toolSlug);
                          }}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 border border-[var(--surface)] ${session.status === "running" ? "animate-pulse-dot" : "opacity-40"}`}
                            style={{
                              background: session.status === "running" ? (session.id === activeSessionId ? "#ffffff" : "var(--accent)") : "var(--fg-muted)",
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
                        className="min-w-[180px] rounded-lg p-1 text-[13px] shadow-lg border"
                        style={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <ContextMenu.Item
                          className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer outline-none data-[highlighted]:bg-[var(--border)]"
                          style={{ color: "var(--fg)" }}
                          onSelect={() => {
                            setRenamingSessionId(session.id);
                            setRenameValue(session.displayName || session.toolSlug);
                          }}
                        >
                          <PencilSimple size={14} />
                          Rename
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer outline-none data-[highlighted]:bg-[var(--border)]"
                          style={{ color: "var(--fg)" }}
                          onSelect={() => browseForDir(session.id, "session")}
                        >
                          <FolderOpen size={14} />
                          Set working directory
                        </ContextMenu.Item>
                        <ContextMenu.Separator
                          className="h-px my-1"
                          style={{ background: "var(--border)" }}
                        />
                        <ContextMenu.Item
                          className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer outline-none data-[highlighted]:bg-[var(--border)]"
                          style={{ color: "var(--destructive)" }}
                          onSelect={() => {
                            setSessions((prev) => prev.filter((s) => s.id !== session.id));
                            if (activeSessionId === session.id) {
                              const remaining = sessions.filter((s) => s.id !== session.id);
                              setActiveSessionId(remaining[0]?.id ?? null);
                            }
                          }}
                        >
                          <Trash size={14} />
                          Delete
                        </ContextMenu.Item>
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
                        className="w-full px-2 py-1 rounded border text-[11px]"
                        style={{
                          background: "var(--bg)",
                          borderColor: "var(--border)",
                          color: "var(--fg)",
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
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
          onClick={() => launchTerminal()}
          title={collapsed ? "New Terminal" : undefined}
        >
          <Terminal size={18} />
          {!collapsed && "Terminal"}
        </button>
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors"
          style={{ color: "var(--fg-muted)" }}
          onClick={() => setSettingsOpen(true)}
        >
          <Gear size={18} />
          {!collapsed && "Settings"}
        </button>

        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors"
          style={{ color: "var(--fg-muted)" }}
          onClick={() => setHelpOpen(true)}
        >
          <Question size={18} />
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
