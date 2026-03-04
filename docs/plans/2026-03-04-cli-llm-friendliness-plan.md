# CLI LLM-Friendliness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the CLI maximally machine-consumable with structured errors, consistent JSON output, stdin pipelines, and a self-describing schema manifest.

**Architecture:** Two new internal packages (`errors`, `output`) provide shared infrastructure. All ~18 command files migrate to use them. A static `schema.json` + CI validation prevents drift. Approach A from the design doc.

**Tech Stack:** Go 1.22+, Cobra CLI framework, standard library `encoding/json`, `text/tabwriter`

**Design doc:** `docs/plans/2026-03-04-cli-llm-friendliness-design.md`

---

### Task 1: Create `internal/errors` Package

**Files:**
- Create: `cli/internal/errors/errors.go`
- Create: `cli/internal/errors/errors_test.go`

**Step 1: Write the failing tests**

```go
// cli/internal/errors/errors_test.go
package errors

import (
	"encoding/json"
	"testing"
)

func TestCLIErrorImplementsError(t *testing.T) {
	err := ConfigError("CONFIG_MISSING_URL", "site URL not configured", "Run: bricks config init")
	if err.Error() != "site URL not configured" {
		t.Errorf("expected 'site URL not configured', got %q", err.Error())
	}
}

func TestConfigErrorExitCode(t *testing.T) {
	err := ConfigError("CONFIG_MISSING_URL", "site URL not configured", "Run: bricks config init")
	if err.Exit != 2 {
		t.Errorf("expected exit code 2, got %d", err.Exit)
	}
	if err.Code != "CONFIG_MISSING_URL" {
		t.Errorf("expected code CONFIG_MISSING_URL, got %q", err.Code)
	}
}

func TestAPIErrorExitCode(t *testing.T) {
	err := APIError("API_UNAUTHORIZED", "HTTP 401: Unauthorized")
	if err.Exit != 3 {
		t.Errorf("expected exit code 3, got %d", err.Exit)
	}
}

func TestValidationErrorExitCode(t *testing.T) {
	err := ValidationError("INVALID_PAGE_ID", "invalid page ID: abc")
	if err.Exit != 4 {
		t.Errorf("expected exit code 4, got %d", err.Exit)
	}
}

func TestConflictErrorExitCode(t *testing.T) {
	err := ConflictError("content hash mismatch")
	if err.Exit != 5 {
		t.Errorf("expected exit code 5, got %d", err.Exit)
	}
	if err.Code != "CONTENT_CONFLICT" {
		t.Errorf("expected code CONTENT_CONFLICT, got %q", err.Code)
	}
}

func TestCLIErrorJSONMarshal(t *testing.T) {
	err := ConfigError("CONFIG_NOT_FOUND", "no config file", "Run: bricks config init")
	data, jsonErr := json.Marshal(err)
	if jsonErr != nil {
		t.Fatalf("marshal failed: %v", jsonErr)
	}
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	if m["code"] != "CONFIG_NOT_FOUND" {
		t.Errorf("expected code CONFIG_NOT_FOUND in JSON, got %v", m["code"])
	}
	if m["message"] != "no config file" {
		t.Errorf("expected message in JSON, got %v", m["message"])
	}
	if m["hint"] != "Run: bricks config init" {
		t.Errorf("expected hint in JSON, got %v", m["hint"])
	}
	// Exit should NOT be in JSON (json:"-")
	if _, ok := m["exit"]; ok {
		t.Error("exit code should not appear in JSON output")
	}
}

func TestCLIErrorJSONOmitsEmptyHint(t *testing.T) {
	err := APIError("API_NOT_FOUND", "HTTP 404: not found")
	data, _ := json.Marshal(err)
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	if _, ok := m["hint"]; ok {
		t.Error("empty hint should be omitted from JSON")
	}
}

func TestFromHTTPStatus(t *testing.T) {
	tests := []struct {
		status int
		code   string
	}{
		{401, "API_UNAUTHORIZED"},
		{403, "API_FORBIDDEN"},
		{404, "API_NOT_FOUND"},
		{409, "CONTENT_CONFLICT"},
		{500, "API_SERVER_ERROR"},
		{502, "API_SERVER_ERROR"},
	}
	for _, tt := range tests {
		err := FromHTTPStatus(tt.status, "test body")
		if err.Code != tt.code {
			t.Errorf("HTTP %d: expected code %s, got %s", tt.status, tt.code, err.Code)
		}
	}
}
```

**Step 2: Run tests to verify they fail**

