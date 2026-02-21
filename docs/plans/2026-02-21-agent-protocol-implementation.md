# Agent Protocol Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the CLI a self-discovery layer for LLMs — exposing ACSS tokens, Frames classes, templates, and workflows — with an ACSS-aware HTML-to-Bricks converter that maps class names to global class IDs.

**Architecture:** Three new/enhanced subsystems: (1) `bricks agent context` fetches live site data and formats it for LLM consumption in md/json/prompt formats, (2) enhanced `convert html` resolves CSS class names against a cached class registry and maps inline styles to Bricks settings, (3) `templates compose` enhanced for Frames library with search and multi-template merge.

**Tech Stack:** Go 1.21+, cobra CLI, golang.org/x/net/html, existing REST API client

**Design Doc:** `docs/plans/2026-02-21-agent-protocol-design.md`

---

### Task 1: Class Registry — Data Structure & Fetching

Build the class name → ID lookup that both the converter and agent context depend on.

**Files:**
- Create: `cli/internal/convert/classregistry.go`
- Test: `cli/internal/convert/classregistry_test.go`

**Step 1: Write failing test for ClassRegistry**

```go
// cli/internal/convert/classregistry_test.go
package convert

import "testing"

func TestClassRegistry_Lookup(t *testing.T) {
    reg := NewClassRegistry()
    reg.Add("height--full", "acss_import_height--full", "acss")
    reg.Add("fr-lede", "kddjfd", "frames")
    reg.Add("btn--primary", "btn--primary", "frames")

    // Found ACSS class
    id, source, ok := reg.Lookup("height--full")
    if !ok || id != "acss_import_height--full" || source != "acss" {
        t.Errorf("expected acss_import_height--full/acss, got %s/%s/%v", id, source, ok)
    }

    // Found Frames class
    id, source, ok = reg.Lookup("fr-lede")
    if !ok || id != "kddjfd" || source != "frames" {
        t.Errorf("expected kddjfd/frames, got %s/%s/%v", id, source, ok)
    }

    // Not found
    _, _, ok = reg.Lookup("nonexistent")
    if ok {
        t.Error("expected not found")
    }
}

func TestClassRegistry_Stats(t *testing.T) {
    reg := NewClassRegistry()
    reg.Add("bg--dark", "acss_import_bg--dark", "acss")
    reg.Add("fr-lede", "kddjfd", "frames")

    stats := reg.Stats()
    if stats.Total != 2 || stats.ACSS != 1 || stats.Frames != 1 {
        t.Errorf("unexpected stats: %+v", stats)
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./internal/convert/ -run TestClassRegistry -v`
Expected: FAIL — `NewClassRegistry` undefined

**Step 3: Write implementation**

```go
// cli/internal/convert/classregistry.go
package convert

// ClassRegistry maps CSS class names to Bricks global class IDs.
type ClassRegistry struct {
    byName map[string]classEntry
}

type classEntry struct {
    ID     string
    Source string // "acss" or "frames"
}

// RegistryStats holds counts by source.
type RegistryStats struct {
    Total  int
    ACSS   int
    Frames int
}

// NewClassRegistry creates an empty registry.
func NewClassRegistry() *ClassRegistry {
    return &ClassRegistry{byName: make(map[string]classEntry)}
}

// Add registers a class name → ID mapping.
func (r *ClassRegistry) Add(name, id, source string) {
    r.byName[name] = classEntry{ID: id, Source: source}
}

// Lookup finds a class by name. Returns (id, source, found).
func (r *ClassRegistry) Lookup(name string) (string, string, bool) {
    e, ok := r.byName[name]
    if !ok {
        return "", "", false
    }
    return e.ID, e.Source, true
}

// Stats returns counts by source.
func (r *ClassRegistry) Stats() RegistryStats {
    s := RegistryStats{Total: len(r.byName)}
    for _, e := range r.byName {
        switch e.Source {
        case "acss":
            s.ACSS++
        case "frames":
            s.Frames++
        }
    }
    return s
}

// Names returns all registered class names.
func (r *ClassRegistry) Names() []string {
    names := make([]string, 0, len(r.byName))
    for n := range r.byName {
        names = append(names, n)
    }
    return names
}

// BySource returns class names filtered by source.
func (r *ClassRegistry) BySource(source string) []string {
    var names []string
    for n, e := range r.byName {
        if e.Source == source {
            names = append(names, n)
        }
    }
    return names
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./internal/convert/ -run TestClassRegistry -v`
Expected: PASS

