# Tauri GUI Companion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform Tauri 2.0 desktop app that wraps AI coding CLIs (Claude Code, Codex, OpenCode) in a friendly GUI with embedded xterm.js terminal, config management, session tracking, and onboarding.

**Architecture:** Tauri 2.0 Rust backend spawns PTY processes via `tauri-plugin-pty`. React + Vite webview renders a three-panel layout (sidebar / xterm.js terminal / context panel). Jotai manages per-session state. SQLite persists tool registry and session history.

**Tech Stack:** Tauri 2.0, React 18, Vite, xterm.js, tauri-plugin-pty, tauri-plugin-sql (SQLite), Jotai, Radix UI, Tailwind CSS v4, Phosphor Icons, Manrope + Geist Mono fonts, motion (framer-motion)

**Design doc:** `docs/plans/2026-02-24-tauri-gui-companion-design.md`

---

## Phase 1: Project Scaffold

### Task 1: Create prototype branch

**Files:** None (git operation)

**Step 1: Create and switch to branch**

```bash
git checkout -b feat/tauri-gui-prototype
```

**Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `feat/tauri-gui-prototype`

---

### Task 2: Scaffold Tauri 2.0 + React + Vite app

**Files:**
- Create: `gui/` (entire scaffold directory)

**Prerequisites:** Rust toolchain installed (`rustup`), Node.js 18+, npm

**Step 1: Install Tauri CLI**

```bash
cargo install create-tauri-app --locked
```

**Step 2: Scaffold the app**

```bash
cd "/Users/nerveband/wavedepth Dropbox/Ashraf Ali/Mac (2)/Documents/GitHub/agent-to-bricks"
cargo create-tauri-app gui --template react-ts --manager npm
```

When prompted:
- Project name: `agent-to-bricks`
- Frontend: React + TypeScript
- Package manager: npm

This creates `gui/` with:
```
gui/
  src/              # React frontend
  src-tauri/        # Rust backend
    src/
      lib.rs
      main.rs
    Cargo.toml
    tauri.conf.json
  package.json
  vite.config.ts
  tsconfig.json
  index.html
```

**Step 3: Verify scaffold builds**

```bash
cd gui && npm install && npm run tauri dev
```

Expected: A Tauri window opens with the default React template.

**Step 4: Commit**

```bash
git add gui/
git commit -m "feat(gui): scaffold Tauri 2.0 + React + Vite app"
```

---

### Task 3: Install Rust plugins

**Files:**
- Modify: `gui/src-tauri/Cargo.toml`
- Modify: `gui/src-tauri/src/lib.rs`

**Step 1: Add tauri-plugin-pty and tauri-plugin-sql**

```bash
cd gui/src-tauri
cargo add tauri-plugin-pty
cargo add tauri-plugin-sql --features sqlite
cargo add serde --features derive
cargo add serde_json
```

**Step 2: Register plugins in lib.rs**

Replace the contents of `gui/src-tauri/src/lib.rs` with:

```rust
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_pty::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Verify it compiles**

```bash
cd gui && npm run tauri build -- --debug 2>&1 | head -20
```

If compilation fails on `tauri-plugin-pty`, fall back to implementing PTY manually with `portable-pty` crate (see Task 3b fallback below).

**Step 4: Commit**

```bash
git add gui/src-tauri/Cargo.toml gui/src-tauri/src/lib.rs
git commit -m "feat(gui): add tauri-plugin-pty and tauri-plugin-sql"
```

---

### Task 3b (FALLBACK): Manual PTY if tauri-plugin-pty fails

Only do this if Task 3 Step 3 fails.

**Files:**
- Modify: `gui/src-tauri/Cargo.toml`
- Create: `gui/src-tauri/src/pty.rs`
- Modify: `gui/src-tauri/src/lib.rs`

**Step 1: Add portable-pty + tokio**

```bash
cd gui/src-tauri
cargo add portable-pty
cargo add tokio --features full
```

**Step 2: Create PTY module at `gui/src-tauri/src/pty.rs`**

```rust
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct PtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pid: u32,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn(
        &self,
        app: AppHandle,
        session_id: String,
        command: String,
        args: Vec<String>,
        cols: u16,
        rows: u16,
    ) -> Result<u32, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new(&command);
        for arg in &args {
            cmd.arg(arg);
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        let pid = child.process_id().unwrap_or(0);

        let writer = Arc::new(Mutex::new(pair.master.take_writer().map_err(|e| e.to_string())?));
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

        // Store session
        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(
                session_id.clone(),
                PtySession {
                    writer: writer.clone(),
                    pid,
                },
            );
        }

        // Spawn reader thread
        let sid = session_id.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = app.emit(&format!("pty:exit:{}", sid), ());
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app.emit(&format!("pty:output:{}", sid), data);
                    }
                    Err(_) => {
                        let _ = app.emit(&format!("pty:exit:{}", sid), ());
                        break;
                    }
                }
            }
        });

        Ok(pid)
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get(session_id) {
            let mut writer = session.writer.lock().unwrap();
            writer
                .write_all(data.as_bytes())
                .map_err(|e| e.to_string())?;
            writer.flush().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }
}
```

**Step 3: Register PTY commands in lib.rs**

```rust
use std::sync::Mutex;
use tauri::Manager;

