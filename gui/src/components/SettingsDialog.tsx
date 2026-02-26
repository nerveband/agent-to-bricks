import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check } from "@tauri-apps/plugin-updater";
import * as Dialog from "@radix-ui/react-dialog";
import packageJson from '../../package.json';
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
  ChatText,
  Sun,
  Moon,
} from "@phosphor-icons/react";
import { sitesAtom, activeSiteIndexAtom, sessionPrePromptAtom, type SiteEntry, type SiteEnvironment } from "../atoms/app";
import { toolsAtom, toolCustomFlagsAtom, toolWorkingDirsAtom } from "../atoms/tools";
import { useTheme } from "../hooks/useTheme";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "site" | "tools" | "prompt" | "theme" | "about";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [sites, setSites] = useAtom(sitesAtom);
  const [activeIdx, setActiveIdx] = useAtom(activeSiteIndexAtom);
  const site = sites[activeIdx] ?? null;
  const [tools] = useAtom(toolsAtom);
  const [toolFlags, setToolFlags] = useAtom(toolCustomFlagsAtom);
  const [toolDirs, setToolDirs] = useAtom(toolWorkingDirsAtom);
  const [prePrompt, setPrePrompt] = useAtom(sessionPrePromptAtom);
  const { theme, toggle } = useTheme();

  const [tab, setTab] = useState<Tab>("site");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteEnv, setSiteEnv] = useState<SiteEnvironment>("staging");
  const [envLabel, setEnvLabel] = useState("");
  const [defaultTool, setDefaultTool] = useState("claude-code");
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [saved, setSaved] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>("");

  const checkForUpdates = async () => {
    setUpdateStatus("Checking...");
    try {
      const result = await check();
      if (result) {
        setUpdateStatus(`v${result.version} available!`);
      } else {
        setUpdateStatus("Up to date");
      }
    } catch {
      setUpdateStatus("Check failed");
    }
    setTimeout(() => setUpdateStatus(""), 5000);
  };

  useEffect(() => {
    if (open && site) {
      setSiteUrl(site.site_url);
      setApiKey(site.api_key);
      setSiteName(site.name);
      setSiteEnv(site.environment ?? "staging");
      setEnvLabel(site.environmentLabel ?? "");
    }
    if (open) {
      setPromptTemplate(prePrompt);
    }
    setTestStatus("idle");
    setSaved(false);
  }, [open, site, prePrompt]);

  const handleTest = async () => {
    setTestStatus("testing");
    try {
      const result = await invoke<{
        success: boolean;
        site_name: string | null;
      }>("test_site_connection", {
        siteUrl: siteUrl.trim(),
        apiKey: apiKey.trim(),
      });
      setTestStatus(result.success ? "success" : "error");
      if (result.success && result.site_name && !siteName.trim()) {
        setSiteName(result.site_name);
      }
    } catch {
      setTestStatus("error");
    }
  };

  const handleSave = () => {
    const entry: SiteEntry = {
      name: siteName.trim() || new URL(siteUrl.trim()).hostname,
      site_url: siteUrl.trim(),
      api_key: apiKey.trim(),
      environment: siteEnv,
      environmentLabel: envLabel.trim() || undefined,
    };

    if (site) {
      setSites((prev) =>
        prev.map((s, i) => (i === activeIdx ? entry : s))
      );
    } else {
      setSites((prev) => [...prev, entry]);
      setActiveIdx(sites.length);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode; iconFill: React.ReactNode }[] = [
    { key: "site", label: "Site", icon: <Globe size={16} />, iconFill: <Globe size={16} weight="fill" /> },
    { key: "tools", label: "Tools", icon: <Wrench size={16} />, iconFill: <Wrench size={16} weight="fill" /> },
    { key: "prompt", label: "Prompt", icon: <ChatText size={16} />, iconFill: <ChatText size={16} weight="fill" /> },
    { key: "theme", label: "Theme", icon: <Palette size={16} />, iconFill: <Palette size={16} weight="fill" /> },
    { key: "about", label: "About", icon: <Info size={16} />, iconFill: <Info size={16} weight="fill" /> },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 transition-opacity duration-300"
          style={{ background: "var(--surface-dark)", backdropFilter: "blur(20px)" }}
        />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[800px] h-[540px] glass-base flex flex-col overflow-hidden border rounded-2xl"
          style={{
            borderColor: "var(--border-subtle)",
            boxShadow: "var(--shadow-floating)",
          }}
        >
          {/* Header */}
          <div
            className="h-14 shrink-0 flex items-center justify-between px-6 border-b white-glass"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title
              className="font-semibold text-[15px] tracking-wide"
              style={{ color: "var(--fg)" }}
            >
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--white-glass)] transition-colors"
                style={{ color: "var(--fg-muted)" }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 flex min-h-0" style={{ background: "var(--surface)" }}>
            {/* Tab sidebar */}
            <div
              className="w-[200px] shrink-0 border-r pill-glass p-4 flex flex-col gap-1.5"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {TABS.map((t) => {
                const isActiveTab = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-[13px] text-left ${
                      isActiveTab
                        ? "settings-tab-active font-semibold"
                        : "hover:bg-[var(--white-glass)]"
                    }`}
                    style={{
                      color: isActiveTab ? "var(--fg)" : "var(--fg-muted)",
                    }}
                  >
                    <span className={isActiveTab ? "settings-tab-icon" : ""} style={{ color: isActiveTab ? "var(--yellow)" : "var(--fg-subtle)" }}>
                      {isActiveTab ? t.iconFill : t.icon}
                    </span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 p-8 flex flex-col overflow-y-auto">
              {tab === "site" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[14px] font-semibold mb-1" style={{ color: "var(--fg)" }}>
                    <Globe size={16} style={{ color: "var(--yellow)" }} weight="fill" /> Site Connection
                  </div>

                  <div>
                    <label className="text-[12px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "var(--fg-muted)" }}>
                      <Globe size={14} /> Site URL
                    </label>
                    <input
                      type="url"
                      value={siteUrl}
                      onChange={(e) => { setSiteUrl(e.target.value); setTestStatus("idle"); }}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 rounded-xl border text-[14px] glass-input"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "var(--fg-muted)" }}>
                      <Key size={14} /> API Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
                      placeholder="atb_..."
                      className="w-full px-3 py-2 rounded-xl border text-[14px] font-mono glass-input"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[12px] font-medium mb-1.5 block" style={{ color: "var(--fg-muted)" }}>Site Name</label>
                      <input
                        type="text"
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                        placeholder="Auto-detected on test"
                        className="w-full px-3 py-2 rounded-xl border text-[14px] glass-input"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
                      />
                    </div>
                    <div className="w-[130px]">
                      <label className="text-[12px] font-medium mb-1.5 block" style={{ color: "var(--fg-muted)" }}>Environment</label>
                      <select
                        value={siteEnv}
                        onChange={(e) => setSiteEnv(e.target.value as SiteEnvironment)}
                        className="w-full px-3 py-2 rounded-xl border text-[14px] glass-input"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
                      >
                        <option value="production">Production</option>
                        <option value="staging">Staging</option>
                        <option value="local">Local</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-medium mb-1.5 block" style={{ color: "var(--fg-muted)" }}>
                      Custom Environment Label (optional)
                    </label>
                    <input
                      type="text"
                      value={envLabel}
                      onChange={(e) => setEnvLabel(e.target.value)}
                      placeholder={siteEnv === "production" ? "Production" : siteEnv === "staging" ? "Staging" : "Local"}
                      className="w-full px-3 py-2 rounded-xl border text-[14px] glass-input"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTest}
                      disabled={!siteUrl.trim() || !apiKey.trim() || testStatus === "testing"}
                      className="px-3 py-2 rounded-lg text-[13px] border transition-colors"
                      style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
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
                      <span className="flex items-center gap-1 text-[13px]" style={{ color: "var(--green)" }}>
                        <CheckCircle size={16} weight="fill" /> Connected
                      </span>
                    )}
                    {testStatus === "error" && (
                      <span className="flex items-center gap-1 text-[13px]" style={{ color: "var(--destructive)" }}>
                        <XCircle size={16} weight="fill" /> Failed
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-4">
                    <button
                      onClick={handleSave}
                      className="px-6 py-2.5 rounded-lg font-semibold text-[13px] transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0"
                      style={{
                        background: "var(--yellow)",
                        color: "#000",
                        boxShadow: "var(--shadow-glow-strong)",
                      }}
                    >
                      {saved ? "Saved!" : "Save"}
                    </button>
                  </div>
                </div>
              )}

              {tab === "tools" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[14px] font-semibold mb-1" style={{ color: "var(--fg)" }}>
                    <Wrench size={16} style={{ color: "var(--yellow)" }} weight="fill" /> Tools Configuration
                  </div>

                  <div>
                    <label className="text-[12px] font-medium block mb-1.5" style={{ color: "var(--fg-muted)" }}>Default Tool</label>
                    <select
                      value={defaultTool}
                      onChange={(e) => setDefaultTool(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-[14px] glass-input"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
                    >
                      {tools.map((t) => (
                        <option key={t.slug} value={t.slug}>
                          {t.name} {t.installed ? "" : "(not installed)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] mb-2" style={{ color: "var(--fg-subtle)" }}>
                      Tools & Flags
                    </p>
                    <div className="space-y-3">
                      {tools.map((tool) => (
                        <div
                          key={tool.slug}
                          className="px-4 py-3 rounded-xl space-y-2 glass-input border"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-7 h-7 flex items-center justify-center rounded text-[10px] font-bold font-mono shrink-0 pill-glass border"
                              style={{ borderColor: "var(--border-subtle)", color: "var(--yellow)" }}
                            >
                              {tool.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{tool.name}</p>
                            </div>
                            <span
                              className="text-[11px] font-mono shrink-0 px-1.5 py-0.5 rounded"
                              style={{
                                color: tool.installed ? "var(--green)" : "var(--destructive)",
                                background: tool.installed ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                              }}
                            >
                              {tool.installed ? (tool.version ? `v${tool.version.replace(/^v/, "")}` : "ok") : "missing"}
                            </span>
                          </div>
                          <div>
                            <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--fg-muted)" }}>Custom flags</label>
                            <input
                              type="text"
                              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-1p-ignore
                              value={toolFlags[tool.slug] ?? ""}
                              onChange={(e) => setToolFlags((prev) => ({ ...prev, [tool.slug]: e.target.value }))}
                              placeholder="e.g. --dangerously-skip-permissions --verbose"
                              className="w-full px-2.5 py-1.5 rounded-lg border text-[13px] font-mono glass-input"
                              style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--fg-muted)" }}>Working directory</label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                autoComplete="off" autoCorrect="off" spellCheck={false}
                                value={toolDirs[tool.slug] ?? ""}
                                onChange={(e) => setToolDirs((prev) => ({ ...prev, [tool.slug]: e.target.value }))}
                                placeholder="/path/to/project"
                                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-[13px] font-mono glass-input"
                                style={{ borderColor: "var(--border-subtle)", color: "var(--fg)" }}
                              />
                              <button
                                onClick={async () => {
                                  try {
                                    const selected = await openDialog({ directory: true, multiple: false, title: "Select working directory" });
                                    if (selected && typeof selected === "string") {
                                      setToolDirs((prev) => ({ ...prev, [tool.slug]: selected }));
                                    }
                                  } catch { /* cancelled */ }
                                }}
                                className="px-2.5 py-1.5 rounded-lg border text-[13px] transition-colors hover:bg-[var(--white-glass)]"
                                style={{ borderColor: "var(--border-subtle)", color: "var(--fg-muted)" }}
                                title="Browse..."
                              >
                                Browse
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "prompt" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[14px] font-semibold mb-1" style={{ color: "var(--fg)" }}>
                    <ChatText size={16} style={{ color: "var(--yellow)" }} weight="fill" /> Session Context Prompt
                  </div>

                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-subtle)" }}>
                    This prompt is sent to the AI tool when a session starts.
                  </p>

                  <div className="rounded-xl glass-input border p-5 font-mono text-[13px] leading-7"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <textarea
                      value={promptTemplate}
                      onChange={(e) => setPromptTemplate(e.target.value)}
                      rows={8}
                      className="w-full bg-transparent resize-y outline-none font-mono"
                      style={{ color: "var(--fg)", lineHeight: "1.7" }}
                    />
                  </div>

                  <div>
                    <div className="text-[12px] font-bold tracking-widest uppercase mb-3" style={{ color: "var(--fg-muted)" }}>
                      Available variables
                    </div>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[13px]">
                      {[
                        { var: "{site_url}", desc: "Site URL" },
                        { var: "{api_key}", desc: "API key" },
                        { var: "{site_name}", desc: "Site name" },
                        { var: "{environment}", desc: "Environment tag" },
                      ].map((v) => (
                        <div key={v.var} className="flex items-center gap-3">
                          <span
                            className="px-2 py-[2px] rounded white-glass border text-[11px] font-mono font-semibold hover:bg-[var(--white-glass)] cursor-pointer transition-colors shadow-sm"
                            style={{ borderColor: "var(--border-subtle)", color: "var(--yellow)" }}
                          >
                            {v.var}
                          </span>
                          <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>{v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex items-center gap-3">
                    <button
                      onClick={() => {
                        setPrePrompt(promptTemplate);
                        setSaved(true);
                        setTimeout(() => setSaved(false), 2000);
                      }}
                      className="px-6 py-2.5 rounded-lg font-semibold text-[13px] transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0"
                      style={{
                        background: "var(--yellow)",
                        color: "#000",
                        boxShadow: "var(--shadow-glow-strong)",
                      }}
                    >
                      {saved ? "Saved!" : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        const defaultTemplate = `You are a web developer working with a Bricks Builder WordPress site ({environment}).\nSite: {site_url}\nAPI Key: {api_key}\nThe bricks CLI is available. Use \`bricks\` commands to pull, push, generate, and modify page elements.\nUse the API key with the X-ATB-Key header when making API calls to the site.`;
                        setPromptTemplate(defaultTemplate);
                      }}
                      className="px-3 py-2.5 rounded-lg text-[13px] border transition-colors hover:bg-[var(--white-glass)]"
                      style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
                    >
                      Reset to Default
                    </button>
                  </div>
                </div>
              )}

              {tab === "theme" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[14px] font-semibold mb-1" style={{ color: "var(--fg)" }}>
                    <Palette size={16} style={{ color: "var(--yellow)" }} weight="fill" /> Appearance
                  </div>
                  <p className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>
                    Choose your preferred appearance.
                  </p>
                  <div className="flex gap-3">
                    {(["dark", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => { if (theme !== t) toggle(); }}
                        className="flex-1 p-4 rounded-xl border text-center transition-all hover:-translate-y-0.5"
                        style={{
                          borderColor: theme === t ? "var(--yellow)" : "var(--border-subtle)",
                          background: theme === t ? "var(--white-glass)" : "transparent",
                          boxShadow: theme === t ? "var(--shadow-glow)" : undefined,
                        }}
                      >
                        <div className="text-[24px] mb-2 flex justify-center">
                          {t === "dark" ? <Moon size={28} weight="fill" style={{ color: "var(--yellow)" }} /> : <Sun size={28} weight="fill" style={{ color: "var(--yellow)" }} />}
                        </div>
                        <p className="text-[13px] font-medium capitalize" style={{ color: "var(--fg)" }}>
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
                      style={{ color: "var(--yellow)", filter: "drop-shadow(0 0 8px rgba(250,204,21,0.3))" }}
                    >
                      Agent to Bricks
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: "var(--fg-muted)" }}>
                      Build Bricks Builder pages with AI coding agents.
                    </p>
                  </div>
                  <div
                    className="p-4 rounded-xl glass-input border space-y-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    {[
                      { label: "Version", value: packageJson.version },
                      { label: "Framework", value: "Tauri 2" },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between text-[13px]">
                        <span style={{ color: "var(--fg-muted)" }}>{item.label}</span>
                        <span style={{ color: "var(--fg)" }}>{item.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-[13px]">
                      <span style={{ color: "var(--fg-muted)" }}>Updates</span>
                      <button
                        onClick={checkForUpdates}
                        className="hover:underline text-[12px]"
                        style={{ color: "var(--yellow)" }}
                      >
                        {updateStatus || "Check for Updates"}
                      </button>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span style={{ color: "var(--fg-muted)" }}>Developer</span>
                      <button onClick={() => openUrl("https://ashrafali.net")} className="hover:underline" style={{ color: "var(--yellow)" }}>
                        Ashraf Ali
                      </button>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span style={{ color: "var(--fg-muted)" }}>Source</span>
                      <button onClick={() => openUrl("https://github.com/wavedepth/agent-to-bricks")} className="hover:underline" style={{ color: "var(--yellow)" }}>
                        GitHub
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                    Agent to Bricks lets you use AI coding agents like Claude Code, Cursor, and Windsurf to build and modify Bricks Builder pages through a CLI and WordPress plugin.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