Run: `cd cli && go test ./internal/errors/ -v`
Expected: Compilation error — package doesn't exist yet

**Step 3: Write the implementation**

```go
// cli/internal/errors/errors.go
package errors

import "fmt"

// CLIError is a structured error with a machine-readable code and exit code.
type CLIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Hint    string `json:"hint,omitempty"`
	Exit    int    `json:"-"`
}

func (e *CLIError) Error() string {
	if e.Hint != "" {
		return fmt.Sprintf("%s. %s", e.Message, e.Hint)
	}
	return e.Message
}

func ConfigError(code, message, hint string) *CLIError {
	return &CLIError{Code: code, Message: message, Hint: hint, Exit: 2}
}

func APIError(code, message string) *CLIError {
	return &CLIError{Code: code, Message: message, Exit: 3}
}

func ValidationError(code, message string) *CLIError {
	return &CLIError{Code: code, Message: message, Exit: 4}
}

func ConflictError(message string) *CLIError {
	return &CLIError{Code: "CONTENT_CONFLICT", Message: message, Exit: 5}
}

// FromHTTPStatus maps an HTTP status code to the appropriate CLIError.
func FromHTTPStatus(status int, body string) *CLIError {
	switch status {
	case 401:
		return APIError("API_UNAUTHORIZED", fmt.Sprintf("HTTP 401: %s", body))
	case 403:
		return APIError("API_FORBIDDEN", fmt.Sprintf("HTTP 403: %s", body))
	case 404:
		return APIError("API_NOT_FOUND", fmt.Sprintf("HTTP 404: %s", body))
	case 409:
		return ConflictError(fmt.Sprintf("HTTP 409: %s", body))
	default:
		if status >= 500 {
			return APIError("API_SERVER_ERROR", fmt.Sprintf("HTTP %d: %s", status, body))
		}
		return APIError("API_ERROR", fmt.Sprintf("HTTP %d: %s", status, body))
	}
}
```

**Step 4: Run tests to verify they pass**

Run: `cd cli && go test ./internal/errors/ -v`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add cli/internal/errors/
git commit -m "feat(cli): add internal/errors package with structured CLIError type"
```

---

### Task 2: Create `internal/output` Package

**Files:**
- Create: `cli/internal/output/output.go`
- Create: `cli/internal/output/output_test.go`

**Step 1: Write the failing tests**

```go
// cli/internal/output/output_test.go
package output

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"

	clierrors "github.com/nerveband/agent-to-bricks/cli/internal/errors"
	"github.com/spf13/cobra"
)

func TestAddFormatFlags(t *testing.T) {
	cmd := &cobra.Command{Use: "test"}
	AddFormatFlags(cmd)

	f := cmd.Flags().Lookup("format")
	if f == nil {
		t.Fatal("expected --format flag to be registered")
	}
	j := cmd.Flags().Lookup("json")
	if j == nil {
		t.Fatal("expected --json flag to be registered")
	}
}

func TestResolveFormatFromJSONFlag(t *testing.T) {
	cmd := &cobra.Command{Use: "test"}
	AddFormatFlags(cmd)
	cmd.Flags().Set("json", "true")
	ResolveFormat(cmd)
	if GetFormat() != "json" {
		t.Errorf("expected format=json when --json is set, got %q", GetFormat())
	}
}

func TestResolveFormatExplicit(t *testing.T) {
	cmd := &cobra.Command{Use: "test"}
	AddFormatFlags(cmd)
	cmd.Flags().Set("format", "table")
	ResolveFormat(cmd)
	if GetFormat() != "table" {
		t.Errorf("expected format=table, got %q", GetFormat())
	}
}

func TestIsJSON(t *testing.T) {
	format = "json"
	defer func() { format = "" }()
	if !IsJSON() {
		t.Error("expected IsJSON() to return true")
	}
}

func TestJSONOutputToStdout(t *testing.T) {
	old := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	data := map[string]string{"name": "test"}
	JSON(data)

	w.Close()
	os.Stdout = old

	var buf bytes.Buffer
	buf.ReadFrom(r)

	var result map[string]string
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("output is not valid JSON: %v", err)
	}
	if result["name"] != "test" {
		t.Errorf("expected name=test, got %q", result["name"])
	}
}