mod pty;
use pty::PtyManager;

#[tauri::command]
fn pty_spawn(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<PtyManager>>,
    session_id: String,
    command: String,
    args: Vec<String>,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let manager = state.lock().unwrap();
    manager.spawn(app, session_id, command, args, cols, rows)
}

#[tauri::command]
fn pty_write(
    state: tauri::State<'_, Mutex<PtyManager>>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let manager = state.lock().unwrap();
    manager.write(&session_id, &data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(PtyManager::new()))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .invoke_handler(tauri::generate_handler![pty_spawn, pty_write])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4: Verify it compiles**

```bash
cd gui && cargo build --manifest-path src-tauri/Cargo.toml
```

**Step 5: Commit**

```bash
git add gui/src-tauri/
git commit -m "feat(gui): add manual PTY backend with portable-pty"
```

---

### Task 4: Install frontend dependencies

**Files:**
- Modify: `gui/package.json`

**Step 1: Install core dependencies**

```bash
cd gui
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-webgl
npm install jotai
npm install @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-toggle @radix-ui/react-select @radix-ui/react-separator
npm install @phosphor-icons/react
npm install motion
npm install cmdk
```

If Task 3 succeeded (tauri-plugin-pty):
```bash
npm install tauri-pty
```

**Step 2: Install Tailwind CSS v4**

```bash
npm install tailwindcss @tailwindcss/vite
```

Update `gui/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

**Step 3: Install fonts**

```bash
npm install @fontsource/manrope @fontsource/geist-mono
```

**Step 4: Verify `npm install` succeeds**

```bash
cd gui && npm install
```

Expected: No errors.

**Step 5: Commit**

```bash
git add gui/package.json gui/package-lock.json gui/vite.config.ts
git commit -m "feat(gui): add frontend dependencies (xterm, jotai, radix, tailwind v4)"
```

---

## Phase 2: Design System & App Shell

### Task 5: Set up Tailwind v4 with Bricks color tokens

**Files:**
- Create: `gui/src/index.css`

**Step 1: Write the CSS file**

```css
@import "tailwindcss";
@import "@fontsource/manrope/variable.css";
@import "@fontsource/geist-mono";

@theme {
  --font-sans: "Manrope", system-ui, sans-serif;
  --font-mono: "Geist Mono", "JetBrains Mono", monospace;
}

:root {
  --bg: oklch(0.98 0.002 85);
  --surface: oklch(0.96 0.003 85);
  --terminal: oklch(0.10 0.005 265);
  --fg: oklch(0.25 0.01 265);
  --fg-muted: oklch(0.50 0.01 265);
  --accent: oklch(0.82 0.16 85);
  --accent-hover: oklch(0.76 0.14 85);
  --border: oklch(0.90 0.003 265);
  --destructive: oklch(0.55 0.22 27);

  color-scheme: light;
}

[data-theme="dark"] {
  --bg: oklch(0.14 0.005 265);
  --surface: oklch(0.18 0.005 265);
  --fg: oklch(0.93 0.005 85);
  --fg-muted: oklch(0.65 0.008 265);
  --accent-hover: oklch(0.88 0.14 85);
  --border: oklch(0.22 0.005 265);
  --destructive: oklch(0.60 0.22 27);

  color-scheme: dark;
}

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
}

/* Disable Radix overlay animations for instant feel */
[data-radix-popper-content-wrapper] {
  animation: none !important;
}

/* Custom scrollbars */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

/* Status dot pulse animation */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.animate-pulse-dot {
  animation: pulse-dot 2s ease-in-out infinite;
}
```

**Step 2: Verify Tailwind processes the file**

```bash
cd gui && npx vite build 2>&1 | tail -5
```

Expected: Build succeeds, CSS is generated.

**Step 3: Commit**

```bash
git add gui/src/index.css
git commit -m "feat(gui): add Bricks-aligned Tailwind v4 design tokens"
```

---

### Task 6: Build the app shell layout

**Files:**
- Create: `gui/src/components/AppShell.tsx`
- Create: `gui/src/components/Sidebar.tsx`
- Create: `gui/src/components/TerminalPanel.tsx`
- Create: `gui/src/components/ContextPanel.tsx`
- Create: `gui/src/components/StatusBar.tsx`
- Modify: `gui/src/App.tsx`

**Step 1: Create AppShell layout component**

`gui/src/components/AppShell.tsx`:

```tsx
import { useAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom } from "../atoms/app";
import { Sidebar } from "./Sidebar";
import { TerminalPanel } from "./TerminalPanel";
import { ContextPanel } from "./ContextPanel";
import { StatusBar } from "./StatusBar";

