import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { useState } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toolsAtom, customToolDefsAtom, toolWorkingDirsAtom, type Tool } from "../atoms/tools";

interface AddToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToolDialog({ open, onOpenChange }: AddToolDialogProps) {
  const setTools = useSetAtom(toolsAtom);
  const setCustomToolDefs = useSetAtom(customToolDefsAtom);
  const setToolDirs = useSetAtom(toolWorkingDirsAtom);
  const existingTools = useAtomValue(toolsAtom);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [workDir, setWorkDir] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [slugError, setSlugError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for slug collision
    if (existingTools.some((t) => t.slug === slug)) {
      setSlugError(`A tool with identifier "${slug}" already exists.`);
      return;
    }

    const newTool: Tool = {
      slug,
      name: name.trim(),
      command: command.trim(),
      args: [],
      icon: name.trim().substring(0, 2).toUpperCase(),
      installed: true,
      version: null,
      path: null,
      configPath: configPath.trim() || null,
      installInstructions: {},
    };

    // Persist custom tool definition so it survives restart
    setCustomToolDefs((prev) => [
      ...prev,
      {
        slug,
        name: name.trim(),
        command: command.trim(),
        args: [],
        icon: name.trim().substring(0, 2).toUpperCase(),
        configPath: configPath.trim() || null,
        installInstructions: {},
      },
    ]);

    // Save working directory if provided
    if (workDir.trim()) {
      setToolDirs((prev) => ({ ...prev, [slug]: workDir.trim() }));
    }

    setTools((prev) => [...prev, newTool]);
    setName("");
    setCommand("");
    setWorkDir("");
    setConfigPath("");
    setSlugError("");
    onOpenChange(false);
  };

  const browseForBinary = async () => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        title: "Select tool binary",
      });
      if (selected && typeof selected === "string") {
        setCommand(selected);
      }
    } catch {
      // User cancelled
    }
  };

  const inputStyle = {
    borderColor: "var(--border-subtle)",
    color: "var(--fg)",
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 transition-opacity duration-300"
          style={{ background: "var(--surface-dark)", backdropFilter: "blur(20px)" }}
        />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[90vw] glass-base rounded-2xl border p-6"
          style={{
            zIndex: 51,
            borderColor: "var(--border-subtle)",
            boxShadow: "var(--shadow-floating)",
            color: "var(--fg)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-[15px] font-semibold tracking-tight">
              Add Tool
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="flex items-center justify-center w-6 h-6 rounded transition-colors"
                style={{ color: "var(--fg-muted)" }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label
                className="block text-[12px] font-medium mb-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Tool name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSlugError(""); }}
                placeholder="e.g. Aider"
                className="w-full px-3 py-1.5 rounded-xl border text-[13px] glass-input focus:outline-none"
                style={{
                  ...inputStyle,
                  // @ts-expect-error CSS custom property for ring color
                  "--tw-ring-color": "var(--accent)",
                }}
              />
              {slugError && (
                <p className="text-[11px] mt-1" style={{ color: "var(--destructive)" }}>
                  {slugError}
                </p>
              )}
            </div>

            <div>
              <label
                className="block text-[12px] font-medium mb-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Launch command <span style={{ color: "var(--destructive)" }}>*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g. aider"
                  required
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border text-[13px] glass-input focus:outline-none"
                  style={{
                    ...inputStyle,
                    // @ts-expect-error CSS custom property for ring color
                    "--tw-ring-color": "var(--accent)",
                  }}
                />
                <button
                  type="button"
                  onClick={browseForBinary}
                  className="px-2.5 py-1.5 rounded-lg border text-[13px] transition-colors hover:bg-[var(--white-glass)]"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--fg-muted)" }}
                  title="Browse for binary..."
                >
                  Browse
                </button>
              </div>
            </div>

            <div>
              <label
                className="block text-[12px] font-medium mb-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Working directory
                <span
                  className="ml-1 text-[11px]"
                  style={{ color: "var(--fg-muted)", opacity: 0.6 }}
                >
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={workDir}
                onChange={(e) => setWorkDir(e.target.value)}
                placeholder="e.g. ~/projects/my-app"
                className="w-full px-3 py-1.5 rounded-xl border text-[13px] glass-input focus:outline-none"
                style={{
                  ...inputStyle,
                  // @ts-expect-error CSS custom property for ring color
                  "--tw-ring-color": "var(--accent)",
                }}
              />
            </div>

            <div>
              <label
                className="block text-[12px] font-medium mb-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Config file path
                <span
                  className="ml-1 text-[11px]"
                  style={{ color: "var(--fg-muted)", opacity: 0.6 }}
                >
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={configPath}
                onChange={(e) => setConfigPath(e.target.value)}
                placeholder="e.g. ~/.config/aider/config.yaml"
                className="w-full px-3 py-1.5 rounded-xl border text-[13px] glass-input focus:outline-none"
                style={{
                  ...inputStyle,
                  // @ts-expect-error CSS custom property for ring color
                  "--tw-ring-color": "var(--accent)",
                }}
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded text-[13px] border transition-colors"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--fg-muted)",
                  }}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: "var(--yellow)",
                  color: "#000",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                Add Tool
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
