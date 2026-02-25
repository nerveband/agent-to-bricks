import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Globe,
  Key,
  CheckCircle,
  XCircle,
  CircleNotch,
  Wrench,
  Palette,
  Info,
} from "@phosphor-icons/react";
import { sitesAtom, activeSiteIndexAtom, type SiteEntry } from "../atoms/app";
import { toolsAtom } from "../atoms/tools";
import { useTheme } from "../hooks/useTheme";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "site" | "tools" | "theme" | "about";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [sites, setSites] = useAtom(sitesAtom);
  const [activeIdx, setActiveIdx] = useAtom(activeSiteIndexAtom);
  const site = sites[activeIdx] ?? null;
  const [tools] = useAtom(toolsAtom);
  const { theme, toggle } = useTheme();

  const [tab, setTab] = useState<Tab>("site");
  const [siteUrl, setSiteUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [siteName, setSiteName] = useState("");
  const [defaultTool, setDefaultTool] = useState("claude-code");
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open && site) {
      setSiteUrl(site.site_url);
      setApiKey(site.api_key);
      setSiteName(site.name);
    }
    setTestStatus("idle");
    setSaved(false);
  }, [open, site]);

  const handleTest = async () => {
    setTestStatus("testing");
    try {
      const result = await invoke<{ success: boolean }>("test_site_connection", {
        siteUrl: siteUrl.trim(),
        apiKey: apiKey.trim(),
      });
      setTestStatus(result.success ? "success" : "error");
    } catch {
      setTestStatus("error");
    }
  };

  const handleSave = () => {
    const entry: SiteEntry = {
      name: siteName.trim() || new URL(siteUrl.trim()).hostname,
      site_url: siteUrl.trim(),
      api_key: apiKey.trim(),
    };

    if (site) {
      // Update existing site
      setSites((prev) =>
        prev.map((s, i) => (i === activeIdx ? entry : s))
      );
    } else {
      // Add new site
      setSites((prev) => [...prev, entry]);
      setActiveIdx(sites.length);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "site", label: "Site", icon: <Globe size={16} /> },
    { key: "tools", label: "Tools", icon: <Wrench size={16} /> },
    { key: "theme", label: "Theme", icon: <Palette size={16} /> },
    { key: "about", label: "About", icon: <Info size={16} /> },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.5)" }}
        />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-h-[80vh] overflow-hidden rounded-lg border flex flex-col"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <Dialog.Title
              className="text-[16px] font-semibold"
              style={{ color: "var(--fg)" }}
            >
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded transition-colors"
                style={{ color: "var(--fg-muted)" }}
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex flex-1 min-h-0">
            <div
              className="w-[140px] border-r p-2 space-y-0.5"
              style={{ borderColor: "var(--border)" }}
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded text-[13px] transition-colors"
                  style={{
                    background: tab === t.key ? "var(--bg)" : undefined,
                    color:
                      tab === t.key ? "var(--fg)" : "var(--fg-muted)",
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {tab === "site" && (
                <div className="space-y-4">
                  <div>
                    <label
                      className="text-[12px] font-medium mb-1.5 flex items-center gap-1.5"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      <Globe size={14} />
                      Site URL
                    </label>
                    <input
                      type="url"
                      value={siteUrl}
                      onChange={(e) => {
                        setSiteUrl(e.target.value);
                        setTestStatus("idle");
                      }}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 rounded border text-[14px]"
                      style={{
                        background: "var(--bg)",
                        borderColor: "var(--border)",
                        color: "var(--fg)",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="text-[12px] font-medium mb-1.5 flex items-center gap-1.5"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      <Key size={14} />
                      API Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setTestStatus("idle");
                      }}
                      placeholder="atb_..."
                      className="w-full px-3 py-2 rounded border text-[14px] font-mono"
                      style={{
                        background: "var(--bg)",
                        borderColor: "var(--border)",
                        color: "var(--fg)",
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTest}
                      disabled={
                        !siteUrl.trim() ||
                        !apiKey.trim() ||
                        testStatus === "testing"
                      }
                      className="px-3 py-2 rounded text-[13px] border transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--fg-muted)",
                      }}
                    >
                      {testStatus === "testing" ? (
                        <span className="flex items-center gap-1.5">
                          <CircleNotch size={14} className="animate-spin" />
                          Testing...
                        </span>
                      ) : (
                        "Test Connection"
                      )}
                    </button>
                    {testStatus === "success" && (
                      <span
                        className="flex items-center gap-1 text-[13px]"
                        style={{ color: "oklch(0.7 0.15 145)" }}
                      >
                        <CheckCircle size={16} weight="fill" />
                        Connected
                      </span>
                    )}
                    {testStatus === "error" && (
                      <span
                        className="flex items-center gap-1 text-[13px]"
                        style={{ color: "var(--destructive)" }}
                      >
                        <XCircle size={16} weight="fill" />
                        Failed
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 rounded text-[13px] font-semibold transition-colors"
                      style={{
                        background: "var(--accent)",
                        color: "oklch(0.15 0.01 85)",
                      }}
                    >
                      {saved ? "Saved!" : "Save"}
                    </button>
                  </div>
                </div>
              )}

              {tab === "tools" && (
                <div className="space-y-3">
                  <div>
                    <label
                      className="text-[12px] font-medium block mb-1.5"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      Default Tool
                    </label>
                    <select
                      value={defaultTool}
                      onChange={(e) => setDefaultTool(e.target.value)}
                      className="w-full px-3 py-2 rounded border text-[14px]"
                      style={{
                        background: "var(--bg)",
                        borderColor: "var(--border)",
                        color: "var(--fg)",
                      }}
                    >
                      {tools.map((t) => (
                        <option key={t.slug} value={t.slug}>
                          {t.name} {t.installed ? "" : "(not installed)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p
                      className="text-[11px] uppercase tracking-wider mb-2"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      Installed Tools
                    </p>
                    <div className="space-y-2">
                      {tools.map((tool) => (
                        <div
                          key={tool.slug}
                          className="flex items-center gap-3 px-3 py-2 rounded"
                          style={{
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <span
                            className="w-7 h-7 flex items-center justify-center rounded text-[10px] font-bold font-mono"
                            style={{
                              background: "var(--surface)",
                              color: "var(--accent)",
                            }}
                          >
                            {tool.icon}
                          </span>
                          <div className="flex-1">
                            <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
                              {tool.name}
                            </p>
                          </div>
                          <span
                            className="text-[12px] font-mono"
                            style={{
                              color: tool.installed
                                ? "oklch(0.7 0.15 145)"
                                : "var(--destructive)",
                            }}
                          >
                            {tool.installed
                              ? tool.version || "installed"
                              : "not found"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "theme" && (
                <div className="space-y-4">
                  <p
                    className="text-[13px]"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    Choose your preferred appearance.
                  </p>
                  <div className="flex gap-3">
                    {(["dark", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          if (theme !== t) toggle();
                        }}
                        className="flex-1 p-4 rounded-lg border text-center transition-colors"
                        style={{
                          borderColor:
                            theme === t
                              ? "var(--accent)"
                              : "var(--border)",
                          background: "var(--bg)",
                        }}
                      >
                        <div
                          className="text-[24px] mb-2"
                        >
                          {t === "dark" ? "🌙" : "☀️"}
                        </div>
                        <p
                          className="text-[13px] font-medium capitalize"
                          style={{ color: "var(--fg)" }}
                        >
                          {t}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === "about" && (
                <div className="space-y-3">
                  <div>
                    <p
                      className="text-[18px] font-bold tracking-tight"
                      style={{ color: "var(--accent)" }}
                    >
                      Agent to Bricks
                    </p>
                    <p
                      className="text-[13px] mt-1"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      Build Bricks Builder pages with AI coding agents.
                    </p>
                  </div>
                  <div
                    className="p-3 rounded border space-y-2"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg)",
                    }}
                  >
                    <div className="flex justify-between text-[13px]">
                      <span style={{ color: "var(--fg-muted)" }}>Version</span>
                      <span style={{ color: "var(--fg)" }}>0.1.0</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span style={{ color: "var(--fg-muted)" }}>Framework</span>
                      <span style={{ color: "var(--fg)" }}>Tauri 2</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