export function AppShell() {
  const [sidebarOpen] = useAtom(sidebarOpenAtom);
  const [contextOpen] = useAtom(contextPanelOpenAtom);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        <Sidebar collapsed={!sidebarOpen} />
        <main className="flex-1 min-w-0">
          <TerminalPanel />
        </main>
        {contextOpen && <ContextPanel />}
      </div>
      <StatusBar />
    </div>
  );
}
```

**Step 2: Create stub Sidebar**

`gui/src/components/Sidebar.tsx`:

```tsx
import { CaretLeft, Plus, Gear, Question, Moon } from "@phosphor-icons/react";

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  return (
    <nav
      className="flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200"
      style={{ width: collapsed ? 56 : 240 }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="p-3 flex items-center gap-2 border-b border-[var(--border)]">
        <span className="text-[var(--accent)] font-bold text-sm tracking-tight">
          {collapsed ? "AB" : "Agent to Bricks"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-4">
          <p className="text-[11px] tracking-widest uppercase text-[var(--fg-muted)] px-2 mb-1">
            {!collapsed && "Tools"}
          </p>
          {/* Tool list renders here */}
        </div>

        <div className="mb-4">
          <p className="text-[11px] tracking-widest uppercase text-[var(--fg-muted)] px-2 mb-1">
            {!collapsed && "Sessions"}
          </p>
          {/* Session list renders here */}
        </div>
      </div>

      <div className="p-2 border-t border-[var(--border)] flex flex-col gap-1">
        <button className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-[var(--fg-muted)] hover:bg-[var(--border)] transition-colors">
          <Gear size={18} />
          {!collapsed && "Settings"}
        </button>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-[var(--fg-muted)] hover:bg-[var(--border)] transition-colors">
          <Question size={18} />
          {!collapsed && "Help"}
        </button>
      </div>
    </nav>
  );
}
```

**Step 3: Create stub TerminalPanel**

`gui/src/components/TerminalPanel.tsx`:

```tsx
export function TerminalPanel() {
  return (
    <div
      className="h-full w-full bg-[var(--terminal)]"
      role="region"
      aria-label="Terminal"
    >
      <div className="flex items-center justify-center h-full text-[var(--fg-muted)] font-mono text-sm">
        Select a tool to start a session
      </div>
    </div>
  );
}
```

**Step 4: Create stub ContextPanel**

`gui/src/components/ContextPanel.tsx`:

```tsx
export function ContextPanel() {
  return (
    <aside
      className="w-[320px] border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto"
      role="complementary"
      aria-label="Context panel"
    >
      <div className="p-4">
        <h2 className="text-[15px] font-semibold tracking-tight mb-3">
          Welcome
        </h2>
        <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">
          Select a tool from the sidebar to get started, or add a new coding
          tool.
        </p>
      </div>
    </aside>
  );
}
```

**Step 5: Create stub StatusBar**

`gui/src/components/StatusBar.tsx`:

```tsx
export function StatusBar() {
  return (
    <footer className="h-7 border-t border-[var(--border)] bg-[var(--surface)] flex items-center px-3 gap-3 text-[12px] font-mono text-[var(--fg-muted)]">
      <span>No active session</span>
    </footer>
  );
}
```

**Step 6: Create Jotai atoms**

`gui/src/atoms/app.ts`:

```typescript
import { atom } from "jotai";

export const sidebarOpenAtom = atom(true);
export const contextPanelOpenAtom = atom(true);
export const themeAtom = atom<"light" | "dark">("dark");
export const onboardingCompleteAtom = atom(false);
```

**Step 7: Update App.tsx**

```tsx
import { Provider } from "jotai";
import { AppShell } from "./components/AppShell";

export default function App() {
  return (
    <Provider>
      <AppShell />
    </Provider>
  );
}
```

**Step 8: Run dev to verify layout renders**

```bash
cd gui && npm run tauri dev
```

Expected: Three-panel layout visible -- sidebar on left, dark terminal area center, context panel right, status bar bottom.

**Step 9: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add three-panel app shell layout with Bricks design tokens"
```

---

## Phase 3: Terminal Integration

### Task 7: Wire xterm.js to PTY

**Files:**
- Create: `gui/src/components/Terminal.tsx`
- Create: `gui/src/hooks/usePty.ts`
- Modify: `gui/src/components/TerminalPanel.tsx`

**Step 1: Create the usePty hook**

`gui/src/hooks/usePty.ts`:

If using `tauri-plugin-pty`:

```typescript
import { useEffect, useRef, useCallback } from "react";
import { spawn } from "tauri-pty";
import type { Terminal } from "@xterm/xterm";

interface PtyHandle {
  write: (data: string) => void;
  kill: () => void;
}

export function usePty(
  terminal: Terminal | null,
  command: string | null,
  args: string[] = []
) {
  const ptyRef = useRef<PtyHandle | null>(null);

  useEffect(() => {
    if (!terminal || !command) return;

    const pty = spawn(command, args, {
      cols: terminal.cols,
      rows: terminal.rows,
    });

    pty.onData((data: string) => terminal.write(data));
    terminal.onData((data: string) => pty.write(data));
    terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      pty.resize(cols, rows);
    });

    ptyRef.current = pty;

    return () => {
      pty.kill();
      ptyRef.current = null;
    };
  }, [terminal, command, args]);

  const write = useCallback((data: string) => {
    ptyRef.current?.write(data);
  }, []);

  return { write };
}
```

If using manual PTY (Task 3b fallback):

```typescript
import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Terminal } from "@xterm/xterm";

export function usePty(
  terminal: Terminal | null,
  sessionId: string | null,
  command: string | null,
  args: string[] = []
) {
  const activeRef = useRef(false);

  useEffect(() => {
    if (!terminal || !sessionId || !command) return;
    activeRef.current = true;

    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    async function start() {
      // Listen for PTY output
      unlistenOutput = await listen<string>(
        `pty:output:${sessionId}`,
        (event) => {
          if (activeRef.current) terminal!.write(event.payload);
        }
      );

      unlistenExit = await listen(`pty:exit:${sessionId}`, () => {
        if (activeRef.current) {
          terminal!.writeln("\r\n\x1B[31mSession ended\x1B[0m");
        }
      });

      // Spawn PTY
      await invoke("pty_spawn", {
        sessionId,
        command,
        args,
        cols: terminal!.cols,
        rows: terminal!.rows,
      });

      // Forward terminal input to PTY
      terminal!.onData((data: string) => {
        invoke("pty_write", { sessionId, data });
      });
    }

    start();

    return () => {
      activeRef.current = false;
      unlistenOutput?.();
      unlistenExit?.();
    };
  }, [terminal, sessionId, command, args]);

  const write = useCallback(
    (data: string) => {
      if (sessionId) invoke("pty_write", { sessionId, data });
    },
    [sessionId]
  );

  return { write };
}
```

**Step 2: Create Terminal component**

`gui/src/components/Terminal.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  onTerminalReady: (terminal: XTerm) => void;
}

export function Terminal({ onTerminalReady }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new XTerm({
      fontFamily: '"Geist Mono", "JetBrains Mono", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      theme: {
        background: "oklch(0.10 0.005 265)",
        foreground: "oklch(0.90 0.005 85)",
        cursor: "oklch(0.82 0.16 85)",
        selectionBackground: "rgba(255, 193, 7, 0.2)",
      },
      cursorBlink: true,
      cursorStyle: "bar",
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Try WebGL renderer, fall back to canvas
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // WebGL not available, canvas fallback is fine
    }

    fitAddon.fit();
    fitRef.current = fitAddon;
    termRef.current = term;

    onTerminalReady(term);

    // Resize observer
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [onTerminalReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

**Step 3: Update TerminalPanel to use Terminal + PTY**

`gui/src/components/TerminalPanel.tsx`:

```tsx
import { useState, useCallback } from "react";
import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { Terminal } from "./Terminal";
import { usePty } from "../hooks/usePty";
import type { Terminal as XTerm } from "@xterm/xterm";

export function TerminalPanel() {
  const [activeSession] = useAtom(activeSessionAtom);
  const [terminal, setTerminal] = useState<XTerm | null>(null);

  const handleTerminalReady = useCallback((term: XTerm) => {
    setTerminal(term);
    term.focus();
  }, []);

  // Connect PTY when there's an active session
  usePty(
    terminal,
    activeSession?.id ?? null,
    activeSession?.command ?? null,
    activeSession?.args ?? []
  );

  if (!activeSession) {
    return (
      <div
        className="h-full w-full bg-[var(--terminal)] flex items-center justify-center"
        role="region"
        aria-label="Terminal"
      >
        <p className="text-[var(--fg-muted)] font-mono text-sm">
          Select a tool to start a session
        </p>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full bg-[var(--terminal)]"
      role="region"
      aria-label="Terminal"
    >
      <Terminal onTerminalReady={handleTerminalReady} />
    </div>
  );
}
```

**Step 4: Create session atoms**

`gui/src/atoms/sessions.ts`:

```typescript
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";

export interface Session {
  id: string;
  toolSlug: string;
  command: string;
  args: string[];
  status: "running" | "ended";
  startedAt: number;
  endedAt?: number;
}

export const sessionsAtom = atom<Session[]>([]);
export const activeSessionIdAtom = atom<string | null>(null);

export const activeSessionAtom = atom((get) => {
  const id = get(activeSessionIdAtom);
  if (!id) return null;
  return get(sessionsAtom).find((s) => s.id === id) ?? null;
});

export const sessionAtomFamily = atomFamily((id: string) =>
  atom((get) => get(sessionsAtom).find((s) => s.id === id) ?? null)
);
```

**Step 5: Run dev and verify terminal renders**

```bash
cd gui && npm run tauri dev
```

Expected: Dark terminal area visible. If you manually trigger a session (via browser console or temporary button), the xterm.js terminal should appear and connect to a shell.

**Step 6: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): wire xterm.js terminal to PTY backend"
```

---

## Phase 4: Tool Management

### Task 8: Create tool registry and detection

**Files:**
- Create: `gui/src/atoms/tools.ts`
- Create: `gui/src-tauri/src/tools.rs` (if using manual PTY)
- Modify: `gui/src-tauri/src/lib.rs`

**Step 1: Create tool atoms**

`gui/src/atoms/tools.ts`:

```typescript
import { atom } from "jotai";

export interface Tool {
  slug: string;
  name: string;
  command: string;
  args: string[];
  icon: string;
  installed: boolean;
  version: string | null;
  configPath: string | null;
  installInstructions: {
    npm?: string;
    brew?: string;
    url?: string;
  };
}

export const DEFAULT_TOOLS: Omit<Tool, "installed" | "version">[] = [
  {
    slug: "claude-code",
    name: "Claude Code",
    command: "claude",
    args: [],
    icon: "C>",
    configPath: "~/.claude/settings.json",
    installInstructions: {
      npm: "npm install -g @anthropic-ai/claude-code",
    },
  },
  {
    slug: "codex",
    name: "Codex",
    command: "codex",
    args: [],
    icon: "Cx",
    configPath: "~/.config/codex/config.yaml",
    installInstructions: {
      npm: "npm install -g @openai/codex",
    },
  },
  {
    slug: "opencode",
    name: "OpenCode",
    command: "opencode",
    args: [],
    icon: "Oc",
    configPath: "~/.config/opencode/config.json",
    installInstructions: {
      url: "https://github.com/opencode-ai/opencode",
    },
  },
];

export const toolsAtom = atom<Tool[]>([]);
export const activeToolSlugAtom = atom<string | null>(null);

export const activeToolAtom = atom((get) => {
  const slug = get(activeToolSlugAtom);
  if (!slug) return null;
  return get(toolsAtom).find((t) => t.slug === slug) ?? null;
});
```

**Step 2: Add Rust tool detection command**

Add to `gui/src-tauri/src/lib.rs`:

```rust
#[derive(serde::Serialize)]
struct ToolDetection {
    command: String,
    installed: bool,
    version: Option<String>,
    path: Option<String>,
}

#[tauri::command]
async fn detect_tool(command: String) -> ToolDetection {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    let path = std::process::Command::new(which_cmd)
        .arg(&command)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        });

    let version = if path.is_some() {
        std::process::Command::new(&command)
            .arg("--version")
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            })
    } else {
        None
    };

    ToolDetection {
        command,
        installed: path.is_some(),
        version,
        path,
    }
}
```

Register in the invoke handler:
```rust
.invoke_handler(tauri::generate_handler![pty_spawn, pty_write, detect_tool])
```

**Step 3: Create useToolDetection hook**

`gui/src/hooks/useToolDetection.ts`:

```typescript
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { toolsAtom, DEFAULT_TOOLS, type Tool } from "../atoms/tools";

interface DetectionResult {
  command: string;
  installed: boolean;
  version: string | null;
  path: string | null;
}

export function useToolDetection() {
  const setTools = useSetAtom(toolsAtom);

  useEffect(() => {
    async function detect() {
      const results: Tool[] = await Promise.all(
        DEFAULT_TOOLS.map(async (tool) => {
          const result = await invoke<DetectionResult>("detect_tool", {
            command: tool.command,
          });
          return {
            ...tool,
            installed: result.installed,
            version: result.version,
          };
        })
      );
      setTools(results);
    }
    detect();
  }, [setTools]);
}
```

**Step 4: Commit**

```bash
git add gui/src/ gui/src-tauri/
git commit -m "feat(gui): add tool registry with CLI auto-detection"
```

---

### Task 9: Build sidebar tool list with launch capability

**Files:**
- Modify: `gui/src/components/Sidebar.tsx`
- Create: `gui/src/components/ToolItem.tsx`

**Step 1: Create ToolItem component**

`gui/src/components/ToolItem.tsx`:

```tsx
import type { Tool } from "../atoms/tools";

interface ToolItemProps {
  tool: Tool;
  active: boolean;
  collapsed: boolean;
  onLaunch: (tool: Tool) => void;
}

export function ToolItem({ tool, active, collapsed, onLaunch }: ToolItemProps) {
  const statusColor = active
    ? "bg-[var(--accent)] animate-pulse-dot"
    : tool.installed
      ? "bg-[var(--fg-muted)] opacity-40"
      : "bg-[var(--destructive)] opacity-40";

  return (
    <button
      onClick={() => onLaunch(tool)}
      className={`
        flex items-center gap-2 w-full px-2 py-1.5 rounded text-[13px]
        transition-colors duration-75
        ${active ? "bg-[var(--border)] border-l-2 border-[var(--accent)]" : "hover:bg-[var(--border)]"}
      `}
      title={collapsed ? tool.name : undefined}
    >
      <span className="relative flex items-center justify-center w-6 h-6 rounded bg-[var(--bg)] text-[10px] font-bold font-mono shrink-0">
        {tool.icon}
        <span
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${statusColor}`}
        />
      </span>
      {!collapsed && (
        <span className="truncate tracking-tight">{tool.name}</span>
      )}
    </button>
  );
}
```

**Step 2: Update Sidebar to render tools and handle launch**

Update `gui/src/components/Sidebar.tsx` to import `toolsAtom`, map over tools, render `ToolItem`, and create a session on click. The launch handler should:

1. Generate a session ID (`crypto.randomUUID()`)
2. Create a new session in `sessionsAtom`
3. Set `activeSessionIdAtom` to the new session
4. Set `activeToolSlugAtom` to the tool's slug

**Step 3: Verify launching a tool opens a terminal session**

```bash
cd gui && npm run tauri dev
```

Expected: Click "Claude Code" in sidebar -> xterm.js terminal opens -> `claude` CLI starts (if installed).

**Step 4: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add sidebar tool list with session launching"
```

