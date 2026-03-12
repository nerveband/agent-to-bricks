# Agent-Native Workflow Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the bricks CLI around three agent activity layers with progressive disclosure, class-aware JSON mutations, compound commands, and TDD against live staging — raising the Agent DX CLI Scale score from 9/21 to 16/21.

**Architecture:** Three layers (Site Navigation, Page Content, Site-Wide Operations) with a shared class resolution pipeline. Every CLI surface embeds guidance breadcrumbs via enhanced error hints, success next_steps, and "When to use" help text. New commands wrap existing REST endpoints — no plugin changes needed.

**Tech Stack:** Go 1.22+, Cobra CLI framework, httptest for unit tests, live staging (ts-staging.wavedepth.com page 1338) for integration tests, bash for agent simulation tests.

**Spec:** `docs/superpowers/specs/2026-03-12-agent-native-workflow-engine-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `cli/internal/classresolver/resolver.go` | Class resolution pipeline: ACSS → Frames → Global → Auto-create. Single `Resolve()` method takes human-readable names, returns IDs. |
| `cli/internal/classresolver/resolver_test.go` | Unit tests with fixture data |
| `cli/internal/classresolver/warnings.go` | Inline-to-class suggestion engine: detects `_padding`, `_gap`, etc. and suggests ACSS equivalents |
| `cli/internal/classresolver/warnings_test.go` | Warning detection tests |
| `cli/cmd/pages.go` | `pages list` command |
| `cli/cmd/pages_test.go` | Unit tests for pages list |
| `cli/cmd/abilities_run.go` | `abilities run` command |
| `cli/cmd/abilities_run_test.go` | Unit tests |
| `cli/testdata/acss-classes.json` | Fixture: ACSS class registry from staging |
| `cli/testdata/homepage-elements.json` | Fixture: page 13 elements |
| `cli/testdata/test-page-elements.json` | Fixture: page 1338 elements |
| `cli/tests/agent_simulation_test.sh` | End-to-end bash tests |

### Modified Files

| File | Changes |
|------|---------|
| `cli/internal/errors/errors.go` | Add `SeeAlso`, `NextSteps` fields; add 428 handler; add hints to 401/403/404/409 |
| `cli/internal/client/client.go` | Add `ListPages()`, `RunAbility()`, `BatchOperations()`; change `AppendElements()` signature to add `insertAfter` |
| `cli/cmd/site.go` | Add `site find`, `site delete`, `site append`, `site batch`; add `--set`/`--set-class`/`--content-hash` to `site patch` |
| `cli/cmd/convert.go` | Add `--append` and `--after` flags |
| `cli/internal/agent/context.go` | Rewrite `RenderPrompt()` and `writeWorkflowsSection()`; add `writeClassRulesSection()`, `writeElementReferenceSection()` |
| `cli/cmd/root.go` | Add agent context hint to root help text |
| `cli/schema.json` | Add new commands, `workflows` key, new error codes |
| `cli/cmd/schema.go` | Validate `workflows` key |
| `website/public/llms.txt` | Update with new commands and "first command" guidance |

---

## Chunk 1: Foundation

### Task 1: Extract Test Fixtures from Staging

**Files:**
- Create: `cli/testdata/acss-classes.json`
- Create: `cli/testdata/homepage-elements.json`
- Create: `cli/testdata/test-page-elements.json`

These fixtures are used by all subsequent unit tests. Extract once, use everywhere.

- [ ] **Step 1: Create testdata directory**

```bash
mkdir -p cli/testdata
```

- [ ] **Step 2: Extract ACSS class registry**

```bash
cd cli && go run . classes list --framework acss --json > testdata/acss-classes.json
```

Verify: file should contain `{"classes": [...], "count": N}` with 2700+ entries.

- [ ] **Step 3: Extract homepage elements**

```bash
cd cli && go run . site pull 13 -o testdata/homepage-elements.json
```

Verify: file contains `{"elements": [...], "contentHash": "...", "count": N}`.

- [ ] **Step 4: Extract test page elements**

```bash
cd cli && go run . site pull 1338 -o testdata/test-page-elements.json
```

- [ ] **Step 5: Commit fixtures**

```bash
git add cli/testdata/
git commit -m "test: extract staging fixtures for agent workflow engine"
```

---

### Task 2: Enhance Error System

**Files:**
- Modify: `cli/internal/errors/errors.go`
- Create: `cli/internal/errors/errors_test.go`

- [ ] **Step 1: Write failing test for new CLIError fields**

Create `cli/internal/errors/errors_test.go`:

```go
package errors

import (
	"encoding/json"
	"testing"
)

func TestCLIError_JSONIncludesSeeAlso(t *testing.T) {
	e := &CLIError{
		Code:    "TEST",
		Message: "test error",
		Hint:    "try this",
		SeeAlso: "bricks site pull 42",
		Exit:    3,
	}
	data, _ := json.Marshal(e)
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	if m["see_also"] != "bricks site pull 42" {
		t.Errorf("expected see_also in JSON, got %v", m)
	}
}

func TestCLIError_JSONIncludesNextSteps(t *testing.T) {
	e := &CLIError{
		Code:      "TEST",
		Message:   "test error",
		NextSteps: []string{"bricks site find 42", "bricks site patch 42 --element <id>"},
		Exit:      3,
	}
	data, _ := json.Marshal(e)
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	steps, ok := m["next_steps"].([]interface{})
	if !ok || len(steps) != 2 {
		t.Errorf("expected next_steps array with 2 items, got %v", m)
	}
}

func TestFromHTTPStatus_428(t *testing.T) {
	e := FromHTTPStatus(428, "content hash required")
	if e.Code != "MISSING_CONTENT_HASH" {
		t.Errorf("expected MISSING_CONTENT_HASH, got %s", e.Code)
	}
	if e.Exit != 6 {
		t.Errorf("expected exit 6, got %d", e.Exit)
	}
	if e.Hint == "" {
		t.Error("expected hint for 428 error")
	}
}

func TestFromHTTPStatus_401_HasHint(t *testing.T) {
	e := FromHTTPStatus(401, "unauthorized")
	if e.Hint == "" {
		t.Error("expected hint for 401 error")
	}
}

func TestFromHTTPStatus_403_HasHint(t *testing.T) {
	e := FromHTTPStatus(403, "forbidden")
	if e.Hint == "" {
		t.Error("expected hint for 403 error")
	}
}

func TestFromHTTPStatus_404_HasHint(t *testing.T) {
	e := FromHTTPStatus(404, "not found")
	if e.Hint == "" {
		t.Error("expected hint for 404 error")
	}
}