func TestJSONErrorToStderr(t *testing.T) {
	old := os.Stderr
	r, w, _ := os.Pipe()
	os.Stderr = w

	cliErr := clierrors.ConfigError("CONFIG_NOT_FOUND", "no config", "Run: bricks config init")
	JSONError(cliErr)

	w.Close()
	os.Stderr = old

	var buf bytes.Buffer
	buf.ReadFrom(r)

	var result map[string]map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("error output is not valid JSON: %v\nGot: %s", err, buf.String())
	}
	errObj := result["error"]
	if errObj["code"] != "CONFIG_NOT_FOUND" {
		t.Errorf("expected error code CONFIG_NOT_FOUND, got %v", errObj["code"])
	}
}
```

**Step 2: Run tests to verify they fail**

Run: `cd cli && go test ./internal/output/ -v`
Expected: Compilation error — package doesn't exist yet

**Step 3: Write the implementation**

```go
// cli/internal/output/output.go
package output

import (
	"encoding/json"
	"os"

	clierrors "github.com/nerveband/agent-to-bricks/cli/internal/errors"
	"github.com/spf13/cobra"
)

var format string

// AddFormatFlags registers --format and --json flags on a command.
func AddFormatFlags(cmd *cobra.Command) {
	cmd.Flags().StringVar(&format, "format", "", "Output format: json, table")
	cmd.Flags().Bool("json", false, "Shorthand for --format json")
}

// ResolveFormat resolves --json alias to format=json. Call in PreRunE or at start of RunE.
func ResolveFormat(cmd *cobra.Command) {
	if j, _ := cmd.Flags().GetBool("json"); j && format == "" {
		format = "json"
	}
}

// GetFormat returns the current output format.
func GetFormat() string { return format }

// IsJSON returns true if the output format is JSON.
func IsJSON() bool { return format == "json" }

// Reset clears the format (for testing).
func Reset() { format = "" }

// JSON writes a value as indented JSON to stdout.
func JSON(v interface{}) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// JSONError writes a structured error as JSON to stderr.
func JSONError(err *clierrors.CLIError) {
	enc := json.NewEncoder(os.Stderr)
	enc.SetIndent("", "  ")
	enc.Encode(map[string]interface{}{"error": err})
}
```

**Step 4: Run tests to verify they pass**

Run: `cd cli && go test ./internal/output/ -v`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add cli/internal/output/
git commit -m "feat(cli): add internal/output package with format flags and JSON helpers"
```

---

### Task 3: Integrate Error Handler in Root Command

**Files:**
- Modify: `cli/cmd/root.go` — update `Execute()`, `requireConfig()`, imports

**Step 1: Write the failing test**

```go
// cli/internal/errors/errors_test.go — ADD this test
func TestCLIErrorUnwrap(t *testing.T) {
	var err error = ConfigError("CONFIG_MISSING_URL", "site URL not configured", "Run: bricks config init")
	var cliErr *CLIError
	if !stderrors.As(err, &cliErr) {
		t.Error("expected errors.As to find CLIError")
	}
	if cliErr.Exit != 2 {
		t.Errorf("expected exit 2, got %d", cliErr.Exit)
	}
}
```

Add `stderrors "errors"` to the test imports.

Run: `cd cli && go test ./internal/errors/ -v`
Expected: PASS (CLIError already implements error interface, errors.As works with pointer types)

**Step 2: Update `cli/cmd/root.go`**

Add imports:
```go
stderrors "errors"
clierrors "github.com/nerveband/agent-to-bricks/cli/internal/errors"
"github.com/nerveband/agent-to-bricks/cli/internal/output"
```

Replace `Execute()`:
```go
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		var cliErr *clierrors.CLIError
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

Update `requireConfig()` to return CLIErrors:
```go
func requireConfig() error {
	if cfg.Site.URL == "" {
		return clierrors.ConfigError("CONFIG_MISSING_URL", "site URL not configured", "Run: bricks config init")
	}
	if cfg.Site.APIKey == "" {
		return clierrors.ConfigError("CONFIG_MISSING_KEY", "API key not configured", "Run: bricks config set site.api_key <key>")
	}
	return nil
}
```

**Step 3: Run full test suite**

Run: `cd cli && go test ./... -count=1`
Expected: All 93+ tests PASS (no behavior change for human output)

**Step 4: Commit**

```bash
git add cli/cmd/root.go cli/internal/errors/errors_test.go
git commit -m "feat(cli): wire structured error handler into root command"
```

---

### Task 4: Convert Client HTTP Errors to CLIError

**Files:**
- Modify: `cli/internal/client/client.go` — update `doWithHeaders()` and imports

**Step 1: Update `doWithHeaders` error handling**

Add import:
```go
clierrors "github.com/nerveband/agent-to-bricks/cli/internal/errors"
```

Replace the HTTP error block in `doWithHeaders()` (currently `if resp.StatusCode >= 400`):
```go
if resp.StatusCode >= 400 {
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return nil, clierrors.FromHTTPStatus(resp.StatusCode, string(data))
}
```

**Step 2: Run full test suite**

Run: `cd cli && go test ./... -count=1`
Expected: All tests PASS. The `CLIError` implements `error`, so all existing `if err != nil` checks still work. The only change is that error values now carry structured metadata.

**Step 3: Commit**

```bash
git add cli/internal/client/client.go
git commit -m "feat(cli): convert HTTP errors to structured CLIError in client"
```

---

### Task 5: Migrate Existing `--json` Commands to Output Package

**Files:**
- Modify: `cli/cmd/classes.go`
- Modify: `cli/cmd/search.go`
- Modify: `cli/cmd/components.go`
- Modify: `cli/cmd/elements.go`
- Modify: `cli/cmd/abilities.go`
- Modify: `cli/cmd/styles.go`

**Step 1: Migrate `classes.go`**

Add import: `"github.com/nerveband/agent-to-bricks/cli/internal/output"`

In `classesListCmd.RunE`, add at top:
```go
output.ResolveFormat(cmd)
```

Replace JSON output block:
```go
// BEFORE
jsonOut, _ := cmd.Flags().GetBool("json")
if jsonOut {
	data, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Println(string(data))
	return nil
}

