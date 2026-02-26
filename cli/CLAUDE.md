# CLI — Agent to Bricks

Go CLI (`bricks`) for Bricks Builder page management. Uses Cobra for commands, Bubbletea for TUI.

## Build & Test

```bash
cd cli && go test ./...           # run all tests
cd cli && go vet ./...            # lint
make build                        # build binary → bin/bricks
make install                      # install to /usr/local/bin
```

## Key Paths

- Entry point: `main.go` (version injected via ldflags)
- Commands: `cmd/` (one file per command)
- API client: `internal/client/client.go`
- Self-updater: `internal/updater/`
- Config: `internal/config/config.go`

## Pre-Completion Checklist (MANDATORY)

Before completing ANY change in this component:

- [ ] `cd cli && go test ./...` passes
- [ ] `cd cli && go vet ./...` passes
- [ ] `make check-version` passes (from project root)
- [ ] If CLI command/flag changed → update `website/src/content/docs/cli/` relevant page
- [ ] If API client changed → verify GUI still compiles (`cd gui && npm run build`)
- [ ] If config format changed → update `website/src/content/docs/getting-started/configuration.md`
- [ ] If user-facing output changed → update README if affected

## Impact Map

- `cmd/*.go` → CLI docs (website), README examples
- `internal/client/client.go` → Must match plugin REST endpoints
- `internal/config/config.go` → Shared with GUI (`gui/src-tauri/src/config.rs`)
- `internal/updater/` → GitHub Release asset naming conventions