func TestFromHTTPStatus_409_HasHint(t *testing.T) {
	e := FromHTTPStatus(409, "conflict")
	if e.Hint == "" {
		t.Error("expected hint for 409 error")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./internal/errors/ -v
```

Expected: FAIL — `SeeAlso` and `NextSteps` fields don't exist, 428 not handled.

- [ ] **Step 3: Implement enhanced CLIError**

Modify `cli/internal/errors/errors.go`:

```go
package errors

import "fmt"

// CLIError is a structured error with a machine-readable code and exit code.
type CLIError struct {
	Code      string   `json:"code"`
	Message   string   `json:"message"`
	Hint      string   `json:"hint,omitempty"`
	SeeAlso   string   `json:"see_also,omitempty"`
	NextSteps []string `json:"next_steps,omitempty"`
	Exit      int      `json:"-"`
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
		return &CLIError{
			Code:    "API_UNAUTHORIZED",
			Message: fmt.Sprintf("HTTP 401: %s", body),
			Hint:    "Check your API key. Run: bricks config list",
			SeeAlso: "bricks config init",
			Exit:    3,
		}
	case 403:
		return &CLIError{
			Code:    "API_FORBIDDEN",
			Message: fmt.Sprintf("HTTP 403: %s", body),
			Hint:    "API key may lack permissions. Run: bricks config list",
			SeeAlso: "bricks config init",
			Exit:    3,
		}
	case 404:
		return &CLIError{
			Code:    "API_NOT_FOUND",
			Message: fmt.Sprintf("HTTP 404: %s", body),
			Hint:    "Resource not found. Check page ID or endpoint.",
			SeeAlso: "bricks pages list",
			Exit:    3,
		}
	case 409:
		return &CLIError{
			Code:    "CONTENT_CONFLICT",
			Message: fmt.Sprintf("HTTP 409: %s", body),
			Hint:    "Page was modified since last pull. Re-pull to get current contentHash.",
			SeeAlso: "bricks site pull <page-id>",
			Exit:    5,
		}
	case 428:
		return &CLIError{
			Code:    "MISSING_CONTENT_HASH",
			Message: fmt.Sprintf("HTTP 428: %s", body),
			Hint:    "Content hash required. Run: bricks site pull <page-id>  # to get the current contentHash",
			SeeAlso: "bricks site pull <page-id>",
			Exit:    6,
		}
	default:
		if status >= 500 {
			return APIError("API_SERVER_ERROR", fmt.Sprintf("HTTP %d: %s", status, body))
		}
		return APIError("API_ERROR", fmt.Sprintf("HTTP %d: %s", status, body))
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cli && go test ./internal/errors/ -v
```

Expected: PASS

- [ ] **Step 5: Run full test suite to check no regressions**

```bash
cd cli && go test ./... 2>&1 | tail -20
```

Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add cli/internal/errors/
git commit -m "feat: enhance CLIError with SeeAlso, NextSteps, and 428 handling"
```

---

### Task 3: Class Resolution Pipeline

**Files:**
- Create: `cli/internal/classresolver/resolver.go`
- Create: `cli/internal/classresolver/resolver_test.go`
- Create: `cli/internal/classresolver/warnings.go`
- Create: `cli/internal/classresolver/warnings_test.go`

This is the core of the agent DX improvement. The resolver takes human-readable class names and returns Bricks global class IDs.

- [ ] **Step 1: Write failing resolver tests**

Create `cli/internal/classresolver/resolver_test.go`:

```go
package classresolver

import (
	"testing"
)

func TestResolve_ACSSSPrefix(t *testing.T) {
	r := NewResolver()
	r.AddClass("acss_import_gap--m", "gap--m", "acss")
	r.AddClass("acss_import_padding--xl", "padding--xl", "acss")

	results := r.Resolve([]string{"gap--m"})
	if results[0].ID != "acss_import_gap--m" {
		t.Errorf("expected acss_import_gap--m, got %s", results[0].ID)
	}
	if results[0].Source != "acss" {
		t.Errorf("expected source acss, got %s", results[0].Source)
	}
}

func TestResolve_Passthrough(t *testing.T) {
	r := NewResolver()
	r.AddClass("acss_import_gap--m", "gap--m", "acss")

	results := r.Resolve([]string{"acss_import_gap--m"})
	if results[0].ID != "acss_import_gap--m" {
		t.Errorf("expected passthrough, got %s", results[0].ID)
	}
	if results[0].Source != "passthrough" {
		t.Errorf("expected source passthrough, got %s", results[0].Source)
	}
}

func TestResolve_FramesClass(t *testing.T) {
	r := NewResolver()
	r.AddClass("frames_fr-card", "fr-card", "frames")

	results := r.Resolve([]string{"fr-card"})
	if results[0].ID != "frames_fr-card" {
		t.Errorf("expected frames_fr-card, got %s", results[0].ID)
	}
}

func TestResolve_ExactGlobalMatch(t *testing.T) {
	r := NewResolver()
	r.AddClass("custom_btn-primary", "btn-primary", "custom")

	results := r.Resolve([]string{"btn-primary"})
	if results[0].ID != "custom_btn-primary" {
		t.Errorf("expected custom_btn-primary, got %s", results[0].ID)
	}
	if results[0].Source != "global" {
		t.Errorf("expected source global, got %s", results[0].Source)
	}
}

func TestResolve_Unresolved(t *testing.T) {
	r := NewResolver()

	results := r.Resolve([]string{"nonexistent-class"})
	if results[0].ID != "" {
		t.Errorf("expected empty ID for unresolved, got %s", results[0].ID)
	}
	if results[0].Source != "unresolved" {
		t.Errorf("expected source unresolved, got %s", results[0].Source)
	}
}

func TestResolve_MixedInput(t *testing.T) {
	r := NewResolver()
	r.AddClass("acss_import_gap--m", "gap--m", "acss")
	r.AddClass("frames_fr-card", "fr-card", "frames")

	results := r.Resolve([]string{"gap--m", "fr-card", "byzuqt", "unknown"})
	if len(results) != 4 {
		t.Fatalf("expected 4 results, got %d", len(results))
	}
	if results[0].Source != "acss" {
		t.Errorf("gap--m: expected acss, got %s", results[0].Source)
	}
	if results[1].Source != "frames" {
		t.Errorf("fr-card: expected frames, got %s", results[1].Source)
	}
	if results[2].Source != "passthrough" {
		t.Errorf("byzuqt: expected passthrough, got %s", results[2].Source)
	}
	if results[3].Source != "unresolved" {
		t.Errorf("unknown: expected unresolved, got %s", results[3].Source)
	}
}

func TestResolve_AlreadyID_LooksLikeRandomID(t *testing.T) {
	r := NewResolver()
	// 6-char alphanumeric strings are Bricks element/class IDs
	results := r.Resolve([]string{"xottyu"})
	if results[0].Source != "passthrough" {
		t.Errorf("expected passthrough for ID-like string, got %s", results[0].Source)
	}
}

func TestBuildFromAPIResponse(t *testing.T) {
	classes := []map[string]interface{}{
		{"id": "acss_import_gap--m", "name": "gap--m", "source": "acss"},
		{"id": "frames_fr-card", "name": "fr-card", "source": "frames"},
		{"id": "custom_hero", "name": "hero", "source": "custom"},
	}
	r := BuildFromAPIResponse(classes)

	results := r.Resolve([]string{"gap--m", "fr-card", "hero"})
	if results[0].ID != "acss_import_gap--m" {
		t.Errorf("expected acss_import_gap--m, got %s", results[0].ID)
	}
	if results[1].ID != "frames_fr-card" {
		t.Errorf("expected frames_fr-card, got %s", results[1].ID)
	}
	if results[2].ID != "custom_hero" {
		t.Errorf("expected custom_hero, got %s", results[2].ID)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./internal/classresolver/ -v
```

Expected: FAIL — package does not exist.

- [ ] **Step 3: Implement resolver**

Create `cli/internal/classresolver/resolver.go`:

```go
package classresolver

import (
	"regexp"
	"strings"
)

// ResolvedClass is the result of resolving a single class name.
type ResolvedClass struct {
	Input  string // Original input (e.g., "gap--m")
	ID     string // Resolved Bricks class ID (e.g., "acss_import_gap--m")
	Source string // Resolution source: "acss", "frames", "global", "passthrough", "unresolved"
}

// Resolver resolves human-readable class names to Bricks global class IDs.
type Resolver struct {
	byID    map[string]bool   // known IDs (for passthrough detection)
	acss    map[string]string // name → ID (ACSS classes, checked first)
	frames  map[string]string // name → ID (Frames classes, checked second)
	globals map[string]string // name → ID (other global classes, checked third)
}

var bricksIDPattern = regexp.MustCompile(`^[a-z0-9]{5,8}$`)

// NewResolver creates an empty resolver. Call AddClass to populate.
func NewResolver() *Resolver {
	return &Resolver{
		byID:    make(map[string]bool),
		acss:    make(map[string]string),
		frames:  make(map[string]string),
		globals: make(map[string]string),
	}
}

// AddClass adds a class to the resolver registry.
func (r *Resolver) AddClass(id, name, source string) {
	r.byID[id] = true

	switch {
	case source == "acss" || strings.HasPrefix(id, "acss_import_"):
		r.acss[name] = id
	case source == "frames" || strings.HasPrefix(id, "frames_") || strings.HasPrefix(name, "fr-"):
		r.frames[name] = id
	default:
		r.globals[name] = id
	}
}

// Resolve takes a slice of class names/IDs and returns resolved entries.
// Resolution cascade: passthrough (already an ID) → ACSS → Frames → Global → unresolved.
func (r *Resolver) Resolve(classes []string) []ResolvedClass {
	results := make([]ResolvedClass, len(classes))
	for i, input := range classes {
		results[i] = r.resolveOne(input)
	}
	return results
}

func (r *Resolver) resolveOne(input string) ResolvedClass {
	// 1. Already a known ID? Passthrough.
	if r.byID[input] {
		return ResolvedClass{Input: input, ID: input, Source: "passthrough"}
	}

	// 2. Looks like a Bricks-generated ID (5-8 char alphanumeric)? Passthrough.
	if bricksIDPattern.MatchString(input) {
		return ResolvedClass{Input: input, ID: input, Source: "passthrough"}
	}

	// 3. ACSS lookup (highest priority)
	if id, ok := r.acss[input]; ok {
		return ResolvedClass{Input: input, ID: id, Source: "acss"}
	}

	// 4. Frames lookup
	if id, ok := r.frames[input]; ok {
		return ResolvedClass{Input: input, ID: id, Source: "frames"}
	}

	// 5. Other global class lookup
	if id, ok := r.globals[input]; ok {
		return ResolvedClass{Input: input, ID: id, Source: "global"}
	}

	// 6. Unresolved
	return ResolvedClass{Input: input, ID: "", Source: "unresolved"}
}

// ResolveToIDs is a convenience method that returns just the resolved IDs.
// Unresolved classes are returned as-is (the original input string).
func (r *Resolver) ResolveToIDs(classes []string) []string {
	results := r.Resolve(classes)
	ids := make([]string, len(results))
	for i, res := range results {
		if res.ID != "" {
			ids[i] = res.ID
		} else {
			ids[i] = res.Input // passthrough unresolved
		}
	}
	return ids
}

// BuildFromAPIResponse creates a Resolver from the classes API response.
func BuildFromAPIResponse(classes []map[string]interface{}) *Resolver {
	r := NewResolver()
	for _, c := range classes {
		id, _ := c["id"].(string)
		name, _ := c["name"].(string)
		source, _ := c["source"].(string)
		if id != "" && name != "" {
			r.AddClass(id, name, source)
		}
	}
	return r
}
```

- [ ] **Step 4: Run resolver tests**

```bash
cd cli && go test ./internal/classresolver/ -v -run TestResolve
```

Expected: PASS

- [ ] **Step 5: Write failing warnings tests**

Create `cli/internal/classresolver/warnings_test.go`:

```go
package classresolver

import (
	"testing"
)

func TestCheckInlineStyles_Padding(t *testing.T) {
	settings := map[string]interface{}{
		"_padding": map[string]interface{}{"top": "50px"},
	}
	warnings := CheckInlineStyles("elem1", settings)
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}
	if warnings[0].Setting != "_padding" {
		t.Errorf("expected _padding, got %s", warnings[0].Setting)
	}
}

func TestCheckInlineStyles_Gap(t *testing.T) {
	settings := map[string]interface{}{
		"_gap": "20px",
	}
	warnings := CheckInlineStyles("elem1", settings)
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}
}

func TestCheckInlineStyles_GridTemplateColumns(t *testing.T) {
	settings := map[string]interface{}{
		"_gridTemplateColumns": "1fr 1fr 1fr",
	}
	warnings := CheckInlineStyles("elem1", settings)
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}
	if warnings[0].Suggestion == "" {
		t.Error("expected suggestion")
	}
}

func TestCheckInlineStyles_NoWarningForNonInline(t *testing.T) {
	settings := map[string]interface{}{
		"text":  "Hello",
		"tag":   "h2",
		"label": "My heading",
	}
	warnings := CheckInlineStyles("elem1", settings)
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings, got %d", len(warnings))
	}
}

func TestCheckInlineStyles_MultipleWarnings(t *testing.T) {
	settings := map[string]interface{}{
		"_padding":             map[string]interface{}{"top": "20px"},
		"_gap":                 "10px",
		"_gridTemplateColumns": "1fr 1fr",
	}
	warnings := CheckInlineStyles("elem1", settings)
	if len(warnings) != 3 {
		t.Errorf("expected 3 warnings, got %d", len(warnings))
	}
}
```

- [ ] **Step 6: Implement warnings**

Create `cli/internal/classresolver/warnings.go`:

```go
package classresolver

import "fmt"

// InlineStyleWarning is a non-fatal warning about an inline style that has an ACSS equivalent.
type InlineStyleWarning struct {
	ElementID  string `json:"element"`
	Issue      string `json:"issue"`      // Always "inline_style"
	Setting    string `json:"setting"`    // The inline setting name (e.g., "_padding")
	Message    string `json:"message"`
	Suggestion string `json:"suggestion"`
}

// inlineToClass maps inline style settings to ACSS class suggestions.
// This is a bootstrap table; runtime enrichment happens via the class registry.
var inlineToClass = map[string]string{
	"_padding":             "padding--{xs|s|m|l|xl|xxl}",
	"_gap":                 "gap--{xs|s|m|l|xl|xxl}",
	"_gridTemplateColumns": "grid--auto-{2|3|4|5|6}",
	"_borderRadius":        "radius--{s|m|l}",
}

// gridColumnSuggestions maps specific grid patterns to class names.
var gridColumnSuggestions = map[string]string{
	"1fr 1fr":             "grid--auto-2",
	"1fr 1fr 1fr":         "grid--auto-3",
	"1fr 1fr 1fr 1fr":     "grid--auto-4",
	"1fr 1fr 1fr 1fr 1fr": "grid--auto-5",
}

// CheckInlineStyles checks element settings for inline styles that have ACSS equivalents.
func CheckInlineStyles(elementID string, settings map[string]interface{}) []InlineStyleWarning {
	var warnings []InlineStyleWarning

	for setting, suggestion := range inlineToClass {
		if val, ok := settings[setting]; ok && val != nil {
			w := InlineStyleWarning{
				ElementID: elementID,
				Issue:     "inline_style",
				Setting:   setting,
				Message:   fmt.Sprintf("%s has ACSS equivalent", setting),
			}

			// Try to give a specific suggestion for grid columns
			if setting == "_gridTemplateColumns" {
				if strVal, ok := val.(string); ok {
					if className, found := gridColumnSuggestions[strVal]; found {
						w.Suggestion = fmt.Sprintf("Use _cssGlobalClasses: [\"%s\"] instead of %s: \"%s\"", className, setting, strVal)
					} else {
						w.Suggestion = fmt.Sprintf("Use _cssGlobalClasses: [\"%s\"] instead of %s", suggestion, setting)
					}
				}
			} else {
				w.Suggestion = fmt.Sprintf("Use _cssGlobalClasses: [\"%s\"] instead of %s", suggestion, setting)
			}

			warnings = append(warnings, w)
		}
	}

	return warnings
}

// CheckElementsForWarnings checks a batch of elements for inline style warnings.
func CheckElementsForWarnings(elements []map[string]interface{}) []InlineStyleWarning {
	var all []InlineStyleWarning
	for _, elem := range elements {
		id, _ := elem["id"].(string)
		settings, _ := elem["settings"].(map[string]interface{})
		if settings == nil {
			// Settings might be at top level for some element formats
			settings = elem
		}
		warnings := CheckInlineStyles(id, settings)
		all = append(all, warnings...)
	}
	return all
}
```

- [ ] **Step 7: Run all classresolver tests**

```bash
cd cli && go test ./internal/classresolver/ -v
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add cli/internal/classresolver/
git commit -m "feat: add class resolution pipeline and inline style warnings"
```

---

### Task 4: `pages list` Command + Client Method

**Files:**
- Modify: `cli/internal/client/client.go` (add `ListPages()`)
- Create: `cli/cmd/pages.go`
- Create: `cli/cmd/pages_test.go`

- [ ] **Step 1: Write failing test for ListPages client method**

Add to `cli/cmd/pages_test.go`:

```go
package cmd

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/config"
	"github.com/nerveband/agent-to-bricks/internal/output"
)

func TestPagesListCmd_JSONOutput(t *testing.T) {
	// Plugin returns bare array
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		// Plugin returns a bare array, not wrapped
		json.NewEncoder(w).Encode([]map[string]interface{}{
			{"id": 13, "title": "Homepage", "slug": "home", "status": "publish"},
			{"id": 42, "title": "About", "slug": "about", "status": "publish"},
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}
	output.Reset()
	defer output.Reset()
	_ = pagesListCmd.Flags().Set("format", "json")
	defer pagesListCmd.Flags().Set("format", "")

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := pagesListCmd.RunE(pagesListCmd, []string{})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("failed to parse JSON: %v\noutput: %s", err, buf.String())
	}

	pages, ok := result["pages"].([]interface{})
	if !ok || len(pages) != 2 {
		t.Fatalf("expected 2 pages, got %v", result)
	}
	count, ok := result["count"].(float64)
	if !ok || count != 2 {
		t.Fatalf("expected count=2, got %v", result["count"])
	}
}

func TestPagesListCmd_SearchFilter(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		search := r.URL.Query().Get("search")
		if search != "home" {
			t.Fatalf("expected search=home, got %s", search)
		}
		json.NewEncoder(w).Encode([]map[string]interface{}{
			{"id": 13, "title": "Homepage", "slug": "home", "status": "publish"},
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}
	output.Reset()
	defer output.Reset()
	_ = pagesListCmd.Flags().Set("format", "json")
	_ = pagesListCmd.Flags().Set("search", "home")
	defer func() {
		pagesListCmd.Flags().Set("format", "")
		pagesListCmd.Flags().Set("search", "")
	}()

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := pagesListCmd.RunE(pagesListCmd, []string{})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}

	var result map[string]interface{}
	json.Unmarshal(buf.Bytes(), &result)
	count := result["count"].(float64)
	if count != 1 {
		t.Fatalf("expected count=1, got %v", count)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestPagesList -v
```

Expected: FAIL — `pagesListCmd` undefined.

- [ ] **Step 3: Add `ListPages()` to client**

In `cli/internal/client/client.go`, add after `GetElements()` (around line 163):

```go
// PagesListResponse wraps the bare array from GET /pages.
type PagesListResponse struct {
	Pages []map[string]interface{} `json:"pages"`
	Count int                      `json:"count"`
}

// ListPages returns all Bricks pages. The plugin returns a bare array;
// this method wraps it for consistency.
func (c *Client) ListPages(search string) (*PagesListResponse, error) {
	path := "/pages"
	if search != "" {
		v := url.Values{}
		v.Set("search", search)
		path += "?" + v.Encode()
	}
	resp, err := c.do("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Plugin returns bare array
	var pages []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&pages); err != nil {
		return nil, err
	}
	return &PagesListResponse{Pages: pages, Count: len(pages)}, nil
}
```

- [ ] **Step 4: Create `pages.go` command**

Create `cli/cmd/pages.go`:

```go
package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var pagesCmd = &cobra.Command{
	Use:   "pages",
	Short: "Page discovery and management",
	Long: `Find and list Bricks pages on the connected site.

When to use: Finding page IDs before any content operation.
Instead of:  Guessing page IDs or searching the WordPress admin.`,
}

var pagesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all Bricks pages",
	Long: `List all pages with Bricks content on the connected site.

When to use: Finding page IDs before pull, push, patch, or find operations.
Instead of:  Guessing page IDs.

Examples:
  bricks pages list                        # all pages
  bricks pages list --search "pricing"     # search by title
  bricks pages list --json                 # structured output`,
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		search, _ := cmd.Flags().GetString("search")
		result, err := c.ListPages(search)
		if err != nil {
			return fmt.Errorf("failed to list pages: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(result)
		}

		if len(result.Pages) == 0 {
			fmt.Fprintln(os.Stderr, "No pages found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintf(w, "ID\tTITLE\tSLUG\tSTATUS\n")
		for _, p := range result.Pages {
			id := fmt.Sprintf("%v", p["id"])
			title, _ := p["title"].(string)
			slug, _ := p["slug"].(string)
			status, _ := p["status"].(string)
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", id, title, slug, status)
		}
		w.Flush()
		fmt.Fprintf(os.Stderr, "\n%d pages\n", result.Count)
		return nil
	},
}

func init() {
	pagesListCmd.Flags().String("search", "", "search pages by title")
	output.AddFormatFlags(pagesListCmd)

	pagesCmd.AddCommand(pagesListCmd)
	rootCmd.AddCommand(pagesCmd)
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd cli && go test ./cmd/ -run TestPagesList -v
```

Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
cd cli && go test ./... 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add cli/cmd/pages.go cli/cmd/pages_test.go cli/internal/client/client.go
git commit -m "feat: add pages list command with search support"
```

---

## Chunk 2: Core Editing Commands

### Task 5: Change `AppendElements()` Signature + `site append` Command

**Files:**
- Modify: `cli/internal/client/client.go` (change `AppendElements()` signature)
- Modify: `cli/cmd/site.go` (add `site append` subcommand)
- Modify: `cli/cmd/site_test.go` (add tests)

- [ ] **Step 1: Write failing test for insertAfter support**

Add to `cli/cmd/site_test.go`:

```go
func TestSiteAppend_WithInsertAfter(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/1338/elements" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["insertAfter"] != "xottyu" {
			t.Fatalf("expected insertAfter=xottyu, got %v", body["insertAfter"])
		}
		if _, ok := body["elements"]; !ok {
			t.Fatal("expected elements in body")
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "appendhash",
			"count":       5,
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}
	output.Reset()
	defer output.Reset()
	_ = siteAppendCmd.Flags().Set("format", "json")
	_ = siteAppendCmd.Flags().Set("after", "xottyu")
	defer func() {
		siteAppendCmd.Flags().Set("format", "")
		siteAppendCmd.Flags().Set("after", "")
	}()

	tmpDir := t.TempDir()
	inputFile := filepath.Join(tmpDir, "append.json")
	data := []byte(`{"elements":[{"id":"e1","name":"heading","settings":{"text":"New"}}]}`)
	os.WriteFile(inputFile, data, 0644)

	oldAppendFile := appendFile
	appendFile = inputFile
	defer func() { appendFile = oldAppendFile }()

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := siteAppendCmd.RunE(siteAppendCmd, []string{"1338"})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}

	var result map[string]interface{}
	json.Unmarshal(buf.Bytes(), &result)
	if result["contentHash"] != "appendhash" {
		t.Fatalf("expected contentHash=appendhash, got %v", result["contentHash"])
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestSiteAppend -v
```

Expected: FAIL — `siteAppendCmd` undefined.

- [ ] **Step 3: Update `AppendElements()` signature in client.go**

Change `cli/internal/client/client.go` line 230:

```go
// AppendElements adds new elements to a page.
func (c *Client) AppendElements(pageID int, elements []map[string]interface{}, ifMatch string, insertAfter string) (*MutationResponse, error) {
	payloadMap := map[string]interface{}{"elements": elements}
	if insertAfter != "" {
		payloadMap["insertAfter"] = insertAfter
	}
	payload, _ := json.Marshal(payloadMap)
	headers := map[string]string{}
	if ifMatch != "" {
		headers["If-Match"] = ifMatch
	}
	resp, err := c.doWithHeaders("POST", fmt.Sprintf("/pages/%d/elements", pageID), strings.NewReader(string(payload)), headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result MutationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
```

**Important:** Search entire codebase for existing callers of `AppendElements` and update them to add the empty `insertAfter` parameter:

```bash
cd cli && grep -rn "AppendElements" --include="*.go"
```

Any existing call like `c.AppendElements(pageID, elements, ifMatch)` must become `c.AppendElements(pageID, elements, ifMatch, "")`.

- [ ] **Step 4: Add `site append` command to site.go**

Add to `cli/cmd/site.go`, before `init()`:

```go
var (
	appendFile  string
	appendAfter string
)

var siteAppendCmd = &cobra.Command{
	Use:   "append <page-id>",
	Short: "Append elements to a page",
	Long: `Append new elements to an existing page. Elements are added after all
existing content, or after a specific element if --after is specified.

When to use: Adding pre-built element JSON to a page.
Instead of:  site push (which replaces ALL content). Use convert html --append
             when creating from HTML (gets automatic class resolution).

Examples:
  echo '{"elements":[...]}' | bricks site append 42
  bricks site append 42 --file section.json --after xottyu`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return clierrors.ValidationError("INVALID_PAGE_ID", fmt.Sprintf("invalid page ID: %s", args[0]))
		}

		// Read elements from file or stdin
		var inputData []byte
		if appendFile != "" {
			inputData, err = os.ReadFile(appendFile)
		} else {
			inputData, err = io.ReadAll(os.Stdin)
		}
		if err != nil {
			return fmt.Errorf("failed to read input: %w", err)
		}

		var payload struct {
			Elements []map[string]interface{} `json:"elements"`
		}
		if err := json.Unmarshal(inputData, &payload); err != nil {
			return clierrors.ValidationError("INVALID_JSON", fmt.Sprintf("invalid JSON: %v", err))
		}

		c := newSiteClient()

		// Fetch contentHash for optimistic locking
		existing, getErr := c.GetElements(pageID)
		ifMatch := ""
		if getErr == nil {
			ifMatch = existing.ContentHash
		}

		after, _ := cmd.Flags().GetString("after")
		result, appendErr := c.AppendElements(pageID, payload.Elements, ifMatch, after)
		if appendErr != nil {
			return fmt.Errorf("append failed: %w", appendErr)
		}

		if output.IsJSON() {
			return output.JSON(result)
		}

		fmt.Printf("Appended to page %d (hash: %s, count: %d)\n",
			pageID, result.ContentHash, result.Count)
		return nil
	},
}
```

Add flag registration and command wiring in `init()`:

```go
siteAppendCmd.Flags().StringVar(&appendFile, "file", "", "JSON file with elements")
siteAppendCmd.Flags().StringVar(&appendAfter, "after", "", "element ID to insert after")
output.AddFormatFlags(siteAppendCmd)

siteCmd.AddCommand(siteAppendCmd)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd cli && go test ./cmd/ -run TestSiteAppend -v
```

Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
cd cli && go test ./... 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add cli/internal/client/client.go cli/cmd/site.go cli/cmd/site_test.go
git commit -m "feat: add site append command with insertAfter support"
```

---

### Task 6: `site find` Command

**Files:**
- Modify: `cli/cmd/site.go` (add `site find` subcommand)
- Modify: `cli/cmd/site_test.go` (add tests)

- [ ] **Step 1: Write failing test**

Add to `cli/cmd/site_test.go`:

```go
func TestSiteFind_ByType(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elements": []map[string]interface{}{
				{"id": "abc123", "name": "heading", "parent": "0", "children": []string{}, "settings": map[string]interface{}{"text": "Hello", "tag": "h1"}, "label": "Title"},
				{"id": "def456", "name": "section", "parent": "0", "children": []string{"abc123"}, "settings": map[string]interface{}{}, "label": "Hero"},
				{"id": "ghi789", "name": "heading", "parent": "def456", "children": []string{}, "settings": map[string]interface{}{"text": "World", "tag": "h2"}, "label": "Subtitle"},
			},
			"contentHash": "testhash",
			"count":       3,
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}
	output.Reset()
	defer output.Reset()
	_ = siteFindCmd.Flags().Set("format", "json")
	_ = siteFindCmd.Flags().Set("type", "heading")
	defer func() {
		siteFindCmd.Flags().Set("format", "")
		siteFindCmd.Flags().Set("type", "")
	}()

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := siteFindCmd.RunE(siteFindCmd, []string{"42"})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}

	var result map[string]interface{}
	json.Unmarshal(buf.Bytes(), &result)
	elements := result["elements"].([]interface{})
	if len(elements) != 2 {
		t.Fatalf("expected 2 headings, got %d", len(elements))
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestSiteFind -v
```

Expected: FAIL — `siteFindCmd` undefined.

- [ ] **Step 3: Implement `site find`**

Add to `cli/cmd/site.go`:

```go
var siteFindCmd = &cobra.Command{
	Use:   "find <page-id>",
	Short: "Find elements on a page by type, label, or text",
	Long: `Pull a page and filter elements client-side. Returns element IDs, types,
labels, text content, and parent chain.

When to use: Finding element IDs before patching, deleting, or inserting after.
Instead of:  site pull (which returns all elements without filtering).
             For site-wide search, use: bricks search elements

Examples:
  bricks site find 42 --type heading
  bricks site find 42 --label "Hero"
  bricks site find 42 --text "Knowledge" --json`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return clierrors.ValidationError("INVALID_PAGE_ID", fmt.Sprintf("invalid page ID: %s", args[0]))
		}

		c := newSiteClient()
		resp, err := c.GetElements(pageID)
		if err != nil {
			return fmt.Errorf("failed to pull page: %w", err)
		}

		filterType, _ := cmd.Flags().GetString("type")
		filterLabel, _ := cmd.Flags().GetString("label")
		filterText, _ := cmd.Flags().GetString("text")

		var matched []map[string]interface{}
		for _, elem := range resp.Elements {
			if filterType != "" {
				name, _ := elem["name"].(string)
				if name != filterType {
					continue
				}
			}
			if filterLabel != "" {
				label, _ := elem["label"].(string)
				if !strings.Contains(strings.ToLower(label), strings.ToLower(filterLabel)) {
					continue
				}
			}
			if filterText != "" {
				settings, _ := elem["settings"].(map[string]interface{})
				text, _ := settings["text"].(string)
				if !strings.Contains(strings.ToLower(text), strings.ToLower(filterText)) {
					continue
				}
			}
			matched = append(matched, elem)
		}

		if output.IsJSON() {
			result := map[string]interface{}{
				"elements":    matched,
				"count":       len(matched),
				"contentHash": resp.ContentHash,
				"next_steps": []string{
					fmt.Sprintf("bricks site patch %d --element <id> --set key=value  # edit an element", pageID),
					fmt.Sprintf("bricks site delete %d --ids <id>  # remove an element", pageID),
				},
			}
			return output.JSON(result)
		}

		if len(matched) == 0 {
			fmt.Fprintln(os.Stderr, "No matching elements found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintf(w, "ID\tTYPE\tLABEL\tTEXT\tPARENT\n")
		for _, elem := range matched {
			id, _ := elem["id"].(string)
			name, _ := elem["name"].(string)
			label, _ := elem["label"].(string)
			parent, _ := elem["parent"].(string)
			text := ""
			if settings, ok := elem["settings"].(map[string]interface{}); ok {
				text, _ = settings["text"].(string)
			}
			if parent == "0" {
				parent = "(root)"
			}
			// Truncate text for table display
			if len(text) > 30 {
				text = text[:27] + "..."
			}
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", id, name, label, text, parent)
		}
		w.Flush()
		fmt.Fprintf(os.Stderr, "\n%d elements found (contentHash: %s)\n", len(matched), resp.ContentHash)
		return nil
	},
}
```

Add flag registration in `init()`:

```go
siteFindCmd.Flags().String("type", "", "filter by element type (heading, section, etc.)")
siteFindCmd.Flags().String("label", "", "filter by element label")
siteFindCmd.Flags().String("text", "", "filter by text content")
output.AddFormatFlags(siteFindCmd)

siteCmd.AddCommand(siteFindCmd)
```

- [ ] **Step 4: Run test**

```bash
cd cli && go test ./cmd/ -run TestSiteFind -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/cmd/site.go cli/cmd/site_test.go
git commit -m "feat: add site find command for element discovery"
```

---

### Task 7: `site delete` Command

**Files:**
- Modify: `cli/cmd/site.go` (add `site delete` subcommand)
- Modify: `cli/cmd/site_test.go` (add test)

- [ ] **Step 1: Write failing test**

Add to `cli/cmd/site_test.go`:

```go
func TestSiteDelete_JSONOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"elements":    []map[string]interface{}{},
				"contentHash": "delhash",
				"count":       0,
			})
			return
		}
		if r.Method != "DELETE" {
			t.Fatalf("expected DELETE, got %s", r.Method)
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		ids := body["ids"].([]interface{})
		if len(ids) != 2 {
			t.Fatalf("expected 2 ids, got %d", len(ids))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "afterdel",
			"count":       3,
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}
	output.Reset()
	defer output.Reset()
	_ = siteDeleteCmd.Flags().Set("format", "json")
	_ = siteDeleteCmd.Flags().Set("ids", "abc123,def456")
	defer func() {
		siteDeleteCmd.Flags().Set("format", "")
		siteDeleteCmd.Flags().Set("ids", "")
	}()

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := siteDeleteCmd.RunE(siteDeleteCmd, []string{"42"})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}

	var result map[string]interface{}
	json.Unmarshal(buf.Bytes(), &result)
	if result["success"] != true {
		t.Fatalf("expected success=true, got %v", result)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestSiteDelete -v
```

- [ ] **Step 3: Implement `site delete`**

Add to `cli/cmd/site.go`:

```go
var siteDeleteCmd = &cobra.Command{
	Use:   "delete <page-id>",
	Short: "Delete elements from a page",
	Long: `Remove specific elements from a page by their IDs. Fetches the
current contentHash internally for optimistic locking.

When to use: Removing specific elements. Get IDs from: bricks site find
Instead of:  Pulling, manually editing JSON, and pushing back.

Examples:
  bricks site delete 42 --ids abc123,def456
  bricks site delete 42 --ids abc123 --json`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return clierrors.ValidationError("INVALID_PAGE_ID", fmt.Sprintf("invalid page ID: %s", args[0]))
		}

		idsStr, _ := cmd.Flags().GetString("ids")
		if idsStr == "" {
			return clierrors.ValidationError("MISSING_IDS", "specify element IDs with --ids id1,id2,...")
		}
		ids := strings.Split(idsStr, ",")
		for i := range ids {
			ids[i] = strings.TrimSpace(ids[i])
		}

		c := newSiteClient()

		// Fetch contentHash for optimistic locking
		existing, getErr := c.GetElements(pageID)
		ifMatch := ""
		if getErr == nil {
			ifMatch = existing.ContentHash
		}

		result, delErr := c.DeleteElements(pageID, ids, ifMatch)
		if delErr != nil {
			return fmt.Errorf("delete failed: %w", delErr)
		}

		if output.IsJSON() {
			return output.JSON(result)
		}

		fmt.Printf("Deleted %d elements from page %d (hash: %s)\n",
			len(ids), pageID, result.ContentHash)
		return nil
	},
}
```

Add in `init()`:

```go
siteDeleteCmd.Flags().String("ids", "", "comma-separated element IDs to delete")
output.AddFormatFlags(siteDeleteCmd)