// AFTER
if output.IsJSON() {
	return output.JSON(resp)
}
```

In `init()`, replace the `--json` flag registration:
```go
// BEFORE
classesListCmd.Flags().Bool("json", false, "Output as JSON")

// AFTER
output.AddFormatFlags(classesListCmd)
```

Remove the `classesJSON` module-level variable if it exists, and remove `encoding/json` import if no longer used.

**Step 2: Repeat pattern for `search.go`**

Same pattern: add `output.ResolveFormat(cmd)` at top of RunE, replace `if searchJSON { enc := json.NewEncoder... }` with `if output.IsJSON() { return output.JSON(resp) }`, replace flag registration with `output.AddFormatFlags(searchElementsCmd)`, remove `searchJSON` variable.

**Step 3: Repeat for `components.go`**

Both `componentsListCmd` and `componentsShowCmd` — same migration pattern.

**Step 4: Repeat for `elements.go`**

`elemTypesCmd` — same pattern. Keep `--controls` and `--category` flags, only replace `--json`.

**Step 5: Repeat for `abilities.go`**

`abilitiesListCmd` — same pattern. Keep `--category` flag.

**Step 6: Repeat for `styles.go`**

`stylesColorsCmd`, `stylesVariablesCmd`, `stylesThemeCmd` — each has its own `--json` flag. Register `output.AddFormatFlags()` on each, replace the JSON blocks.

**Step 7: Run full test suite**

Run: `cd cli && go test ./... -count=1`
Expected: All tests PASS. Behavior is identical — we just centralized the pattern.

**Step 8: Commit**

```bash
git add cli/cmd/classes.go cli/cmd/search.go cli/cmd/components.go cli/cmd/elements.go cli/cmd/abilities.go cli/cmd/styles.go
git commit -m "refactor(cli): migrate existing --json commands to shared output package"
```

---

### Task 6: Add JSON Output to Commands That Lack It

**Files:**
- Modify: `cli/cmd/site.go` — `siteInfoCmd`
- Modify: `cli/cmd/frameworks.go` — `frameworksListCmd`, `frameworksShowCmd`
- Modify: `cli/cmd/doctor.go` — `doctorCmd`
- Modify: `cli/cmd/validate.go` — `validateCmd`
- Modify: `cli/cmd/version.go` — `versionCmd`
- Modify: `cli/cmd/media.go` — `mediaListCmd`, `mediaUploadCmd`

**Step 1: Add JSON to `site info`**

In `siteInfoCmd.RunE`:
```go
output.ResolveFormat(cmd)
// After fetching info:
if output.IsJSON() {
	return output.JSON(info)
}
// existing printf output unchanged
```

In `init()`: `output.AddFormatFlags(siteInfoCmd)`

**Step 2: Add JSON to `frameworks list` and `frameworks show`**

Same pattern. The `list` command returns a struct from `c.GetSiteFrameworks()` — marshal that. The `show` command takes a framework name argument — marshal the matching framework data.

In `init()`: `output.AddFormatFlags(frameworksListCmd)` and `output.AddFormatFlags(frameworksShowCmd)`

**Step 3: Add JSON to `doctor`**

After `doctor.Check()` returns the report:
```go
output.ResolveFormat(cmd)
if output.IsJSON() {
	return output.JSON(report)
}
// existing printf output
```

In `init()`: `output.AddFormatFlags(doctorCmd)`

**Step 4: Add JSON to `validate`**

After validation runs:
```go
output.ResolveFormat(cmd)
if output.IsJSON() {
	return output.JSON(result)
}
// existing printf output
```

In `init()`: `output.AddFormatFlags(validateCmd)`

**Step 5: Add JSON to `version`**

Create a struct for version info:
```go
if output.IsJSON() {
	return output.JSON(map[string]string{
		"cli":    cliVersion,
		"commit": cliCommit,
		"date":   cliDate,
	})
}
```

In `init()`: `output.AddFormatFlags(versionCmd)`

**Step 6: Add JSON to `media list` and `media upload`**

`media list`: marshal the response from `c.ListMedia()`.
`media upload`: marshal the upload response.

In `init()`: `output.AddFormatFlags(mediaListCmd)` and `output.AddFormatFlags(mediaUploadCmd)`

**Step 7: Run full test suite**

Run: `cd cli && go test ./... -count=1`
Expected: All tests PASS

**Step 8: Commit**

```bash
git add cli/cmd/site.go cli/cmd/frameworks.go cli/cmd/doctor.go cli/cmd/validate.go cli/cmd/version.go cli/cmd/media.go
git commit -m "feat(cli): add --format json support to all remaining commands"
```

---

### Task 7: Expand stdin Support

**Files:**
- Modify: `cli/cmd/site.go` — `sitePushCmd`, `sitePatchCmd`
- Modify: `cli/cmd/classes.go` — `classesCreateCmd`

**Step 1: Add stdin to `site push`**

Currently requires `<page-id> <file.json>` — two positional args. Change to:
- If 2 args: read file (existing behavior)
- If 1 arg (just page-id): read from stdin

```go
// In sitePushCmd.RunE, replace file reading:
var rawJSON []byte
if len(args) >= 2 {
	rawJSON, err = os.ReadFile(args[1])
} else {
	rawJSON, err = io.ReadAll(os.Stdin)
}
```

Update `Args:` from `cobra.ExactArgs(2)` to `cobra.RangeArgs(1, 2)`.

Add `"io"` to imports.

**Step 2: Add stdin to `site patch`**

Currently requires `--file` flag. Change to:
- If `--file` set: read file (existing)
- If no `--file`: read from stdin

```go
// In sitePatchCmd.RunE:
var data []byte
if patchFile != "" {
	data, err = os.ReadFile(patchFile)
} else {
	data, err = io.ReadAll(os.Stdin)
}
```

Remove the `MarkFlagRequired("file")` call so `--file` becomes optional.

**Step 3: Add stdin to `classes create`**

Currently uses `--name` and `--settings` flags. Add ability to pipe a full JSON class definition:

```go
// In classesCreateCmd.RunE, add at top:
if name == "" {
	// Try reading JSON from stdin
	data, err := io.ReadAll(os.Stdin)
	if err != nil {
		return clierrors.ValidationError("INVALID_INPUT", "failed to read from stdin")
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return clierrors.ValidationError("INVALID_JSON", "invalid JSON input")
	}
	// Extract name and settings from payload
	if n, ok := payload["name"].(string); ok {
		name = n
	}
	if s, ok := payload["settings"]; ok {
		settings = s // marshal back for the API call
	}
}
```

**Step 4: Run full test suite**

Run: `cd cli && go test ./... -count=1`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add cli/cmd/site.go cli/cmd/classes.go
git commit -m "feat(cli): add stdin support to site push, site patch, classes create"
```