---

## Phase 5: Session Management

### Task 10: Session switching and history

**Files:**
- Create: `gui/src/components/SessionItem.tsx`
- Modify: `gui/src/components/Sidebar.tsx`
- Modify: `gui/src/components/TerminalPanel.tsx`

**Step 1: Create SessionItem component**

`gui/src/components/SessionItem.tsx`:

```tsx
import type { Session } from "../atoms/sessions";

interface SessionItemProps {
  session: Session;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

export function SessionItem({
  session,
  active,
  collapsed,
  onClick,
}: SessionItemProps) {
  const elapsed = session.endedAt
    ? formatDuration(session.endedAt - session.startedAt)
    : formatDuration(Date.now() - session.startedAt);

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 w-full px-2 py-1.5 rounded text-[13px]
        transition-colors duration-75
        ${active ? "bg-[var(--border)]" : "hover:bg-[var(--border)]"}
      `}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          session.status === "running"
            ? "bg-[var(--accent)] animate-pulse-dot"
            : "bg-[var(--fg-muted)] opacity-30"
        }`}
      />
      {!collapsed && (
        <>
          <span className="truncate flex-1 text-left">
            {session.toolSlug}
          </span>
          <span className="text-[11px] text-[var(--fg-muted)] shrink-0">
            {elapsed}
          </span>
        </>
      )}
    </button>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
```