**Step 5: Commit**

```bash
git add cli/internal/convert/classregistry.go cli/internal/convert/classregistry_test.go
git commit -m "feat(cli): add ClassRegistry for class name → ID lookup"
```

---

### Task 2: Class Registry — Build from API Response

Add a function that populates the registry from the live site's `/classes` endpoint data.

**Files:**
- Modify: `cli/internal/convert/classregistry.go`
- Modify: `cli/internal/convert/classregistry_test.go`

**Step 1: Write failing test**

```go
func TestBuildRegistryFromClasses(t *testing.T) {
    // Simulate API response — slice of maps like the /classes endpoint returns
    classes := []map[string]interface{}{
        {"id": "acss_import_height--full", "name": "height--full"},
        {"id": "acss_import_bg--dark", "name": "bg--dark"},
        {"id": "kddjfd", "name": "fr-lede"},
        {"id": "btn--primary", "name": "btn--primary"},
    }

    reg := BuildRegistryFromClasses(classes)

    // ACSS class (id starts with acss_import_)
    id, source, ok := reg.Lookup("height--full")
    if !ok || id != "acss_import_height--full" || source != "acss" {
        t.Errorf("ACSS lookup failed: %s/%s/%v", id, source, ok)
    }

    // Frames class
    id, source, ok = reg.Lookup("fr-lede")
    if !ok || id != "kddjfd" || source != "frames" {
        t.Errorf("Frames lookup failed: %s/%s/%v", id, source, ok)
    }

    stats := reg.Stats()
    if stats.Total != 4 || stats.ACSS != 2 || stats.Frames != 2 {
        t.Errorf("unexpected stats: %+v", stats)
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./internal/convert/ -run TestBuildRegistry -v`
Expected: FAIL — `BuildRegistryFromClasses` undefined

**Step 3: Write implementation**

Add to `classregistry.go`:

```go
import "strings"

// BuildRegistryFromClasses populates a registry from the /classes API response.
func BuildRegistryFromClasses(classes []map[string]interface{}) *ClassRegistry {
    reg := NewClassRegistry()
    for _, cls := range classes {
        id, _ := cls["id"].(string)
        name, _ := cls["name"].(string)
        if id == "" || name == "" {
            continue
        }
        source := "frames"
        if strings.HasPrefix(id, "acss_import_") {
            source = "acss"
        }
        reg.Add(name, id, source)
    }
    return reg
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test ./internal/convert/ -run TestBuildRegistry -v`
Expected: PASS

**Step 5: Commit**

```bash
git add cli/internal/convert/classregistry.go cli/internal/convert/classregistry_test.go
git commit -m "feat(cli): build ClassRegistry from /classes API response"
```

---

### Task 3: Class Registry — JSON Cache (Save/Load)

Allow the registry to be cached to disk so repeated conversions don't need API calls.

**Files:**
- Modify: `cli/internal/convert/classregistry.go`
- Modify: `cli/internal/convert/classregistry_test.go`

**Step 1: Write failing test**

```go
func TestClassRegistry_SaveLoad(t *testing.T) {
    reg := NewClassRegistry()
    reg.Add("height--full", "acss_import_height--full", "acss")
    reg.Add("fr-lede", "kddjfd", "frames")

    tmpFile := filepath.Join(t.TempDir(), "registry.json")

    if err := reg.SaveToFile(tmpFile, "https://example.com"); err != nil {
        t.Fatal(err)
    }

    loaded, err := LoadRegistryFromFile(tmpFile)
    if err != nil {
        t.Fatal(err)
    }

    id, _, ok := loaded.Lookup("height--full")
    if !ok || id != "acss_import_height--full" {
        t.Error("loaded registry lookup failed")
    }

    if loaded.Stats().Total != 2 {
        t.Errorf("expected 2 entries, got %d", loaded.Stats().Total)
    }
}
```