---

### Task 8: Create Static `schema.json` and `bricks schema` Command

**Files:**
- Create: `cli/schema.json`
- Create: `cli/cmd/schema.go`
- Create: `cli/cmd/schema_test.go`

**Step 1: Write the schema.json**

Build the complete manifest by hand based on all commands discovered in the audit. This is the source of truth. It must include every command, every flag, stdin support, output formats, and at least one example per command. Also include the full error code catalog.

The schema must match the format approved in the design doc. Read each command file to extract exact flags, args, and descriptions. Use `bricks --help` and subcommand help to verify.

Structure:
```json
{
  "name": "bricks",
  "version": "<read from VERSION file>",
  "description": "Agent to Bricks — AI-powered Bricks Builder CLI",
  "commands": {
    "<parent> <sub>": {
      "description": "<Short from cobra>",
      "args": ["<name>"],
      "flags": {
        "--flag": {"type": "<bool|string|int>", "default": "<value>", "description": "<help text>"}
      },
      "stdin": <true|false>,
      "output": ["json", "table"],
      "example": "<one-liner>"
    }
  },
  "errorCodes": {
    "CONFIG_NOT_FOUND": {"exit": 2, "description": "..."},
    ...all codes from internal/errors
  }
}
```

**Step 2: Write the failing test**