**Step 2: Wire session switching in TerminalPanel**

The key challenge: when switching sessions, we need to detach xterm.js from one PTY and reattach to another. The approach:

- Keep one xterm.js `Terminal` instance per session (stored in a `Map<string, Terminal>`)
- Show/hide terminal containers based on `activeSessionId`
- Each terminal maintains its own scrollback buffer

Update `TerminalPanel.tsx` to manage a map of terminal instances, showing the active one and hiding the rest via `display: none`.

**Step 3: Verify session switching works**

Launch two tools, click between them in the session list. Each should show its own terminal state.

**Step 4: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add session switching and history in sidebar"
```

---

## Phase 6: Context Panel

### Task 11: Context panel with welcome and tool reference

**Files:**
- Modify: `gui/src/components/ContextPanel.tsx`
- Create: `gui/src/components/context/WelcomeContent.tsx`
- Create: `gui/src/components/context/ToolReference.tsx`
- Create: `gui/src/components/context/NotInstalledContent.tsx`

**Step 1: Create WelcomeContent**

`gui/src/components/context/WelcomeContent.tsx`:

Shows quick-start cards for each detected tool. "Launch" button for installed tools, "Install" link for missing ones.

**Step 2: Create ToolReference**

`gui/src/components/context/ToolReference.tsx`:

Shows contextual help for the running tool:
- Common slash commands (e.g., `/help`, `/model`, `/compact` for Claude Code)
- Keyboard shortcuts
- Tips and tricks

This is static content per tool -- hardcoded reference data in a `toolReferences` map.

**Step 3: Create NotInstalledContent**

`gui/src/components/context/NotInstalledContent.tsx`:

Shows install instructions with copy-to-clipboard buttons. Uses `navigator.clipboard.writeText()`.

**Step 4: Update ContextPanel to switch content**

```tsx
import { useAtom } from "jotai";
import { activeSessionAtom } from "../atoms/sessions";
import { activeToolAtom } from "../atoms/tools";
import { WelcomeContent } from "./context/WelcomeContent";
import { ToolReference } from "./context/ToolReference";
import { NotInstalledContent } from "./context/NotInstalledContent";