**Step 2: Run to verify fail**

Run: `cd cli && go test ./internal/convert/ -run TestClassRegistry_SaveLoad -v`
Expected: FAIL — `SaveToFile` undefined

**Step 3: Implement save/load**

```go
import (
    "encoding/json"
    "os"
    "time"
)

type registryFile struct {
    FetchedAt time.Time         `json:"fetchedAt"`
    SiteURL   string            `json:"siteUrl"`
    ByName    map[string][2]string `json:"byName"` // name → [id, source]
}

func (r *ClassRegistry) SaveToFile(path, siteURL string) error {
    data := registryFile{
        FetchedAt: time.Now(),
        SiteURL:   siteURL,
        ByName:    make(map[string][2]string),
    }
    for name, entry := range r.byName {
        data.ByName[name] = [2]string{entry.ID, entry.Source}
    }
    b, err := json.MarshalIndent(data, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(path, b, 0644)
}

func LoadRegistryFromFile(path string) (*ClassRegistry, error) {
    b, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    var data registryFile
    if err := json.Unmarshal(b, &data); err != nil {
        return nil, err
    }
    reg := NewClassRegistry()
    for name, pair := range data.ByName {
        reg.Add(name, pair[0], pair[1])
    }
    return reg, nil
}
```

**Step 4: Run test to verify pass**

Run: `cd cli && go test ./internal/convert/ -run TestClassRegistry_SaveLoad -v`
Expected: PASS

**Step 5: Commit**

```bash
git add cli/internal/convert/classregistry.go cli/internal/convert/classregistry_test.go
git commit -m "feat(cli): add ClassRegistry JSON cache save/load"
```

---

### Task 4: Enhanced HTML Converter — ACSS Class Resolution

Rewrite `HTMLToBricks` to resolve CSS class names against the ClassRegistry.

**Files:**
- Modify: `cli/internal/convert/html.go`
- Modify: `cli/internal/convert/html_test.go`

**Step 1: Write failing test**

```go
func TestHTMLToBricks_ACSSlasses(t *testing.T) {
    reg := NewClassRegistry()
    reg.Add("height--full", "acss_import_height--full", "acss")
    reg.Add("bg--ultra-dark", "acss_import_bg--ultra-dark", "acss")
    reg.Add("fr-lede", "kddjfd", "frames")

    html := `<section class="height--full bg--ultra-dark">
        <h1>Hello</h1>
        <p class="fr-lede my-custom">Text</p>
    </section>`

    elements, err := HTMLToBricksWithRegistry(html, reg)
    if err != nil {
        t.Fatal(err)
    }

    // Section should have _cssGlobalClasses with resolved IDs
    section := elements[0]
    settings, _ := section["settings"].(map[string]interface{})
    globalClasses, _ := settings["_cssGlobalClasses"].([]interface{})
    if len(globalClasses) != 2 {
        t.Fatalf("expected 2 global classes, got %d", len(globalClasses))
    }

    // Paragraph should have fr-lede resolved + my-custom as _cssClasses
    var para map[string]interface{}
    for _, el := range elements {
        if n, _ := el["name"].(string); n == "text-basic" {
            para = el
            break
        }
    }
    pSettings, _ := para["settings"].(map[string]interface{})
    pGlobal, _ := pSettings["_cssGlobalClasses"].([]interface{})
    if len(pGlobal) != 1 || pGlobal[0] != "kddjfd" {
        t.Errorf("expected [kddjfd], got %v", pGlobal)
    }
    pCustom, _ := pSettings["_cssClasses"].(string)
    if pCustom != "my-custom" {
        t.Errorf("expected 'my-custom', got %q", pCustom)
    }
}
```

**Step 2: Run test to verify fail**

Run: `cd cli && go test ./internal/convert/ -run TestHTMLToBricks_ACSS -v`
Expected: FAIL — `HTMLToBricksWithRegistry` undefined