```go
// cli/cmd/schema_test.go
package cmd

import (
	"encoding/json"
	"os"
	"testing"
)

func TestSchemaFileIsValidJSON(t *testing.T) {
	data, err := os.ReadFile("../schema.json")
	if err != nil {
		t.Fatalf("failed to read schema.json: %v", err)
	}
	var schema map[string]interface{}
	if err := json.Unmarshal(data, &schema); err != nil {
		t.Fatalf("schema.json is not valid JSON: %v", err)
	}
	if schema["name"] != "bricks" {
		t.Errorf("expected name=bricks, got %v", schema["name"])
	}
	commands, ok := schema["commands"].(map[string]interface{})
	if !ok {
		t.Fatal("expected commands to be an object")
	}
	// Verify a few known commands exist
	for _, cmd := range []string{"site push", "convert html", "agent context", "classes list"} {
		if _, ok := commands[cmd]; !ok {
			t.Errorf("expected command %q in schema", cmd)
		}
	}
	// Verify error codes exist
	if _, ok := schema["errorCodes"]; !ok {
		t.Error("expected errorCodes in schema")
	}
}
```

Run: `cd cli && go test ./cmd/ -run TestSchema -v`
Expected: FAIL — schema.json doesn't exist yet

**Step 3: Create `schema.json`**

Write the complete file based on audit findings. Read each cmd file for exact flags/args. This is a large file (~50 commands) but straightforward.

**Step 4: Run schema test**

Run: `cd cli && go test ./cmd/ -run TestSchema -v`
Expected: PASS

**Step 5: Write `schema.go` command**

```go
// cli/cmd/schema.go
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

var schemaValidate bool

var schemaCmd = &cobra.Command{
	Use:   "schema",
	Short: "Output or validate the CLI schema manifest",
	Long: `Outputs the CLI capability manifest as JSON.

LLMs and tools can use this to discover all available commands,
flags, input/output formats, and error codes without parsing --help text.

Use --validate to check that schema.json matches the live command tree.`,
	Example: `  bricks schema                # Print full CLI manifest
  bricks schema --validate     # Verify schema.json is in sync (used in CI)`,
	RunE: func(cmd *cobra.Command, args []string) error {
		schemaPath := findSchemaPath()
		if schemaValidate {
			return validateSchema(schemaPath)
		}
		data, err := os.ReadFile(schemaPath)
		if err != nil {
			return fmt.Errorf("failed to read schema.json: %w", err)
		}
		fmt.Print(string(data))
		return nil
	},
}

func findSchemaPath() string {
	// Look for schema.json relative to the binary or working directory
	candidates := []string{
		"schema.json",
		"cli/schema.json",
	}
	// Also check relative to the source file (for go test)
	if _, filename, _, ok := runtime.Caller(0); ok {
		candidates = append(candidates, filepath.Join(filepath.Dir(filename), "..", "schema.json"))
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "schema.json"
}

func validateSchema(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", path, err)
	}
	var schema struct {
		Commands map[string]struct {
			Description string `json:"description"`
		} `json:"commands"`
	}
	if err := json.Unmarshal(data, &schema); err != nil {
		return fmt.Errorf("invalid JSON in %s: %w", path, err)
	}

	// Walk the live Cobra command tree
	liveCommands := map[string]bool{}
	walkCommands(rootCmd, "", liveCommands)

	// Compare
	var missing, extra []string
	for name := range liveCommands {
		if _, ok := schema.Commands[name]; !ok {
			missing = append(missing, name)
		}
	}
	for name := range schema.Commands {
		if !liveCommands[name] {
			extra = append(extra, name)
		}
	}

	sort.Strings(missing)
	sort.Strings(extra)

	if len(missing) > 0 || len(extra) > 0 {
		msg := "schema.json is out of sync:\n"
		for _, m := range missing {
			msg += fmt.Sprintf("  missing from schema: %s\n", m)
		}
		for _, e := range extra {
			msg += fmt.Sprintf("  extra in schema (not in CLI): %s\n", e)
		}
		return fmt.Errorf("%s", msg)
	}

	fmt.Println("schema.json is in sync with the CLI command tree.")
	return nil
}