export function ContextPanel() {
  const [session] = useAtom(activeSessionAtom);
  const [tool] = useAtom(activeToolAtom);

  let content;
  if (!tool) {
    content = <WelcomeContent />;
  } else if (!tool.installed) {
    content = <NotInstalledContent tool={tool} />;
  } else if (session?.status === "running") {
    content = <ToolReference toolSlug={tool.slug} />;
  } else {
    content = <WelcomeContent />;
  }

  return (
    <aside
      className="w-[320px] border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto"
      role="complementary"
      aria-label="Context panel"
    >
      {content}
    </aside>
  );
}
```

**Step 5: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add context panel with welcome, tool reference, install guides"
```

---

## Phase 7: Keyboard Shortcuts

### Task 12: Global keyboard shortcuts

**Files:**
- Create: `gui/src/hooks/useKeyboardShortcuts.ts`
- Modify: `gui/src/components/AppShell.tsx`

**Step 1: Create keyboard shortcut hook**

`gui/src/hooks/useKeyboardShortcuts.ts`:

```typescript
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { sidebarOpenAtom, contextPanelOpenAtom } from "../atoms/app";

export function useKeyboardShortcuts() {
  const setSidebar = useSetAtom(sidebarOpenAtom);
  const setContext = useSetAtom(contextPanelOpenAtom);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Only handle shortcuts when focus is NOT in the terminal
      const inTerminal = (e.target as HTMLElement)?.closest(".xterm");
      if (inTerminal) return;

      if (meta && e.key === "b") {
        e.preventDefault();
        setSidebar((prev) => !prev);
      }

      if (meta && e.key === "\\") {
        e.preventDefault();
        setContext((prev) => !prev);
      }

      if (e.key === "Escape") {
        // Focus the terminal
        const termEl = document.querySelector(".xterm textarea");
        if (termEl instanceof HTMLElement) termEl.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSidebar, setContext]);
}
```