**Step 3: Implement `HTMLToBricksWithRegistry`**

Add new function to `html.go` that uses registry for class resolution. Refactor `extractSettings` to accept a registry and split CSS classes into `_cssGlobalClasses` (resolved) and `_cssClasses` (unresolved). Keep original `HTMLToBricks` as a wrapper that passes a nil registry for backwards compat.

Key changes in `extractSettings`:
```go
case "class":
    classes := strings.Fields(attr.Val)
    var globalIDs []interface{}
    var customClasses []string
    for _, cls := range classes {
        if registry != nil {
            if id, _, ok := registry.Lookup(cls); ok {
                globalIDs = append(globalIDs, id)
                continue
            }
        }
        customClasses = append(customClasses, cls)
    }
    if len(globalIDs) > 0 {
        settings["_cssGlobalClasses"] = globalIDs
    }
    if len(customClasses) > 0 {
        settings["_cssClasses"] = strings.Join(customClasses, " ")
    }
```

**Step 4: Run all convert tests**

Run: `cd cli && go test ./internal/convert/ -v`
Expected: ALL PASS (including original tests — backwards compat)

**Step 5: Commit**

```bash
git add cli/internal/convert/html.go cli/internal/convert/html_test.go
git commit -m "feat(cli): ACSS-aware HTML converter with class registry lookup"
```

---

### Task 5: Enhanced HTML Converter — Inline Style Extraction

Parse `style` attributes and map CSS properties to Bricks settings.

**Files:**
- Create: `cli/internal/convert/styles.go`
- Create: `cli/internal/convert/styles_test.go`

**Step 1: Write failing test**

```go
// cli/internal/convert/styles_test.go
package convert

import "testing"

func TestParseInlineStyles(t *testing.T) {
    style := "color: var(--primary); padding: var(--space-m); background-color: var(--bg-dark); gap: 20px; max-width: var(--content-width)"

    settings := ParseInlineStyles(style)

    // Typography color
    typo, _ := settings["_typography"].(map[string]interface{})
    color, _ := typo["color"].(map[string]interface{})
    if color["raw"] != "var(--primary)" {
        t.Errorf("expected var(--primary), got %v", color["raw"])
    }

    // Padding
    pad, _ := settings["_padding"].(map[string]interface{})
    if pad["top"] != "var(--space-m)" {
        t.Errorf("expected var(--space-m), got %v", pad["top"])
    }

    // Background
    bg, _ := settings["_background"].(map[string]interface{})
    bgColor, _ := bg["color"].(map[string]interface{})
    if bgColor["raw"] != "var(--bg-dark)" {
        t.Errorf("expected var(--bg-dark), got %v", bgColor["raw"])
    }

    // Gap
    if settings["_gap"] != "20px" {
        t.Errorf("expected 20px, got %v", settings["_gap"])
    }

    // Max width
    if settings["_maxWidth"] != "var(--content-width)" {
        t.Errorf("expected var(--content-width), got %v", settings["_maxWidth"])
    }
}
```

**Step 2: Run to verify fail**

Run: `cd cli && go test ./internal/convert/ -run TestParseInlineStyles -v`
Expected: FAIL — `ParseInlineStyles` undefined

**Step 3: Implement**

