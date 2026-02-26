# GUI — Agent to Bricks Desktop App

Tauri 2 desktop app with React 19 + TypeScript frontend. Manages AI coding tool sessions.

## Build & Test

```bash
cd gui && npm install             # install dependencies
cd gui && npm run build           # TypeScript type-check + Vite build
cd gui && npm run tauri dev       # development mode
cd gui && npm run tauri build     # production build
```

## Key Paths

- Tauri backend: `src-tauri/src/lib.rs` (commands, HTTP client)
- Config I/O: `src-tauri/src/config.rs`
- React app: `src/App.tsx` → `src/components/AppShell.tsx`
- State: `src/atoms/` (Jotai atoms)
- Hooks: `src/hooks/` (tool detection, PTY, config persistence)
- Tauri config: `src-tauri/tauri.conf.json`

## Pre-Completion Checklist (MANDATORY)

Before completing ANY change in this component:

- [ ] `cd gui && npm run build` passes (TypeScript type-check)
- [ ] `make check-version` passes (from project root)
- [ ] If GUI feature changed → update `website/src/content/docs/gui/` relevant page
- [ ] If API calls changed → verify they match plugin REST endpoints
- [ ] If config read/write changed → verify CLI config compatibility
- [ ] If Tauri config changed → verify `src-tauri/capabilities/default.json` has needed permissions

## Impact Map

- `src-tauri/src/lib.rs` API calls → Must match plugin REST endpoints
- `src-tauri/src/config.rs` → Shared config format with CLI
- `src/atoms/tools.ts` → Tool detection (CLI binary name: `bricks`)
- `src-tauri/tauri.conf.json` → Version must match `/VERSION`, updater endpoint
- `package.json` → Version must match `/VERSION`
- `src-tauri/Cargo.toml` → Version must match `/VERSION`