**Step 2: Add hook to AppShell**

```tsx
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export function AppShell() {
  useKeyboardShortcuts();
  // ... rest of component
}
```

**Step 3: Verify shortcuts work**

- `Cmd+B` toggles sidebar
- `Cmd+\` toggles context panel
- `Escape` focuses terminal

**Step 4: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add global keyboard shortcuts (Cmd+B, Cmd+\\, Escape)"
```

---

## Phase 8: Onboarding Wizard

### Task 13: First-launch onboarding flow

**Files:**
- Create: `gui/src/components/onboarding/OnboardingWizard.tsx`
- Create: `gui/src/components/onboarding/WelcomeStep.tsx`
- Create: `gui/src/components/onboarding/DetectionStep.tsx`
- Create: `gui/src/components/onboarding/ReadyStep.tsx`
- Modify: `gui/src/components/AppShell.tsx`

**Step 1: Create WelcomeStep**

Simple centered layout with app name, description, and gold "Get Started" button.

**Step 2: Create DetectionStep**

Calls `detect_tool` for each default tool. Shows checkmark/X with version info. "Install" links for missing tools. "Continue" button.

**Step 3: Create ReadyStep**

Quick-launch cards for each configured tool. Keyboard shortcut hints. "Start" button that sets `onboardingCompleteAtom` to true and persists to SQLite.

**Step 4: Create OnboardingWizard**

```tsx
import { useState } from "react";
import { useSetAtom } from "jotai";
import { onboardingCompleteAtom } from "../../atoms/app";
import { WelcomeStep } from "./WelcomeStep";
import { DetectionStep } from "./DetectionStep";
import { ReadyStep } from "./ReadyStep";

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const setComplete = useSetAtom(onboardingCompleteAtom);

  const steps = [
    <WelcomeStep key="welcome" onNext={() => setStep(1)} />,
    <DetectionStep key="detect" onNext={() => setStep(2)} />,
    <ReadyStep
      key="ready"
      onComplete={() => setComplete(true)}
    />,
  ];

  return (
    <div className="h-full flex items-center justify-center bg-[var(--bg)]">
      {steps[step]}
    </div>
  );
}
```

**Step 5: Gate AppShell behind onboarding**

```tsx
export function AppShell() {
  const [onboardingComplete] = useAtom(onboardingCompleteAtom);

  if (!onboardingComplete) {
    return <OnboardingWizard />;
  }

  return (
    // ... existing layout
  );
}
```

**Step 6: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add first-launch onboarding wizard with tool detection"
```

---

## Phase 9: Config Management

### Task 14: Config file reader/writer in Rust

**Files:**
- Create: `gui/src-tauri/src/config.rs`
- Modify: `gui/src-tauri/src/lib.rs`

**Step 1: Add Rust commands for reading/writing config files**

`gui/src-tauri/src/config.rs`:

```rust
use std::path::PathBuf;