func walkCommands(cmd *cobra.Command, prefix string, result map[string]bool) {
	for _, sub := range cmd.Commands() {
		if sub.Hidden || !sub.IsAvailableCommand() {
			continue
		}
		name := strings.TrimSpace(prefix + " " + sub.Name())
		if sub.HasSubCommands() {
			walkCommands(sub, name, result)
		} else {
			result[name] = true
		}
	}
}

func init() {
	schemaCmd.Flags().BoolVar(&schemaValidate, "validate", false, "Validate schema.json against live command tree")
	rootCmd.AddCommand(schemaCmd)
}
```

**Step 6: Run full test suite**

Run: `cd cli && go test ./... -count=1`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add cli/schema.json cli/cmd/schema.go cli/cmd/schema_test.go
git commit -m "feat(cli): add static schema.json manifest and bricks schema command"
```

---

### Task 9: Add Help Text Examples to Sparse Commands

**Files:**
- Modify: `cli/cmd/media.go` — add Example to `mediaUploadCmd`, `mediaListCmd`
- Modify: `cli/cmd/classes.go` — add Example to `classesCreateCmd`
- Modify: `cli/cmd/site.go` — add Example to `sitePatchCmd`, `sitePushCmd`
- Modify: `cli/cmd/styles.go` — add Example to `stylesLearnCmd`
- Modify: `cli/cmd/config.go` — add Example to `configSetCmd`

**Step 1: Add examples**

For each command, add an `Example:` field to the cobra.Command struct. Format:

```go
Example: `  bricks media upload hero.jpg
  bricks media upload ./assets/banner.png`,
```

Commands and their examples:
- `media upload`: `bricks media upload hero.jpg`
- `media list`: `bricks media list --search "hero"`
- `classes create`: `bricks classes create --name "btn--cta" --settings '{"backgroundColor":"var(--primary)"}'` and `echo '{"name":"btn--cta","settings":{...}}' | bricks classes create`
- `site patch`: `bricks site patch 1234 --file fixes.json` and `echo '[{"op":"replace",...}]' | bricks site patch 1234`
- `site push`: `bricks site push 1234 layout.json --snapshot` and `cat layout.json | bricks site push 1234`
- `styles learn`: `bricks styles learn`
- `config set`: `bricks config set site.url https://example.com` and `bricks config set site.api_key atb_xxx`

**Step 2: Run `go build` to verify syntax**

Run: `cd cli && go build ./...`
Expected: Compiles clean

**Step 3: Commit**

```bash
git add cli/cmd/media.go cli/cmd/classes.go cli/cmd/site.go cli/cmd/styles.go cli/cmd/config.go
git commit -m "docs(cli): add help text examples to all sparse commands"
```

---

### Task 10: Update Prompts and CI

**Files:**
- Modify: `prompts/check.md`
- Modify: `prompts/release.md`
- Modify: `.github/workflows/ci.yml` (if it exists — add `bricks schema --validate` step)

**Step 1: Update `prompts/check.md`**

After step 3 (`make lint`), add:

```markdown
4. Run `cd cli && go run . schema --validate` to verify schema.json is in sync with commands
```

Renumber subsequent steps.

In the "Docs & content audit" section, add:
```markdown
- For any new CLI commands or flags: verify they appear in `cli/schema.json`
- For any error handling changes: verify structured error codes are used (not bare `fmt.Errorf` in commands)
```

**Step 2: Update `prompts/release.md`**

After build checks, add:

```markdown
4. Run `cd cli && go run . schema --validate` to verify schema.json is in sync
```

In the "Docs & content sync" section, add:
```markdown
- If CLI commands or flags changed: update `cli/schema.json` and commit
- Verify `cli/schema.json` version matches `VERSION` file
```

**Step 3: Add CI step (if `.github/workflows/ci.yml` exists)**

Check if the CI workflow exists. If so, add a step to the CLI test job:

```yaml
- name: Validate CLI schema
  run: cd cli && go run . schema --validate
```

**Step 4: Run prompts through a quick review**

Read both updated prompts to make sure numbering is correct and steps flow logically.

**Step 5: Commit**

```bash
git add prompts/check.md prompts/release.md .github/workflows/ci.yml
git commit -m "chore: add schema validation to check/release prompts and CI"
```

---

### Task 11: Add `llms.txt` to Website

**Files:**
- Create: `website/public/llms.txt`

**Step 1: Create `llms.txt`**

This file is served at `https://agenttobricks.com/llms.txt` and tells LLMs what Agent to Bricks is and how to use it. It follows the emerging llms.txt convention — plain text, structured for LLM consumption.