siteCmd.AddCommand(siteDeleteCmd)
```

- [ ] **Step 4: Run test**

```bash
cd cli && go test ./cmd/ -run TestSiteDelete -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/cmd/site.go cli/cmd/site_test.go
git commit -m "feat: add site delete command"
```

---

### Task 8: `site patch` Shorthand (`--set`, `--set-class`, `--content-hash`)

**Files:**
- Modify: `cli/cmd/site.go` (add shorthand flags to `site patch`)
- Modify: `cli/cmd/site_test.go` (add tests)

- [ ] **Step 1: Write failing test for --set shorthand**

Add to `cli/cmd/site_test.go`:

```go
func TestSitePatch_SetShorthand(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"elements":    []map[string]interface{}{{"id": "abc123", "name": "heading", "settings": map[string]interface{}{"text": "Old"}}},
				"contentHash": "currenthash",
				"count":       1,
			})
			return
		}
		if r.Method != "PATCH" {
			t.Fatalf("expected PATCH, got %s", r.Method)
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		patches := body["patches"].([]interface{})
		if len(patches) != 1 {
			t.Fatalf("expected 1 patch, got %d", len(patches))
		}
		patch := patches[0].(map[string]interface{})
		if patch["id"] != "abc123" {
			t.Fatalf("expected id=abc123, got %v", patch["id"])
		}
		settings := patch["settings"].(map[string]interface{})
		if settings["text"] != "New heading" {
			t.Fatalf("expected text='New heading', got %v", settings["text"])
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "newhash",
			"count":       1,
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}
	output.Reset()
	defer output.Reset()
	_ = sitePatchCmd.Flags().Set("format", "json")
	_ = sitePatchCmd.Flags().Set("element", "abc123")
	_ = sitePatchCmd.Flags().Set("set", "text=New heading")
	defer func() {
		sitePatchCmd.Flags().Set("format", "")
		sitePatchCmd.Flags().Set("element", "")
		sitePatchCmd.Flags().Set("set", "")
	}()

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := sitePatchCmd.RunE(sitePatchCmd, []string{"42"})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}

	var result map[string]interface{}
	json.Unmarshal(buf.Bytes(), &result)
	if result["contentHash"] != "newhash" {
		t.Fatalf("expected contentHash=newhash, got %v", result["contentHash"])
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestSitePatch_Set -v
```

- [ ] **Step 3: Modify `sitePatchCmd` to support shorthand**

In `cli/cmd/site.go`, modify the existing `sitePatchCmd.RunE` to check for `--element` + `--set` before falling through to the existing JSON input path. The logic should be:

1. If `--element` is set: build patch JSON from `--set` flags, fetch contentHash (or use `--content-hash`), call PatchElements
2. Else: fall through to existing stdin/file path

**Insertion point:** After `pageID` is parsed from `args[0]` (existing line ~208-211 of site.go), but BEFORE the existing stdin/file reading logic (line ~214). The `pageID` variable must already be declared. The `output.ResolveFormat(cmd)` and `requireConfig()` calls at the top of the existing function remain unchanged.

```go
// INSERT AFTER: pageID, err := strconv.Atoi(args[0])
// INSERT BEFORE: existing stdin/file reading logic
elementID, _ := cmd.Flags().GetString("element")
if elementID != "" {
	setFlags, _ := cmd.Flags().GetStringArray("set")
	setClassStr, _ := cmd.Flags().GetString("set-class")
	contentHashFlag, _ := cmd.Flags().GetString("content-hash")

	settings := make(map[string]interface{})
	for _, s := range setFlags {
		parts := strings.SplitN(s, "=", 2)
		if len(parts) != 2 {
			return clierrors.ValidationError("INVALID_SET", fmt.Sprintf("--set value must be key=value, got: %s", s))
		}
		settings[parts[0]] = parts[1]
	}

	// Handle --set-class: resolve class names to IDs
	if setClassStr != "" {
		// TODO: Wire class resolver (Task 3) - for now, pass class names as-is
		classNames := strings.Split(setClassStr, ",")
		for i := range classNames {
			classNames[i] = strings.TrimSpace(classNames[i])
		}
		settings["_cssGlobalClasses"] = classNames
	}

	patch := map[string]interface{}{
		"id":       elementID,
		"settings": settings,
	}

	c := newSiteClient()

	// Get contentHash
	ifMatch := contentHashFlag
	if ifMatch == "" {
		existing, getErr := c.GetElements(pageID)
		if getErr == nil {
			ifMatch = existing.ContentHash
		}
	}

	result, patchErr := c.PatchElements(pageID, []map[string]interface{}{patch}, ifMatch)
	if patchErr != nil {
		return fmt.Errorf("patch failed: %w", patchErr)
	}

	if output.IsJSON() {
		return output.JSON(result)
	}
	fmt.Printf("Patched element %s on page %d (hash: %s)\n", elementID, pageID, result.ContentHash)
	return nil
}
// ... existing stdin/file logic follows ...
```

Add flags in `init()`:

```go
sitePatchCmd.Flags().String("element", "", "element ID to patch (shorthand mode)")
sitePatchCmd.Flags().StringArray("set", nil, "key=value settings (repeatable)")
sitePatchCmd.Flags().String("set-class", "", "comma-separated ACSS class names to set")
sitePatchCmd.Flags().String("content-hash", "", "pre-fetched contentHash for optimistic locking")
```

- [ ] **Step 4: Run test**

```bash
cd cli && go test ./cmd/ -run TestSitePatch -v
```

Expected: All patch tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add cli/cmd/site.go cli/cmd/site_test.go
git commit -m "feat: add site patch shorthand with --set and --set-class"
```

---

### Task 9: `site batch` Command + `BatchOperations()` Client Method

**Files:**
- Modify: `cli/internal/client/client.go` (add `BatchOperations()`)
- Modify: `cli/cmd/site.go` (add `site batch`)
- Modify: `cli/cmd/site_test.go` (add test)

- [ ] **Step 1: Write failing test**

Add to `cli/cmd/site_test.go`:

```go
func TestSiteBatch_JSONOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/42/elements/batch" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		ops := body["operations"].([]interface{})
		if len(ops) != 2 {
			t.Fatalf("expected 2 operations, got %d", len(ops))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "batchhash",
			"count":       5,
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}
	output.Reset()
	defer output.Reset()
	_ = siteBatchCmd.Flags().Set("format", "json")
	defer siteBatchCmd.Flags().Set("format", "")

	tmpDir := t.TempDir()
	inputFile := filepath.Join(tmpDir, "batch.json")
	data := []byte(`{"operations":[{"op":"delete","ids":["abc"]},{"op":"append","elements":[{"id":"new1","name":"heading"}]}]}`)
	os.WriteFile(inputFile, data, 0644)

	oldBatchFile := batchFile
	batchFile = inputFile
	defer func() { batchFile = oldBatchFile }()

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := siteBatchCmd.RunE(siteBatchCmd, []string{"42"})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}

	var result map[string]interface{}
	json.Unmarshal(buf.Bytes(), &result)
	if result["contentHash"] != "batchhash" {
		t.Fatalf("expected batchhash, got %v", result["contentHash"])
	}
}
```

- [ ] **Step 2: Add `BatchOperations()` to client.go**

```go
// BatchOperations performs multiple operations atomically.
func (c *Client) BatchOperations(pageID int, operations []map[string]interface{}, ifMatch string) (*MutationResponse, error) {
	payload, _ := json.Marshal(map[string]interface{}{"operations": operations})
	headers := map[string]string{}
	if ifMatch != "" {
		headers["If-Match"] = ifMatch
	}
	resp, err := c.doWithHeaders("POST", fmt.Sprintf("/pages/%d/elements/batch", pageID), strings.NewReader(string(payload)), headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result MutationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
```

- [ ] **Step 3: Add `site batch` command**

Add to `cli/cmd/site.go`:

```go
var batchFile string

var siteBatchCmd = &cobra.Command{
	Use:   "batch <page-id>",
	Short: "Execute multiple operations atomically",
	Long: `Perform multiple element operations (append, patch, delete) in one
atomic write. Operations are executed in order.

When to use: Multiple changes in one atomic write — e.g., delete old section
             + append new one + patch a heading.
Instead of:  Multiple separate site append/patch/delete calls.

Examples:
  echo '{"operations":[...]}' | bricks site batch 42
  bricks site batch 42 --file changes.json`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		pageID, err := strconv.Atoi(args[0])
		if err != nil {
			return clierrors.ValidationError("INVALID_PAGE_ID", fmt.Sprintf("invalid page ID: %s", args[0]))
		}

		var inputData []byte
		if batchFile != "" {
			inputData, err = os.ReadFile(batchFile)
		} else {
			inputData, err = io.ReadAll(os.Stdin)
		}
		if err != nil {
			return fmt.Errorf("failed to read input: %w", err)
		}

		var payload struct {
			Operations []map[string]interface{} `json:"operations"`
		}
		if err := json.Unmarshal(inputData, &payload); err != nil {
			return clierrors.ValidationError("INVALID_JSON", fmt.Sprintf("invalid JSON: %v", err))
		}

		c := newSiteClient()

		existing, getErr := c.GetElements(pageID)
		ifMatch := ""
		if getErr == nil {
			ifMatch = existing.ContentHash
		}

		result, batchErr := c.BatchOperations(pageID, payload.Operations, ifMatch)
		if batchErr != nil {
			return fmt.Errorf("batch failed: %w", batchErr)
		}

		if output.IsJSON() {
			return output.JSON(result)
		}

		fmt.Printf("Batch complete on page %d (%d operations, hash: %s)\n",
			pageID, len(payload.Operations), result.ContentHash)
		return nil
	},
}
```

Add in `init()`:

```go
siteBatchCmd.Flags().StringVar(&batchFile, "file", "", "batch operations JSON file")
output.AddFormatFlags(siteBatchCmd)

siteCmd.AddCommand(siteBatchCmd)
```

- [ ] **Step 4: Run tests**

```bash
cd cli && go test ./cmd/ -run TestSiteBatch -v
```

- [ ] **Step 5: Commit**

```bash
git add cli/internal/client/client.go cli/cmd/site.go cli/cmd/site_test.go
git commit -m "feat: add site batch command for atomic multi-operations"
```

---

## Chunk 3: Convert + Abilities

### Task 10: `convert html --append --after`

**Files:**
- Modify: `cli/cmd/convert.go` (add `--append` and `--after` flags)
- Modify: `cli/cmd/convert_test.go` (add tests)

- [ ] **Step 1: Write failing test**

Add to `cli/cmd/convert_test.go`:

```go
func TestConvertHTML_Append(t *testing.T) {
	// Mock server: GET for contentHash, POST for append
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && strings.HasSuffix(r.URL.Path, "/elements") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"elements":    []map[string]interface{}{},
				"contentHash": "existinghash",
				"count":       0,
			})
			return
		}
		if r.Method == "GET" && strings.HasSuffix(r.URL.Path, "/classes") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"classes": []map[string]interface{}{},
				"count":   0,
			})
			return
		}
		if r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/elements") {
			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)
			if body["insertAfter"] != "xottyu" {
				t.Fatalf("expected insertAfter=xottyu, got %v", body["insertAfter"])
			}
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":     true,
				"contentHash": "appendedhash",
				"count":       3,
			})
			return
		}
		t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}

	convertAppend = 42
	convertAfter = "xottyu"
	convertStdin = true
	convertDryRun = false
	defer func() {
		convertAppend = 0
		convertAfter = ""
		convertStdin = false
	}()

	// Pipe HTML via stdin
	oldStdin := os.Stdin
	r, w, _ := os.Pipe()
	w.Write([]byte("<section><h2>Test</h2></section>"))
	w.Close()
	os.Stdin = r
	defer func() { os.Stdin = oldStdin }()

	err := convertHTMLCmd.RunE(convertHTMLCmd, []string{})
	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestConvertHTML_Append -v
```

- [ ] **Step 3: Add --append and --after flags to convert.go**

Add new package variables:

```go
var (
	convertAppend int
	convertAfter  string
)
```

In `convertHTMLCmd.RunE`, add append logic after the existing push block (around line 106). The full flow:

1. If `--push` and not `--dry-run`: existing full-replace logic (unchanged)
2. If `--append` and not `--dry-run`: new append logic:
   - Snapshot if `--snapshot` (before appending)
   - Fetch contentHash
   - Call `c.AppendElements(pageID, elements, ifMatch, convertAfter)`

```go
// After conversion, before output JSON:
if convertAppend > 0 && !convertDryRun {
	if err := requireConfig(); err != nil {
		return err
	}
	c := newSiteClient()

	if convertSnapshot {
		snap, snapErr := c.CreateSnapshot(convertAppend, "Pre-append backup")
		if snapErr != nil {
			fmt.Fprintf(os.Stderr, "Warning: snapshot failed: %v\n", snapErr)
		} else {
			fmt.Fprintf(os.Stderr, "Snapshot created: %s\n", snap.SnapshotID)
		}
	}

	existing, getErr := c.GetElements(convertAppend)
	ifMatch := ""
	if getErr == nil {
		ifMatch = existing.ContentHash
	}

	result, appendErr := c.AppendElements(convertAppend, elements, ifMatch, convertAfter)
	if appendErr != nil {
		return fmt.Errorf("append failed: %w", appendErr)
	}
	fmt.Fprintf(os.Stderr, "Appended %d elements to page %d after %s (hash: %s)\n",
		len(elements), convertAppend, convertAfter, result.ContentHash)
}
```

Add flag registration in `init()`:

```go
convertHTMLCmd.Flags().IntVar(&convertAppend, "append", 0, "append to page ID (instead of full replace)")
convertHTMLCmd.Flags().StringVar(&convertAfter, "after", "", "element ID to insert after (use with --append)")
```

- [ ] **Step 4: Run tests**

```bash
cd cli && go test ./cmd/ -run TestConvert -v
```

Expected: All convert tests pass.

- [ ] **Step 5: Commit**

```bash
git add cli/cmd/convert.go cli/cmd/convert_test.go
git commit -m "feat: add convert html --append and --after flags"
```

---

### Task 11: `abilities run` Command + `RunAbility()` Client Method

**Files:**
- Modify: `cli/internal/client/client.go` (add `RunAbility()`)
- Create: `cli/cmd/abilities_run.go`
- Create: `cli/cmd/abilities_run_test.go`

- [ ] **Step 1: Write failing test**

Create `cli/cmd/abilities_run_test.go`:

```go
package cmd

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/config"
	"github.com/nerveband/agent-to-bricks/internal/output"
)

func TestAbilitiesRunCmd_Readonly(t *testing.T) {
	// First request: list abilities (to find the ability and check readonly)
	// Second request: execute ability
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if requestCount == 1 {
			// GET abilities list
			json.NewEncoder(w).Encode([]map[string]interface{}{
				{
					"name": "agent-bricks/list-pages", "label": "List Pages",
					"category": "agent-bricks-pages",
					"meta": map[string]interface{}{
						"annotations": map[string]interface{}{"readonly": true},
					},
				},
			})
			return
		}
		// Execute
		if r.Method != "GET" {
			t.Fatalf("expected GET for readonly ability, got %s", r.Method)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"result": []map[string]interface{}{
				{"id": 13, "title": "Homepage"},
			},
		})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}
	output.Reset()
	defer output.Reset()

	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	err := abilitiesRunCmd.RunE(abilitiesRunCmd, []string{"agent-bricks/list-pages"})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)

	if err != nil {
		t.Fatalf("RunE error: %v", err)
	}

	if buf.Len() == 0 {
		t.Fatal("expected output")
	}
}

func TestAbilitiesRunCmd_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode([]map[string]interface{}{})
	}))
	defer server.Close()

	cfg = &config.Config{
		Site: config.SiteConfig{URL: server.URL, APIKey: "atb_testkey"},
	}

	err := abilitiesRunCmd.RunE(abilitiesRunCmd, []string{"nonexistent/ability"})
	if err == nil {
		t.Fatal("expected error for unknown ability")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestAbilitiesRun -v
```

- [ ] **Step 3: Add `RunAbility()` to client.go**

```go
// RunAbility executes a WordPress Ability via the wp-abilities/v1 namespace.
func (c *Client) RunAbility(name string, method string, input map[string]interface{}) (map[string]interface{}, error) {
	abilityURL := c.baseURL + "/wp-json/wp-abilities/v1/" + name + "/run"

	var body io.Reader
	if input != nil && method == "POST" {
		data, _ := json.Marshal(input)
		body = strings.NewReader(string(data))
	}

	req, err := http.NewRequest(method, abilityURL, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-ATB-Key", c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ability %q returned HTTP %d: %s", name, resp.StatusCode, string(data))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}
```

- [ ] **Step 4: Create `abilities_run.go`**

Create `cli/cmd/abilities_run.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"

	clierrors "github.com/nerveband/agent-to-bricks/internal/errors"
	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

var abilitiesRunCmd = &cobra.Command{
	Use:   "run <ability-name>",
	Short: "Execute a WordPress Ability",
	Long: `Execute any WordPress Ability discovered via 'abilities list'.
Readonly abilities use GET, write abilities use POST.

When to use: Any site operation beyond page content — SEO, WooCommerce,
             forms, media, or anything third-party plugins expose.
Instead of:  Manual REST API calls to plugin-specific endpoints.

Examples:
  bricks abilities run agent-bricks/list-pages --input '{"search":"home"}'
  bricks abilities run agent-bricks/upload-media --input '{"filename":"hero.jpg"}'`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		output.ResolveFormat(cmd)
		if err := requireConfig(); err != nil {
			return err
		}

		abilityName := args[0]
		c := newSiteClient()

		// Look up the ability to determine method (GET vs POST)
		abilities, err := c.GetAbilities("")
		if err != nil {
			return fmt.Errorf("failed to fetch abilities: %w", err)
		}

		var found bool
		var readonly bool
		for _, a := range abilities {
			if a.Name == abilityName {
				found = true
				readonly = a.Annotations.Readonly
				break
			}
		}

		if !found {
			return &clierrors.CLIError{
				Code:    "ABILITY_NOT_FOUND",
				Message: fmt.Sprintf("ability %q not found", abilityName),
				Hint:    "Run: bricks abilities list  # see all available abilities",
				SeeAlso: "bricks abilities describe <name>  # check schema before calling",
				Exit:    3,
			}
		}

		method := "POST"
		if readonly {
			method = "GET"
		}

		// Parse input
		var input map[string]interface{}
		inputStr, _ := cmd.Flags().GetString("input")
		if inputStr != "" {
			if err := json.Unmarshal([]byte(inputStr), &input); err != nil {
				return clierrors.ValidationError("INVALID_JSON", fmt.Sprintf("invalid --input JSON: %v", err))
			}
		}

		result, err := c.RunAbility(abilityName, method, input)
		if err != nil {
			return fmt.Errorf("ability execution failed: %w", err)
		}

		if output.IsJSON() {
			return output.JSON(result)
		}

		// Default: pretty-print result
		data, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(data))
		return nil
	},
}

func init() {
	abilitiesRunCmd.Flags().String("input", "", "input JSON for the ability")
	output.AddFormatFlags(abilitiesRunCmd)

	abilitiesCmd.AddCommand(abilitiesRunCmd)
}
```

- [ ] **Step 5: Run test**

```bash
cd cli && go test ./cmd/ -run TestAbilitiesRun -v
```

- [ ] **Step 6: Commit**

```bash
git add cli/internal/client/client.go cli/cmd/abilities_run.go cli/cmd/abilities_run_test.go
git commit -m "feat: add abilities run command for WordPress Abilities execution"
```

---

## Chunk 4: Agent Context v2 + Progressive Disclosure

### Task 12: Rewrite `RenderPrompt()` and `writeWorkflowsSection()`

**Files:**
- Modify: `cli/internal/agent/context.go`
- Modify: `cli/cmd/agent_test.go` (add test)

- [ ] **Step 1: Write failing test**

Add to `cli/cmd/agent_test.go`:

```go
func TestAgentContext_PromptHasDecisionTree(t *testing.T) {
	b := agent.NewContextBuilder()
	b.SetSiteInfo("1.9.8", "6.7", "2.1.0")
	prompt := b.RenderPrompt()

	// Must contain decision tree, not "bricks generate"
	if strings.Contains(prompt, "bricks generate") {
		t.Error("prompt still references dead 'bricks generate' command")
	}
	if !strings.Contains(prompt, "Decision Tree") && !strings.Contains(prompt, "decision tree") {
		t.Error("prompt missing decision tree section")
	}
	if !strings.Contains(prompt, "site find") {
		t.Error("prompt missing site find workflow")
	}
	if !strings.Contains(prompt, "convert html --append") {
		t.Error("prompt missing convert html --append workflow")
	}
}

func TestAgentContext_WorkflowsSectionNoGenerate(t *testing.T) {
	b := agent.NewContextBuilder()
	md := b.RenderSection("workflows")
	if strings.Contains(md, "generate") {
		t.Error("workflows section still references 'generate' command")
	}
	if !strings.Contains(md, "site find") {
		t.Error("workflows section missing site find")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestAgentContext_ -v
```

- [ ] **Step 3: Rewrite `writeWorkflowsSection()` in context.go**

Replace the existing `writeWorkflowsSection()` (lines 305-323) with:

```go
func (b *ContextBuilder) writeWorkflowsSection(sb *strings.Builder) {
	sb.WriteString("## Workflows — Decision Tree\n\n")
	sb.WriteString("Follow this decision tree for every task:\n\n")
	sb.WriteString("### 1. Find what you need\n")
	sb.WriteString("- Find a page: `bricks pages list --search \"name\"`\n")
	sb.WriteString("- Find elements on a page: `bricks site find <page-id> --type heading`\n")
	sb.WriteString("- Find media: `bricks media list --search \"name\"`\n")
	sb.WriteString("- Find templates: `bricks templates search \"hero\"`\n")
	sb.WriteString("- Find site capabilities: `bricks abilities list`\n\n")

	sb.WriteString("### 2. Create or edit content\n")
	sb.WriteString("**Creating new content (from scratch):**\n")
	sb.WriteString("- Write HTML with ACSS classes → `bricks convert html file.html --push <page-id>`\n")
	sb.WriteString("- Append to existing page → `bricks convert html section.html --append <page-id> --after <element-id>`\n")
	sb.WriteString("- Compose from templates → `bricks compose hero features cta --push <page-id>`\n\n")

	sb.WriteString("**Editing existing content:**\n")
	sb.WriteString("- Quick edit: `bricks site patch <page-id> --element <id> --set text=\"New text\"`\n")
	sb.WriteString("- Set classes: `bricks site patch <page-id> --element <id> --set-class \"gap--m,padding--l\"`\n")
	sb.WriteString("- Delete elements: `bricks site delete <page-id> --ids <id1>,<id2>`\n")
	sb.WriteString("- Append raw JSON: `bricks site append <page-id> --file new.json --after <element-id>`\n")
	sb.WriteString("- Batch operations: `echo '{\"operations\":[...]}' | bricks site batch <page-id>`\n\n")

	sb.WriteString("### 3. Site-wide operations\n")
	sb.WriteString("- Run any WordPress Ability: `bricks abilities run <name> --input '{...}'`\n")
	sb.WriteString("- SEO, WooCommerce, forms, media — anything plugins expose\n\n")

	sb.WriteString("### 4. Verify\n")
	sb.WriteString("- Check page state: `bricks site pull <page-id>`\n")
	sb.WriteString("- Validate JSON: `bricks validate page.json`\n")
	sb.WriteString("- Page health: `bricks doctor <page-id>`\n\n")

	sb.WriteString("### Key rules\n")
	sb.WriteString("- ALWAYS prefer `convert html` over raw JSON — it resolves ACSS classes automatically\n")
	sb.WriteString("- NEVER use inline CSS when an ACSS utility class exists (the CLI will warn you)\n")
	sb.WriteString("- Create snapshots before destructive changes: `bricks site snapshot <page-id>`\n")
	sb.WriteString("- Use `--json` flag on any command for structured output\n\n")
}
```

- [ ] **Step 4: Rewrite `RenderPrompt()` preamble**

Replace the existing preamble (lines 157-183) with the decision-tree approach:

```go
func (b *ContextBuilder) RenderPrompt() string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf(`You are building pages for a Bricks Builder %s site with Automatic.css (ACSS).

## Decision Tree

1. **Find** what you need: pages list, site find, media list, templates search
2. **Create** new content: Write HTML with ACSS classes → convert html --push/--append
3. **Edit** existing content: site find → site patch --set/--set-class
4. **Verify**: site pull, validate, doctor

## Critical Rules
- ALWAYS use ACSS utility classes — never inline CSS (the CLI auto-resolves class names)
- Use convert html for creation (resolves classes from HTML automatically)
- Use site patch --set for edits (faster than pull/modify/push)
- Every mutating command returns a contentHash for subsequent operations

`, b.bricksVersion))

	// Add context sections in spec-defined order (spec line 338-346):
	// 1. Decision tree (above), 2. Class rules, 3. Element reference,
	// 4. Design tokens, 5. ACSS classes, 6. Frames classes, 7. Templates, 8. Abilities
	b.writeClassRulesSection(&sb)
	b.writeElementReferenceSection(&sb)

	sb.WriteString("## Available Design Tokens\n")
	if b.acssTokens != nil {
		for k, v := range b.acssTokens {
			sb.WriteString(fmt.Sprintf("- **%s**: %v\n", k, v))
		}
	}
	sb.WriteString("\n")

	b.writeClassesSection(&sb)   // ACSS + Frames classes
	b.writeTemplatesSection(&sb)
	b.writeAbilitiesSection(&sb)

	return sb.String()
}
```

- [ ] **Step 5: Run test**

```bash
cd cli && go test ./cmd/ -run TestAgentContext_ -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add cli/internal/agent/context.go cli/cmd/agent_test.go
git commit -m "feat: rewrite agent context with decision tree and new workflows"
```

---

### Task 13: Add `writeClassRulesSection()` and `writeElementReferenceSection()`

**Files:**
- Modify: `cli/internal/agent/context.go`

- [ ] **Step 1: Write failing test**

Add to `cli/cmd/agent_test.go`:

```go
func TestAgentContext_HasClassRules(t *testing.T) {
	b := agent.NewContextBuilder()
	prompt := b.RenderPrompt()
	if !strings.Contains(prompt, "Class Usage Rules") {
		t.Error("prompt missing class usage rules")
	}
	if !strings.Contains(prompt, "_cssGlobalClasses") {
		t.Error("prompt missing _cssGlobalClasses reference")
	}
}