```go
// cli/internal/convert/styles.go
package convert

import "strings"

// ParseInlineStyles converts a CSS style string to Bricks settings.
func ParseInlineStyles(style string) map[string]interface{} {
    settings := make(map[string]interface{})
    pairs := strings.Split(style, ";")

    for _, pair := range pairs {
        pair = strings.TrimSpace(pair)
        if pair == "" {
            continue
        }
        parts := strings.SplitN(pair, ":", 2)
        if len(parts) != 2 {
            continue
        }
        prop := strings.TrimSpace(parts[0])
        val := strings.TrimSpace(parts[1])

        switch prop {
        case "color":
            ensureTypo(settings)["color"] = map[string]interface{}{"raw": val}
        case "font-size":
            ensureTypo(settings)["font-size"] = val
        case "font-weight":
            ensureTypo(settings)["font-weight"] = val
        case "text-align":
            ensureTypo(settings)["text-align"] = val
        case "line-height":
            ensureTypo(settings)["line-height"] = val
        case "letter-spacing":
            ensureTypo(settings)["letter-spacing"] = val
        case "font-style":
            ensureTypo(settings)["font-style"] = val
        case "text-transform":
            ensureTypo(settings)["text-transform"] = val
        case "padding":
            settings["_padding"] = expandBoxShorthand(val)
        case "padding-top":
            ensurePad(settings)["top"] = val
        case "padding-bottom":
            ensurePad(settings)["bottom"] = val
        case "padding-left":
            ensurePad(settings)["left"] = val
        case "padding-right":
            ensurePad(settings)["right"] = val
        case "margin":
            settings["_margin"] = expandBoxShorthand(val)
        case "margin-top":
            ensureMargin(settings)["top"] = val
        case "margin-bottom":
            ensureMargin(settings)["bottom"] = val
        case "background-color", "background":
            settings["_background"] = map[string]interface{}{
                "color": map[string]interface{}{"raw": val},
            }
        case "gap":
            settings["_gap"] = val
        case "row-gap":
            settings["_rowGap"] = val
        case "column-gap":
            settings["_columnGap"] = val
        case "max-width":
            settings["_maxWidth"] = val
        case "width":
            settings["_width"] = val
        case "display":
            settings["_display"] = val
        case "flex-direction":
            settings["_direction"] = val
        case "align-items":
            settings["_alignItems"] = val
        case "justify-content":
            settings["_justifyContent"] = val
        }
    }
    return settings
}

func ensureTypo(s map[string]interface{}) map[string]interface{} {
    if t, ok := s["_typography"].(map[string]interface{}); ok {
        return t
    }
    t := make(map[string]interface{})
    s["_typography"] = t
    return t
}

func ensurePad(s map[string]interface{}) map[string]interface{} {
    if p, ok := s["_padding"].(map[string]interface{}); ok {
        return p
    }
    p := make(map[string]interface{})
    s["_padding"] = p
    return p
}

func ensureMargin(s map[string]interface{}) map[string]interface{} {
    if m, ok := s["_margin"].(map[string]interface{}); ok {
        return m
    }
    m := make(map[string]interface{})
    s["_margin"] = m
    return m
}

func expandBoxShorthand(val string) map[string]interface{} {
    parts := strings.Fields(val)
    switch len(parts) {
    case 1:
        return map[string]interface{}{"top": parts[0], "right": parts[0], "bottom": parts[0], "left": parts[0]}
    case 2:
        return map[string]interface{}{"top": parts[0], "right": parts[1], "bottom": parts[0], "left": parts[1]}
    case 4:
        return map[string]interface{}{"top": parts[0], "right": parts[1], "bottom": parts[2], "left": parts[3]}
    default:
        return map[string]interface{}{"top": val, "right": val, "bottom": val, "left": val}
    }
}
```

**Step 4: Run tests**

Run: `cd cli && go test ./internal/convert/ -run TestParseInlineStyles -v`
Expected: PASS

**Step 5: Wire into HTML converter**

In `html.go`, in the `extractSettings` function, add `style` attribute handling:
```go
case "style":
    styleSettings := ParseInlineStyles(attr.Val)
    for k, v := range styleSettings {
        settings[k] = v
    }
```

**Step 6: Run all convert tests**

