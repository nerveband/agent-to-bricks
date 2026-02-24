import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FloppyDisk, ArrowLeft } from "@phosphor-icons/react";
import type { Tool } from "../../atoms/tools";

interface ConfigEditorProps {
  tool: Tool;
  onBack: () => void;
}

export function ConfigEditor({ tool, onBack }: ConfigEditorProps) {
  const [content, setContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!tool.configPath) {
      setError("No config path defined for this tool.");
      return;
    }
    try {
      const result = await invoke<string>("read_config", {
        path: tool.configPath,
      });
      setContent(result);
      setError(null);
    } catch (err) {
      setContent(null);
      setError("No config file found at this path.");
    }
  }, [tool.configPath]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!tool.configPath || content === null) return;
    setSaving(true);
    setSaved(false);
    try {
      await invoke("write_config", {
        path: tool.configPath,
        content,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-6 h-6 rounded transition-colors"
          style={{ color: "var(--fg-muted)" }}
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[15px] font-semibold tracking-tight">
          {tool.name} Config
        </h2>
      </div>

      {tool.configPath && (
        <p
          className="text-[11px] font-mono mb-3 break-all"
          style={{ color: "var(--fg-muted)" }}
        >
          {tool.configPath}
        </p>
      )}

      {error && content === null ? (
        <div
          className="text-[13px] p-3 rounded border"
          style={{
            color: "var(--fg-muted)",
            borderColor: "var(--border)",
            background: "var(--bg)",
          }}
        >
          {error}
        </div>
      ) : (
        <>
          <textarea
            value={content ?? ""}
            onChange={(e) => {
              setContent(e.target.value);
              setSaved(false);
            }}
            className="flex-1 min-h-[200px] p-3 rounded border text-[13px] font-mono resize-none focus:outline-none focus:ring-1"
            style={{
              background: "var(--bg)",
              borderColor: "var(--border)",
              color: "var(--fg)",
              // @ts-expect-error CSS custom property for ring color
              "--tw-ring-color": "var(--accent)",
            }}
            spellCheck={false}
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleSave}
              disabled={saving || content === null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium transition-colors"
              style={{
                background: "var(--accent)",
                color: "var(--bg)",
                opacity: saving ? 0.6 : 1,
              }}
            >
              <FloppyDisk size={14} />
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && (
              <span
                className="text-[12px]"
                style={{ color: "var(--fg-muted)" }}
              >
                Saved
              </span>
            )}
            {error && content !== null && (
              <span
                className="text-[12px]"
                style={{ color: "var(--destructive)" }}
              >
                {error}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