fn expand_tilde(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

#[tauri::command]
pub async fn read_config(path: String) -> Result<String, String> {
    let full_path = expand_tilde(&path);
    std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Could not read {}: {}", full_path.display(), e))
}

#[tauri::command]
pub async fn write_config(path: String, content: String) -> Result<(), String> {
    let full_path = expand_tilde(&path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create directory: {}", e))?;
    }
    std::fs::write(&full_path, &content)
        .map_err(|e| format!("Could not write {}: {}", full_path.display(), e))
}

#[tauri::command]
pub async fn config_exists(path: String) -> bool {
    expand_tilde(&path).exists()
}
```

Add `dirs` crate: `cargo add dirs`

Register commands in lib.rs invoke handler.

**Step 2: Commit**

```bash
git add gui/src-tauri/
git commit -m "feat(gui): add Rust config file read/write commands"
```

---

### Task 15: Config editor UI in context panel

**Files:**
- Create: `gui/src/components/context/ConfigEditor.tsx`
- Modify: `gui/src/components/ContextPanel.tsx`

**Step 1: Create ConfigEditor**

A form-based editor that:
- Reads the tool's config file via `invoke("read_config", { path })`
- Parses JSON (Claude Code) or YAML (Codex)
- Renders editable fields (API keys as masked inputs, model as dropdown, etc.)
- Writes changes back via `invoke("write_config", { path, content })`

Keep it simple for the prototype -- a textarea with syntax highlighting is acceptable as a first pass. Visual form editors can be added iteratively.

**Step 2: Wire ConfigEditor into ContextPanel**

Add a "Config" tab/button in the sidebar that switches the context panel to show `ConfigEditor` for the active tool.

**Step 3: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add config editor in context panel"
```

---

## Phase 10: Theme & Responsive

### Task 16: Dark/light theme toggle

**Files:**
- Modify: `gui/src/atoms/app.ts`
- Create: `gui/src/hooks/useTheme.ts`
- Modify: `gui/src/components/Sidebar.tsx`

**Step 1: Create useTheme hook**

```typescript
import { useEffect } from "react";
import { useAtom } from "jotai";
import { themeAtom } from "../atoms/app";

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
```

**Step 2: Wire to sidebar theme toggle button**

**Step 3: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add dark/light theme toggle"
```

---

### Task 17: Responsive sidebar collapse

**Files:**
- Modify: `gui/src/components/AppShell.tsx`

**Step 1: Add resize observer for responsive breakpoints**

```typescript
useEffect(() => {
  const observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 1200;
    if (width < 700) {
      setSidebarOpen(false);
      setContextOpen(false);
    } else if (width < 1000) {
      setContextOpen(false);
    }
  });
  observer.observe(document.documentElement);
  return () => observer.disconnect();
}, [setSidebarOpen, setContextOpen]);
```

**Step 2: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add responsive layout collapse at 700px and 1000px"
```

---

## Phase 11: Status Bar & Polish

### Task 18: Live status bar

**Files:**
- Modify: `gui/src/components/StatusBar.tsx`

**Step 1: Wire status bar to active session and tool atoms**

Show: tool name with gold dot, tool version/model (from config), session duration, MCP server count (from config). Update every second for duration.

**Step 2: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): wire status bar to active session and tool state"
```

---

### Task 19: Add Tool dialog

**Files:**
- Create: `gui/src/components/AddToolDialog.tsx`
- Modify: `gui/src/components/Sidebar.tsx`

**Step 1: Create Radix dialog with form fields**

Fields: Tool name, Launch command, Working directory (optional), Config file path (optional).

On submit: add to `toolsAtom` and persist to SQLite.

**Step 2: Wire "+" button in sidebar to open dialog**

**Step 3: Commit**

```bash
git add gui/src/
git commit -m "feat(gui): add custom tool dialog"
```

---

### Task 20: Final integration test and prototype commit

**Step 1: Run full dev build**

```bash
cd gui && npm run tauri dev
```

**Step 2: Manual test checklist**

- [ ] Onboarding wizard appears on first launch
- [ ] Tool detection shows installed/missing CLIs
- [ ] Clicking a tool launches it in xterm.js terminal
- [ ] Terminal receives input and shows output
- [ ] Session switching works between multiple tools
- [ ] Sidebar collapses/expands with Cmd+B
- [ ] Context panel toggles with Cmd+\
- [ ] Theme toggle works (dark/light)
- [ ] Status bar shows active tool info
- [ ] Add Tool dialog creates a custom tool entry
- [ ] Responsive collapse at narrow widths

**Step 3: Build release binary**

```bash
cd gui && npm run tauri build
```

**Step 4: Final commit**

```bash
git add -A gui/
git commit -m "feat(gui): complete Tauri GUI companion prototype"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Scaffold | 1-4 | Tauri + React + Vite app with all deps |
| 2: Design System | 5-6 | Bricks color tokens, three-panel layout |
| 3: Terminal | 7 | xterm.js wired to PTY backend |
| 4: Tool Management | 8-9 | Auto-detection, sidebar tool list, launch |
| 5: Sessions | 10 | Multi-session switching and history |
| 6: Context Panel | 11 | Welcome, tool reference, install guides |
| 7: Keyboard | 12 | Cmd+B, Cmd+\, Escape shortcuts |
| 8: Onboarding | 13 | First-launch wizard with detection |
| 9: Config | 14-15 | Read/write native config files from GUI |
| 10: Theme | 16-17 | Dark/light toggle, responsive collapse |
| 11: Polish | 18-20 | Status bar, add tool dialog, final test |
