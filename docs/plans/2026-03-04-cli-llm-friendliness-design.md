# CLI LLM-Friendliness Improvements — Design Doc

**Date:** 2026-03-04
**Status:** Approved
**Approach:** Shared infrastructure (internal/errors + internal/output packages)

## Context

The CLI is the primary interface for LLM agents working with Bricks Builder via the WordPress plugin. An audit scored the CLI 8.3/10 for LLM-friendliness. The `agent context` command is exemplary, but six gaps limit programmatic error recovery, discoverability, and pipeline workflows.

This design addresses those gaps while also ensuring the Plugin-CLI contract stays in sync via a static schema validated in CI.

## Architecture

```
LLM --> CLI --> Plugin (WordPress)
         ^
        GUI (wrapper)
```

The CLI can only do what the Plugin supports. The Plugin-CLI boundary is the critical contract. The GUI wraps both and inherits improvements made here.

---

## 1. Error System (`cli/internal/errors/`)

### Error Type

```go
type CLIError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Hint    string `json:"hint,omitempty"`
    Exit    int    `json:"-"`
}

func (e *CLIError) Error() string { return e.Message }
```

### Error Code Taxonomy

| Exit Code | Category | Codes |
|-----------|----------|-------|
| 2 | Config | `CONFIG_NOT_FOUND`, `CONFIG_INVALID`, `CONFIG_MISSING_URL`, `CONFIG_MISSING_KEY` |
| 3 | Network/API | `API_UNREACHABLE`, `API_UNAUTHORIZED`, `API_FORBIDDEN`, `API_NOT_FOUND`, `API_SERVER_ERROR` |
| 4 | Validation | `INVALID_INPUT`, `INVALID_PAGE_ID`, `INVALID_JSON`, `INVALID_HTML` |
| 5 | Conflict | `CONTENT_CONFLICT` |
| 1 | General | `UNKNOWN_ERROR` |

### Constructor Helpers

```go
func ConfigError(code, message, hint string) *CLIError
func APIError(code, message string) *CLIError
func ValidationError(code, message string) *CLIError
func ConflictError(message string) *CLIError
```

### Behavior

- **Default (human):** Cobra prints `Error: <message>` as today. Exit code is from `CLIError.Exit`.
- **With `--format json`:** Error is rendered as JSON to stderr:
  ```json
  {"error": {"code": "CONFIG_NOT_FOUND", "message": "site URL not configured", "hint": "Run: bricks config init"}}
  ```

### Root Command Integration

```go
func Execute() {
    if err := rootCmd.Execute(); err != nil {
        var cliErr *errors.CLIError
        if stderrors.As(err, &cliErr) {
            if output.IsJSON() {
                output.JSONError(cliErr)
            }
            os.Exit(cliErr.Exit)
        }
        os.Exit(1)
    }
}
```

---

## 2. Output System (`cli/internal/output/`)

### Format Flag Registration

```go
func AddFormatFlags(cmd *cobra.Command)  // adds --format and --json alias
func ResolveFormat(cmd *cobra.Command)    // resolves --json to format=json
func IsJSON() bool
func Format() string
```

All commands that produce output call `output.AddFormatFlags(cmd)` in init.

### JSON Output Helper

```go
func JSON(v interface{}) error  // 2-space indented JSON to stdout
func JSONError(err *errors.CLIError)  // JSON error to stderr
```

### Migration Pattern

```go
// BEFORE
if classesJSON {
    data, _ := json.MarshalIndent(resp, "", "  ")
    fmt.Println(string(data))
}

// AFTER
if output.IsJSON() {
    return output.JSON(resp)
}
```

### Commands Gaining JSON Output

These commands currently have no JSON option and will gain `--format json`:
- `site info`
- `frameworks list`, `frameworks show`
- `styles show`
- `validate`
- `doctor`
- `version`

### `agent context` Exception

The `agent context` command keeps its own `--format md|json|prompt` with richer semantics. It does NOT use the shared `output.AddFormatFlags`. However, structured JSON errors still apply to it via the root error handler.