Run: `cd cli && go test ./internal/convert/ -v`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add cli/internal/convert/styles.go cli/internal/convert/styles_test.go cli/internal/convert/html.go
git commit -m "feat(cli): parse inline styles to Bricks settings in HTML converter"
```

---

### Task 6: Convert HTML Command — Add --push, --stdin, --class-cache flags

Wire the enhanced converter into the CLI command with new flags.

**Files:**
- Modify: `cli/cmd/convert.go`
- Modify: `cli/internal/client/client.go` (add `ListAllClasses` method)

**Step 1: Add `ListAllClasses` to client**

Add to `client.go`:
```go
// ListAllClasses fetches all global classes (both ACSS and custom).
func (c *Client) ListAllClasses() ([]map[string]interface{}, error) {
    resp, err := c.do("GET", "/classes", nil)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    var result struct {
        Classes []map[string]interface{} `json:"classes"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return result.Classes, nil
}
```

**Step 2: Rewrite `convert.go` with new flags**

```go
var (
    convertOutput    string
    convertPush      int
    convertStdin     bool
    convertClassCache bool
    convertSnapshot  bool
    convertDryRun    bool
)

var convertHTMLCmd = &cobra.Command{
    Use:   "html [file.html]",
    Short: "Convert HTML to Bricks element JSON",
    Long:  "Convert HTML to Bricks elements with ACSS class resolution. Use --push to send directly to a page.",
    Args:  cobra.MaximumNArgs(1),
    RunE: func(cmd *cobra.Command, args []string) error {
        // Read HTML from file or stdin
        var htmlData []byte
        var err error
        if convertStdin || len(args) == 0 {
            htmlData, err = io.ReadAll(os.Stdin)
        } else {
            htmlData, err = os.ReadFile(args[0])
        }
        if err != nil {
            return fmt.Errorf("failed to read input: %w", err)
        }

        // Build class registry (from cache or API)
        var registry *convert.ClassRegistry
        cfg := loadConfig()
        if cfg != nil && cfg.SiteURL != "" && cfg.APIKey != "" {
            c := client.New(cfg.SiteURL, cfg.APIKey)
            cachePath := filepath.Join(configDir(), "class-registry.json")

            if convertClassCache {
                if reg, err := convert.LoadRegistryFromFile(cachePath); err == nil {
                    registry = reg
                    fmt.Fprintf(os.Stderr, "Using cached class registry (%d classes)\n", reg.Stats().Total)
                }
            }

            if registry == nil {
                classes, err := c.ListAllClasses()
                if err != nil {
                    fmt.Fprintf(os.Stderr, "Warning: could not fetch classes: %v\n", err)
                } else {
                    registry = convert.BuildRegistryFromClasses(classes)
                    fmt.Fprintf(os.Stderr, "Loaded %d classes (ACSS: %d, Frames: %d)\n",
                        registry.Stats().Total, registry.Stats().ACSS, registry.Stats().Frames)
                    // Save cache
                    _ = registry.SaveToFile(cachePath, cfg.SiteURL)
                }
            }
        }

        // Convert
        elements, err := convert.HTMLToBricksWithRegistry(string(htmlData), registry)
        if err != nil {
            return fmt.Errorf("conversion failed: %w", err)
        }

        // Push to page or output JSON
        if convertPush > 0 && !convertDryRun {
            // ... push logic using client.ReplaceElements
        }

        // Output
        output := map[string]interface{}{"elements": elements, "count": len(elements)}
        jsonData, _ := json.MarshalIndent(output, "", "  ")

        if convertOutput != "" {
            os.WriteFile(convertOutput, jsonData, 0644)
            fmt.Printf("Converted %d elements → %s\n", len(elements), convertOutput)
        } else if convertPush == 0 {
            fmt.Println(string(jsonData))
        }
        return nil
    },
}
```

Register flags:
```go
func init() {
    convertHTMLCmd.Flags().StringVarP(&convertOutput, "output", "o", "", "output file path")
    convertHTMLCmd.Flags().IntVar(&convertPush, "push", 0, "push to page ID after converting")
    convertHTMLCmd.Flags().BoolVar(&convertStdin, "stdin", false, "read HTML from stdin")
    convertHTMLCmd.Flags().BoolVar(&convertClassCache, "class-cache", false, "use cached class registry")
    convertHTMLCmd.Flags().BoolVar(&convertSnapshot, "snapshot", false, "create snapshot before pushing")
    convertHTMLCmd.Flags().BoolVar(&convertDryRun, "dry-run", false, "show result without pushing")
    convertCmd.AddCommand(convertHTMLCmd)
    rootCmd.AddCommand(convertCmd)
}
```

**Step 3: Build and verify**

Run: `cd cli && go build -o /tmp/bricks-test .`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add cli/cmd/convert.go cli/internal/client/client.go
git commit -m "feat(cli): add --push, --stdin, --class-cache to convert html"
```

---

### Task 7: Agent Context — Core Builder

Build the context builder that assembles all site data into structured output.

**Files:**
- Create: `cli/internal/agent/context.go`
- Create: `cli/internal/agent/context_test.go`

**Step 1: Write failing test**

```go
// cli/internal/agent/context_test.go
package agent

import "testing"

func TestContextBuilder_Markdown(t *testing.T) {
    b := NewContextBuilder()
    b.SetSiteInfo("2.2", "6.9.1", "1.3.0")
    b.AddACSSTokens(map[string]interface{}{
        "primary": "#76B82A",
        "spacing": "var(--space-m)",
    })
    b.AddClasses([]ClassInfo{
        {Name: "height--full", ID: "acss_import_height--full", Source: "acss", Category: "sizing"},
        {Name: "fr-lede", ID: "kddjfd", Source: "frames", Category: "typography"},
    })
    b.AddTemplates([]TemplateInfo{
        {Title: "Hero Cali", Slug: "hero-cali", Category: "hero", ElementCount: 13},
    })

    md := b.RenderMarkdown()

    if !containsAll(md, "Bricks 2.2", "height--full", "fr-lede", "Hero Cali", "#76B82A") {
        t.Errorf("markdown missing expected content:\n%s", md[:500])
    }
}

func TestContextBuilder_Prompt(t *testing.T) {
    b := NewContextBuilder()
    b.SetSiteInfo("2.2", "6.9.1", "1.3.0")

    prompt := b.RenderPrompt()

    if !containsAll(prompt, "You are a web designer", "Bricks Builder", "semantic HTML") {
        t.Errorf("prompt missing expected instructions:\n%s", prompt[:500])
    }
}

func containsAll(s string, subs ...string) bool {
    for _, sub := range subs {
        if !strings.Contains(s, sub) {
            return false
        }
    }
    return true
}
```

**Step 2: Run to verify fail**

Run: `cd cli && go test ./internal/agent/ -v`
Expected: FAIL — package not found

**Step 3: Implement context builder**

Create `cli/internal/agent/context.go` with `ContextBuilder` struct that has methods for each data section, and `RenderMarkdown()`, `RenderJSON()`, `RenderPrompt()` output formatters.

Key design:
- `ClassInfo` struct: Name, ID, Source, Category
- `TemplateInfo` struct: Title, Slug, Category, Type, ElementCount
- Markdown output: headers + tables + code blocks
- Prompt output: system instructions + all context sections
- JSON output: structured `map[string]interface{}`

The `RenderMarkdown()` should produce:
```markdown
# Bricks Site Context

## Site
- Bricks: 2.2 | WordPress: 6.9.1 | Plugin: 1.3.0

## ACSS Design Tokens
| Token | Value |
|-------|-------|
| primary | #76B82A |
...

## Utility Classes (ACSS)
### Sizing
- `height--full`
...

## Component Classes (Frames)
### Typography
- `fr-lede`
...

## Templates (452)
### hero (17 templates)
- hero-cali (13 elements)
...

## Workflows
1. Write HTML with ACSS classes → `bricks convert html --push <id>`
2. Compose from templates → `bricks templates compose <slugs> --push <id>`
3. Generate with AI → `bricks generate page --page <id>`
```

**Step 4: Run tests**

Run: `cd cli && go test ./internal/agent/ -v`
Expected: PASS

**Step 5: Commit**

```bash
git add cli/internal/agent/context.go cli/internal/agent/context_test.go
git commit -m "feat(cli): agent context builder with md/json/prompt output"
```

---

### Task 8: Agent Command — CLI Wiring

Wire the agent context builder to a `bricks agent context` CLI command.

**Files:**
- Create: `cli/cmd/agent.go`

**Step 1: Implement command**

```go
// cli/cmd/agent.go
package cmd

// bricks agent context [--format md|json|prompt] [--section tokens|classes|templates|workflows] [--compact]

var agentCmd = &cobra.Command{
    Use:   "agent",
    Short: "AI agent integration tools",
}

var agentContextCmd = &cobra.Command{
    Use:   "context",
    Short: "Dump site context for LLM consumption",
    Long: `Queries the live site and outputs structured context that LLMs can use
to generate ACSS-compliant HTML for Bricks Builder pages.

Formats:
  md      Markdown (default) — for LLM context windows
  json    Structured JSON — for programmatic use
  prompt  Complete LLM system prompt with instructions + context`,
    RunE: func(cmd *cobra.Command, args []string) error {
        // 1. Load config, create client
        // 2. Fetch site info, frameworks, classes
        // 3. Load template catalog
        // 4. Build ContextBuilder
        // 5. Render in requested format
        // 6. Output to stdout or file
    },
}
```

Register flags: `--format`, `--section`, `--compact`, `--output`

**Step 2: Build and test manually**

Run: `cd cli && go build -o /tmp/bricks-test . && /tmp/bricks-test agent context --format md | head -50`
Expected: Shows markdown context with site data

**Step 3: Commit**

```bash
git add cli/cmd/agent.go
git commit -m "feat(cli): add 'bricks agent context' command"
```

---

### Task 9: Template Compose — Frames Library Support

Enhance the template catalog to load the Frames-format templates (with `bricksExport` wrapper) and add the search/compose commands.

**Files:**
- Modify: `cli/internal/templates/catalog.go`
- Modify: `cli/internal/templates/composer.go`
- Modify: `cli/cmd/templates.go`

**Step 1: Add Frames format loading to catalog**

The existing `Template` struct expects `{name, elements}` but Frames templates use `{title, bricksExport: {content, globalClasses}}`. Add a loader that handles both.

**Step 2: Add `search` subcommand to templates**

`bricks templates search <keyword>` — searches catalog.json by title, category, and slug. Returns matches with element count.

**Step 3: Enhance `compose` to handle global classes**

When composing, merge `globalClasses` arrays from each template, deduplicating by class name (keep first definition). Include merged classes in output.

**Step 4: Add `--push` flag to compose**

`bricks templates compose hero-cali content-section-alpha --push 1460`

**Step 5: Run tests**

Run: `cd cli && go test ./internal/templates/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add cli/internal/templates/ cli/cmd/templates.go
git commit -m "feat(cli): Frames template support with search and compose --push"
```

---

### Task 10: Alumni Page Fix

Use the new tools to rebuild the alumni page with proper site styling.

**Files:**
- Create: `/tmp/alumni-v2.html` (HTML with ACSS/Frames classes)

**Step 1: Write ACSS-compliant HTML for alumni page**

Write semantic HTML using ACSS utility classes and Frames component classes discovered from the site's actual design system (fr-lede, bg--ultra-dark, grid--auto-2, etc.).

**Step 2: Convert and push**

```bash
bricks convert html /tmp/alumni-v2.html --push 1460 --snapshot
```

**Step 3: Verify in browser**

Open `https://ts-staging.wavedepth.com/?page_id=1460&preview=true` and confirm it matches the site's design language.

**Step 4: Commit any supporting files**

---

### Task 11: README Update

Write a comprehensive, humanized, technically verbose, LLM-friendly README.

**Files:**
- Modify: `README.md`

**Content:**
- Project overview (what agent-to-bricks does)
- Architecture diagram (plugin + CLI)
- Quick start guide
- Agent workflow (context → write HTML → convert → push)
- Template library (452 Frames templates, search, compose)
- ACSS integration (class resolution, design tokens)
- CLI command reference (all commands with examples)
- Plugin REST API reference (all endpoints)
- Contributing guide

**Style:** Clear, conversational, technically precise. Written so both humans and LLMs can understand the project fully.

**Step 1: Write README**

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: comprehensive README with agent workflow and CLI reference"
```

---

### Task 12: Build, Test, Push

**Step 1: Run all tests**

```bash
cd cli && go test ./... -v
```
Expected: ALL PASS

**Step 2: Build**

```bash
cd cli && go build -o ~/bin/bricks .
```

**Step 3: Push to git**

```bash
git push origin main
```