```text
# Agent to Bricks

> AI-powered CLI and WordPress plugin for building Bricks Builder pages programmatically.

## What This Tool Does

Agent to Bricks lets AI agents (Claude, GPT, etc.) create and manage Bricks Builder pages on WordPress sites. It converts HTML to Bricks JSON, manages global CSS classes, handles templates, and supports the WordPress Abilities API.

## CLI Quick Start

Install: download from https://github.com/nerveband/agent-to-bricks/releases
Configure: `bricks config init` (sets site URL + API key)
Discover capabilities: `bricks schema` (outputs full JSON manifest of all commands)
Get site context for LLM: `bricks agent context --format json`

## Key Commands

- `bricks agent context --format json` — Structured site context for LLM consumption
- `bricks agent context --format prompt` — Complete LLM system prompt with design rules
- `bricks convert html --stdin --push <page-id>` — Pipe HTML, get Bricks JSON, push to page
- `bricks site pull <page-id>` — Pull page elements as JSON
- `bricks site push <page-id> <file.json>` — Push elements to page (accepts stdin)
- `bricks classes list --format json` — List all global CSS classes
- `bricks abilities list --format json` — Discover WordPress Abilities with JSON schemas
- `bricks schema` — Full CLI capability manifest as JSON

## Machine-Readable Interfaces

- CLI schema manifest: `bricks schema` (JSON with all commands, flags, types, error codes)
- Structured errors: Use `--format json` on any command for machine-parseable error responses
- All commands support `--format json` for structured output
- stdin support on: `convert html`, `site push`, `site patch`, `classes create`

## Authentication

Uses `X-ATB-Key` custom header. API key stored in `~/.agent-to-bricks/config.yaml`.

## Documentation

- Full docs: https://agenttobricks.com
- CLI reference: https://agenttobricks.com/cli/
- REST API: https://agenttobricks.com/plugin/rest-api/
- GitHub: https://github.com/nerveband/agent-to-bricks
```

**Step 2: Verify the file will be served**

Astro/Starlight serves files from `public/` at the site root. Verify by checking the Astro config or existing public files.

Run: `ls website/public/`
Expected: See existing static files (favicon, etc.)

**Step 3: Build the website to verify**

Run: `cd website && npm run build`
Expected: Build succeeds. Check `dist/llms.txt` exists.

**Step 4: Commit**

```bash
git add website/public/llms.txt
git commit -m "feat(website): add llms.txt for LLM discoverability"
```

---

### Task 12: Final Verification

**Depends on:** All previous tasks complete.

**Step 1: Run the full test suite**

Run: `cd cli && go test ./... -count=1 -v`
Expected: All tests PASS (original 93 + new tests for errors, output, schema)

**Step 2: Build the CLI**

Run: `cd cli && go build -o bricks .`
Expected: Compiles clean

**Step 3: Manual smoke tests**

```bash
# Test structured error (no config)
cd /tmp && ./bricks site info --format json 2>&1
# Expected: JSON error on stderr with CONFIG_MISSING_URL code

# Test JSON output
./bricks version --format json
# Expected: {"cli":"...","commit":"...","date":"..."}

# Test schema
./bricks schema | head -20
# Expected: JSON manifest

# Test schema validation
./bricks schema --validate
# Expected: "schema.json is in sync with the CLI command tree."

# Test stdin (if staging available)
echo '[]' | ./bricks site push 1234
# Expected: reads from stdin
```

**Step 4: Run schema validation**

Run: `cd cli && go run . schema --validate`
Expected: PASS — schema matches live commands

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(cli): address issues found in final verification"
```

---

## Summary

| Task | What | Files | Est. Size |
|------|------|-------|-----------|
| 1 | `internal/errors` package | 2 new files | ~100 lines |
| 2 | `internal/output` package | 2 new files | ~60 lines |
| 3 | Root command integration | 1 modified | ~20 lines changed |
| 4 | Client HTTP error conversion | 1 modified | ~10 lines changed |
| 5 | Migrate existing --json commands | 6 modified | ~15 lines each |
| 6 | Add JSON to new commands | 6 modified | ~10 lines each |
| 7 | Expand stdin | 3 modified | ~15 lines each |
| 8 | schema.json + schema command | 3 new files | ~300 lines (schema.json) + ~100 lines (Go) |
| 9 | Help text examples | 5 modified | ~5 lines each |
| 10 | Prompts + CI | 2-3 modified | ~20 lines total |
| 11 | llms.txt on website | 1 new file | ~40 lines |
| 12 | Final verification | 0 files | Smoke tests only |

**Total: ~12 commits, ~21 files touched, ~750 lines of new code**