---

## 3. CLI Schema (`cli/schema.json` + `bricks schema` command)

### Static Manifest

A committed `cli/schema.json` file serves as the canonical CLI capability manifest. LLMs read this to discover commands without parsing `--help`.

```json
{
  "name": "bricks",
  "version": "1.8.0",
  "commands": {
    "site push": {
      "description": "Push elements from JSON file (full replace)",
      "args": ["page-id", "file.json"],
      "flags": {
        "--snapshot": {"type": "bool", "default": "false", "description": "Create backup snapshot first"}
      },
      "stdin": false,
      "output": ["json"],
      "example": "bricks site push 1234 layout.json --snapshot"
    }
  },
  "errorCodes": {
    "CONFIG_NOT_FOUND": {"exit": 2, "description": "No config file found"},
    "API_UNAUTHORIZED": {"exit": 3, "description": "Invalid or missing API key"}
  }
}
```

### `bricks schema` Command

- `bricks schema` — prints `schema.json` contents to stdout
- `bricks schema --validate` — walks the live Cobra command tree and compares against `schema.json`. Exits non-zero if they differ. Used in CI.

### CI Enforcement

CI runs `bricks schema --validate`. If a command or flag is added/changed without updating `schema.json`, the build fails. This is the ShipTypes principle applied to the CLI: the schema is the contract, CI enforces it.

---

## 4. Expanded stdin Support

### Commands Gaining stdin

| Command | Current Input | stdin Behavior |
|---------|--------------|----------------|
| `classes create` | `--name` + `--settings` flags | Accept JSON object from stdin (full class definition) |
| `site patch` | `--file` flag | If no `--file`, read patches from stdin |
| `site push` | positional `file.json` | If no file arg, read from stdin |

### Pattern

Same as `convert.go`:

```go
if len(args) == 0 {
    data, err = io.ReadAll(os.Stdin)
} else {
    data, err = os.ReadFile(args[0])
}
```

### `templates compose` — No Change

Input is template names (strings), not structured data. stdin doesn't apply.

---

## 5. Help Text Improvements

Add `Example:` fields to commands that lack them:

- `media upload` — `bricks media upload hero.jpg`
- `classes create` — `bricks classes create --name "btn--cta" --settings '{"backgroundColor":"var(--primary)"}'`
- `site patch` — `bricks site patch 1234 --file fixes.json` and `echo '[...]' | bricks site patch 1234`
- `styles learn` — `bricks styles learn`

---

## 6. Prompt Updates

### `prompts/check.md` — Add

After build checks:
- Run `bricks schema --validate` to verify schema.json is in sync
- For CLI changes: verify error codes are used (not bare `fmt.Errorf`) and `--format` flag is registered

### `prompts/release.md` — Add

After build checks:
- Run `bricks schema --validate`
- If commands/flags changed: update `cli/schema.json` and commit
- Verify `schema.json` version matches `VERSION` file

---

## What We're NOT Doing

- **OpenAPI spec for Plugin REST API** — deferred to a separate effort. High value but independent of CLI-side improvements.
- **MCP server mode** — premature, no user demand yet.
- **Generated Go client from OpenAPI** — hand-written client is clean, validate rather than generate.
- **`llms.txt`** — LLM users hit the CLI, not the website.

## Testing

- Existing 93 Go tests catch regressions in command behavior
- New unit tests for `internal/errors` (error construction, JSON marshaling)
- New unit tests for `internal/output` (format resolution, JSON rendering)
- New test for `bricks schema --validate` (catches drift)
- Update existing command tests to verify `--format json` output shape

## Success Criteria

- All commands support `--format json|table` (except `agent context` which keeps its own format)
- All errors return structured JSON when `--format json` is active
- Exit codes differentiate error categories (2-5)
- `bricks schema` outputs a complete, accurate CLI manifest
- `bricks schema --validate` passes in CI
- stdin works for `classes create`, `site patch`, `site push`
- All commands have at least one help text example
