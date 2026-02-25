import { useState, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FolderOpen, Play } from "@phosphor-icons/react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { launchDialogToolAtom, activeSiteAtom, sessionPrePromptAtom } from "../atoms/app";
import { toolCustomFlagsAtom, toolWorkingDirsAtom } from "../atoms/tools";
import { useSessionLauncher } from "../hooks/useSessionLauncher";
import { VariableEditor } from "./prompt/VariableEditor";

export function LaunchDialog() {
  const [tool, setTool] = useAtom(launchDialogToolAtom);
  const site = useAtomValue(activeSiteAtom);
  const [toolFlags, setToolFlags] = useAtom(toolCustomFlagsAtom);
  const [toolDirs, setToolDirs] = useAtom(toolWorkingDirsAtom);
  const [prePrompt, setPrePrompt] = useAtom(sessionPrePromptAtom);
  const { launch } = useSessionLauncher();

  const [cwd, setCwd] = useState("");
  const [flags, setFlags] = useState("");
  const [prompt, setPrompt] = useState("");

  const open = tool !== null;

  // Initialize local state when dialog opens
  useEffect(() => {
    if (tool) {
      setCwd(toolDirs[tool.slug] ?? "");
      setFlags(toolFlags[tool.slug] ?? "");
      setPrompt(prePrompt);
    }
  }, [tool, toolDirs, toolFlags, prePrompt]);

  const handleLaunch = () => {
    if (!tool) return;

    // Persist changes back to atoms
    if (cwd !== (toolDirs[tool.slug] ?? "")) {
      setToolDirs((prev) => ({ ...prev, [tool.slug]: cwd }));
    }
    if (flags !== (toolFlags[tool.slug] ?? "")) {
      setToolFlags((prev) => ({ ...prev, [tool.slug]: flags }));
    }
    if (prompt !== prePrompt) {
      setPrePrompt(prompt);
    }

    launch(tool, cwd || undefined);
    setTool(null);
  };

  const handleBrowse = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select working directory",
      });
      if (selected && typeof selected === "string") {
        setCwd(selected);
      }
    } catch {
      // User cancelled
    }
  };

  // Build resolved values map from active site for pill display
  const resolvedValues: Record<string, string> = {};
  if (site) {
    resolvedValues.site_url = site.site_url;
    resolvedValues.api_key = site.api_key;
    resolvedValues.site_name = site.name;
    resolvedValues.environment = site.environment ?? "";
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) setTool(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 transition-opacity duration-300"
          style={{ background: "var(--surface-dark)", backdropFilter: "blur(20px)" }}
        />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-h-[85vh] overflow-hidden glass-base rounded-2xl border flex flex-col"
          style={{
            borderColor: "var(--border-subtle)",
            boxShadow: "var(--shadow-floating)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b white-glass"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
              {tool && (
                <span
                  className="w-7 h-7 flex items-center justify-center rounded text-[10px] font-bold font-mono pill-glass border"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--yellow)" }}
                >
                  {tool.icon}
                </span>
              )}
              Launch {tool?.name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--white-glass)] transition-colors" style={{ color: "var(--fg-muted)" }}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Working Directory */}
            <div>
              <label
                className="text-[12px] font-medium mb-1.5 flex items-center gap-1.5"
                style={{ color: "var(--fg-muted)" }}
              >
                <FolderOpen size={14} />
                Working Directory
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="/path/to/project"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border text-[13px] font-mono glass-input"
                  style={{
                    borderColor: "var(--border-subtle)",
                    color: "var(--fg)",
                  }}
                />
                <button
                  onClick={handleBrowse}
                  className="px-3 py-2 rounded-lg border text-[13px] transition-colors hover:bg-[var(--white-glass)]"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--fg-muted)" }}
                  title="Browse..."
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Flags */}
            <div>
              <label
                className="text-[12px] font-medium mb-1.5 block"
                style={{ color: "var(--fg-muted)" }}
              >
                Flags
              </label>
              <input
                type="text"
                value={flags}
                onChange={(e) => setFlags(e.target.value)}
                placeholder="--verbose --dangerously-skip-permissions"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                className="w-full px-3 py-2 rounded-xl border text-[13px] font-mono glass-input"
                style={{
                  borderColor: "var(--border-subtle)",
                  color: "var(--fg)",
                }}
              />
            </div>

            {/* System Context Prompt */}
            <div>
              <label
                className="text-[12px] font-medium mb-1.5 block"
                style={{ color: "var(--fg-muted)" }}
              >
                System Context Prompt
              </label>
              <p className="text-[10px] mb-2" style={{ color: "var(--fg-muted)" }}>
                Sent to the tool when the session starts. Click variables to see their values.
              </p>
              <VariableEditor
                value={prompt}
                onChange={setPrompt}
                resolvedValues={resolvedValues}
                rows={6}
                placeholder="Enter session context prompt..."
              />
            </div>

            {/* Variable reference */}
            <div
              className="p-3 rounded-xl glass-input border"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <p className="text-[10px] font-medium mb-1.5" style={{ color: "var(--fg-muted)" }}>
                Available variables
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { var: "{site_url}", val: site?.site_url },
                  { var: "{api_key}", val: site?.api_key ? "***" : undefined },
                  { var: "{site_name}", val: site?.name },
                  { var: "{environment}", val: site?.environment },
                ].map((v) => (
                  <div key={v.var} className="flex items-center gap-2">
                    <code
                      className="text-[11px] px-1.5 py-0.5 rounded white-glass border font-mono font-semibold hover:bg-[var(--white-glass)] cursor-pointer transition-colors shadow-sm"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--yellow)" }}
                    >
                      {v.var}
                    </code>
                    {v.val && (
                      <span className="text-[10px] truncate" style={{ color: "var(--fg-muted)" }}>
                        {v.val}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 border-t white-glass"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <button
              onClick={() => setTool(null)}
              className="px-4 py-2 rounded-lg text-[13px] border transition-colors hover:bg-[var(--white-glass)]"
              style={{ borderColor: "var(--border-subtle)", color: "var(--fg-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleLaunch}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background: "var(--yellow)",
                color: "#000",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              <Play size={14} weight="fill" />
              Launch
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