func TestAgentContext_HasElementReference(t *testing.T) {
	b := agent.NewContextBuilder()
	prompt := b.RenderPrompt()
	if !strings.Contains(prompt, "Element JSON Reference") {
		t.Error("prompt missing element JSON reference")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && go test ./cmd/ -run TestAgentContext_Has -v
```

- [ ] **Step 3: Implement both sections**

Add to `cli/internal/agent/context.go`:

```go
func (b *ContextBuilder) writeClassRulesSection(sb *strings.Builder) {
	sb.WriteString("## Class Usage Rules\n\n")
	sb.WriteString("- ALWAYS use ACSS utility classes for layout, spacing, colors, typography\n")
	sb.WriteString("- The CLI resolves human-readable class names to Bricks IDs automatically\n")
	sb.WriteString("- Unknown classes are auto-created as global classes\n")
	sb.WriteString("- Set classes via: `--set-class \"gap--m,padding--l\"` or `_cssGlobalClasses` in JSON\n\n")

	sb.WriteString("### Common patterns\n")
	sb.WriteString("| Pattern | Classes |\n")
	sb.WriteString("|---------|--------|\n")
	sb.WriteString("| Section with spacing | `section--l`, `padding--xl` |\n")
	sb.WriteString("| 3-column grid | `grid`, `grid--auto-3`, `gap--m` |\n")
	sb.WriteString("| Card with padding | `padding--l`, `radius--m`, `bg--white` |\n")
	sb.WriteString("| Dark background | `bg--primary-ultra-dark`, `text--white` |\n")
	sb.WriteString("| Centered text | `text--center` |\n\n")

	sb.WriteString("### DO NOT\n")
	sb.WriteString("- Use `_padding: {\"top\": \"50px\"}` — use `padding--xl` class instead\n")
	sb.WriteString("- Use `_gap: \"20px\"` — use `gap--m` class instead\n")
	sb.WriteString("- Use `_gridTemplateColumns: \"1fr 1fr 1fr\"` — use `grid--auto-3` class instead\n")
	sb.WriteString("- Use `_borderRadius: \"8px\"` — use `radius--m` class instead\n\n")
}

func (b *ContextBuilder) writeElementReferenceSection(sb *strings.Builder) {
	sb.WriteString("## Element JSON Reference\n\n")
	sb.WriteString("Each Bricks element has this structure:\n")
	sb.WriteString("```json\n")
	sb.WriteString("{\"id\": \"abc123\", \"name\": \"heading\", \"parent\": \"0\", \"children\": [],\n")
	sb.WriteString(" \"label\": \"Title\", \"settings\": {\"text\": \"Hello\", \"tag\": \"h2\"},\n")
	sb.WriteString(" \"_cssGlobalClasses\": [\"acss_import_text--center\"]}\n")
	sb.WriteString("```\n\n")

	sb.WriteString("### Common element types\n")
	sb.WriteString("| Type | Key Settings |\n")
	sb.WriteString("|------|-------------|\n")
	sb.WriteString("| `section` | Container for page sections. Children are `div` or `block` |\n")
	sb.WriteString("| `div` / `block` | Generic containers. Use for grid layouts |\n")
	sb.WriteString("| `heading` | `text`, `tag` (h1-h6) |\n")
	sb.WriteString("| `text-basic` | `text` (supports HTML) |\n")
	sb.WriteString("| `image` | `image.url`, `image.id`, `alt` |\n")
	sb.WriteString("| `button` | `text`, `link.url`, `link.type` |\n\n")
}
```

- [ ] **Step 4: Run test**

```bash
cd cli && go test ./cmd/ -run TestAgentContext_Has -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/internal/agent/context.go cli/cmd/agent_test.go
git commit -m "feat: add class rules and element reference to agent context"
```

---

### Task 14: Update Root Help Text and Schema

**Files:**
- Modify: `cli/cmd/root.go` (add agent context hint)
- Modify: `cli/schema.json` (add workflows key, new commands, new error codes)
- Modify: `cli/cmd/schema.go` (validate workflows key)

- [ ] **Step 1: Write failing test for root help text**

Add to `cli/cmd/root_test.go`:

```go
func TestRootHelp_AgentHint(t *testing.T) {
	if !strings.Contains(rootCmd.Long, "agent context") {
		t.Error("root help missing agent context hint")
	}
}
```

- [ ] **Step 2: Update root.go**

Change the `rootCmd` definition in `cli/cmd/root.go`:

```go
var rootCmd = &cobra.Command{
	Use:   "bricks",
	Short: "Agent to Bricks — AI-powered Bricks Builder CLI",
	Long: `AI agents: run "bricks agent context --format prompt" for complete workflow guidance.

Build and manage Bricks Builder pages programmatically via AI agents.`,
}
```

- [ ] **Step 3: Update schema.json**

Add `workflows` key at the top level (after `"globalFlags"`):

```json
"workflows": {
    "start": "bricks agent context --format prompt",
    "find_page": "bricks pages list --search <name>",
    "find_elements": "bricks site find <page-id> --type <type>",
    "create_content": "bricks convert html <file> --push <page-id>",
    "add_to_page": "bricks convert html <file> --append <page-id> --after <element-id>",
    "edit_element": "bricks site patch <page-id> --element <id> --set key=value",
    "delete_elements": "bricks site delete <page-id> --ids <id1>,<id2>",
    "site_action": "bricks abilities run <name> --input '{...}'"
},
```

Add new commands: `pages list`, `site find`, `site delete`, `site append`, `site batch`, `abilities run`.

Add new error codes: `MISSING_CONTENT_HASH`, `ELEMENT_NOT_FOUND`, `ABILITY_NOT_FOUND`, `MISSING_IDS`.

- [ ] **Step 4: Run schema validation**

```bash
cd cli && go run . schema --validate
```

Expected: PASS (all commands in schema match live Cobra tree).

- [ ] **Step 5: Commit**

```bash
git add cli/cmd/root.go cli/schema.json cli/cmd/root_test.go
git commit -m "feat: add agent hint to root help, workflows to schema"
```

---

### Task 15: Update `llms.txt` and Website Docs

**Files:**
- Modify: `website/public/llms.txt`
- Modify: `website/src/content/docs/guides/bring-your-own-agent.md`

- [ ] **Step 1: Read current llms.txt**

```bash
cat website/public/llms.txt
```

- [ ] **Step 2: Update llms.txt**

Add "first command" guidance and new commands to `website/public/llms.txt`. The first line after the header should be:

```
Your first command: bricks agent context --format prompt
```

Add new commands section listing `pages list`, `site find`, `site delete`, `site append`, `site batch`, `convert html --append`, `abilities run`.

- [ ] **Step 3: Update bring-your-own-agent.md workflows section**

Replace the workflows section with the decision tree from the agent context.

- [ ] **Step 4: Build website to verify**

```bash
cd website && npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add website/public/llms.txt website/src/content/docs/guides/bring-your-own-agent.md
git commit -m "docs: update llms.txt and BYOA guide with new commands"
```

---

### Task 15b: Update CLI Documentation Page

**Files:**
- Modify: `website/src/content/docs/cli/site-commands.md`

- [ ] **Step 1: Read current site-commands.md**

```bash
cat website/src/content/docs/cli/site-commands.md
```

- [ ] **Step 2: Add documentation for new commands**

Add sections for `site find`, `site delete`, `site append`, `site batch`, and the `site patch` shorthand flags (`--element`, `--set`, `--set-class`, `--content-hash`). Follow existing documentation format in the file.

Also add a section for `pages list` (may need a new `pages.md` file or add to an existing reference page).

- [ ] **Step 3: Build website to verify**

```bash
cd website && npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add website/src/content/docs/cli/
git commit -m "docs: add site find/delete/append/batch and pages list to CLI docs"
```

---

### Task 15c: Version Bump

**Files:**
- Modify: `VERSION`

- [ ] **Step 1: Read current version**

```bash
cat VERSION
```

- [ ] **Step 2: Bump minor version**

Update VERSION file to the next minor version (e.g., 2.1.0 → 2.2.0).

- [ ] **Step 3: Sync version across all components**

```bash
make sync-version
```

- [ ] **Step 4: Verify version sync**

```bash
make check-version
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add VERSION
git add -u  # catch files modified by sync-version
git commit -m "chore: bump version to X.Y.Z"
```

---

## Chunk 5: Integration Tests + Validation

### Task 16: Integration Tests Against Staging

**Files:**
- Create: `cli/tests/agent_simulation_test.sh`

These tests run against ts-staging.wavedepth.com using page 1338 (CLI Test Page).

**Prerequisite:** Environment variables `ATB_STAGING_URL` and `ATB_STAGING_API_KEY` must be set.

- [ ] **Step 1: Write agent simulation test script**

Create `cli/tests/agent_simulation_test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Agent Simulation Tests
# Run against ts-staging.wavedepth.com using page 1338 (CLI Test Page)
# Requires: ATB_STAGING_URL, ATB_STAGING_API_KEY env vars

BRICKS="${BRICKS_BIN:-bricks}"
PASS=0
FAIL=0

assert_contains() {
    local desc="$1" output="$2" expected="$3"
    if echo "$output" | grep -q "$expected"; then
        echo "  PASS: $desc"
        ((PASS++))
    else
        echo "  FAIL: $desc — expected '$expected' in output"
        echo "  Output: $output"
        ((FAIL++))
    fi
}

assert_exit_zero() {
    local desc="$1"
    shift
    if output=$("$@" 2>&1); then
        echo "  PASS: $desc"
        ((PASS++))
        echo "$output"
    else
        echo "  FAIL: $desc (exit $?)"
        ((FAIL++))
    fi
}

echo "=== Scenario 1: Fresh agent experience ==="

# Agent reads --help, sees agent context hint
output=$($BRICKS --help 2>&1)
assert_contains "root help mentions agent context" "$output" "agent context"

# Agent reads schema, sees workflows
output=$($BRICKS schema 2>&1)
assert_contains "schema has workflows" "$output" "workflows"

echo ""
echo "=== Scenario 2: Find page → find elements → edit ==="

# Find homepage
output=$($BRICKS pages list --search "home" --json 2>&1)
assert_contains "pages list finds homepage" "$output" '"id"'

# Find headings on homepage
output=$($BRICKS site find 13 --type heading --json 2>&1)
assert_contains "site find returns headings" "$output" '"elements"'

echo ""
echo "=== Scenario 3: Append and cleanup on test page ==="

# Snapshot before test
$BRICKS site snapshot 1338 --label "pre-simulation-test" 2>/dev/null || true

# Append a test element
output=$(echo '<section><h2 class="text--center">Simulation Test</h2></section>' | \
    $BRICKS convert html --stdin --append 1338 2>&1)
assert_contains "convert html --append succeeds" "$output" "Appended"

# Rollback
$BRICKS site rollback 1338 2>/dev/null || true

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1
```

- [ ] **Step 2: Build CLI and run simulation**

```bash
cd cli && go build -o ../bin/bricks . && BRICKS_BIN=../bin/bricks bash tests/agent_simulation_test.sh
```

- [ ] **Step 3: Commit**

```bash
git add cli/tests/
git commit -m "test: add agent simulation tests against staging"
```

---

### Task 17: Full Validation Pass

- [ ] **Step 1: Run all Go tests**

```bash
cd cli && go test ./... -v 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 2: Run go vet**

```bash
cd cli && go vet ./...
```

Expected: No issues.

- [ ] **Step 3: Run schema validation**

```bash
cd cli && go run . schema --validate
```

Expected: PASS — all commands in schema.json match live Cobra tree.

- [ ] **Step 4: Run check-version**

```bash
make check-version
```

Expected: PASS.

- [ ] **Step 5: Build website**

```bash
cd website && npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 6: Score against agent-dx-cli-scale**

Evaluate the CLI against each axis:

| Axis | Before | After | Evidence |
|------|--------|-------|----------|
| Machine-Readable Output | 1 | 2 | All new commands support `--json` with consistent response shapes |
| Raw Payload Input | 2 | 3 | `site append`, `site batch`, `abilities run --input` all accept raw JSON |
| Schema Introspection | 1 | 2 | `bricks schema` now includes `workflows` key with full decision tree |
| Context Window Discipline | 1 | 2 | `site find` returns filtered results; `pages list` is compact |
| Input Hardening | 1 | 2 | Class resolution pipeline resolves/auto-creates instead of silent failure |
| Safety Rails | 1 | 2 | `--dry-run` on convert, automatic snapshots, contentHash on all mutations |
| Agent Knowledge Packaging | 2 | 3 | Rewritten `agent context` with decision tree, class rules, element reference |
| **Total** | **9** | **16** | |

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete agent-native workflow engine — agent DX score 9→16"
```
