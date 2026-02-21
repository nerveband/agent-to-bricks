package agent

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// ClassInfo represents a global CSS class for context output.
type ClassInfo struct {
	Name     string
	ID       string
	Source   string // "acss" or "frames"
	Category string
}

// TemplateInfo represents a template for context output.
type TemplateInfo struct {
	Name         string
	Slug         string
	Category     string
	ElementCount int
}

// ContextBuilder assembles site data for LLM consumption.
type ContextBuilder struct {
	bricksVersion string
	wpVersion     string
	pluginVersion string
	acssTokens    map[string]interface{}
	classes       []ClassInfo
	templates     []TemplateInfo
	compact       bool
}

// NewContextBuilder creates a new context builder.
func NewContextBuilder() *ContextBuilder {
	return &ContextBuilder{}
}

func (b *ContextBuilder) SetSiteInfo(bricks, wp, plugin string) {
	b.bricksVersion = bricks
	b.wpVersion = wp
	b.pluginVersion = plugin
}

func (b *ContextBuilder) AddACSSTokens(tokens map[string]interface{}) {
	b.acssTokens = tokens
}

func (b *ContextBuilder) AddClasses(classes []ClassInfo) {
	b.classes = append(b.classes, classes...)
}

func (b *ContextBuilder) AddTemplates(templates []TemplateInfo) {
	b.templates = append(b.templates, templates...)
}

func (b *ContextBuilder) SetCompact(compact bool) {
	b.compact = compact
}

// RenderMarkdown produces the full markdown context document.
func (b *ContextBuilder) RenderMarkdown() string {
	var sb strings.Builder

	sb.WriteString("# Bricks Site Context\n\n")
	b.writeSiteSection(&sb)
	if b.acssTokens != nil {
		b.writeTokensSection(&sb)
	}
	b.writeClassesSection(&sb)
	b.writeTemplatesSection(&sb)
	b.writeWorkflowsSection(&sb)

	return sb.String()
}

// RenderJSON produces structured JSON output.
func (b *ContextBuilder) RenderJSON() string {
	data := map[string]interface{}{
		"bricksVersion": b.bricksVersion,
		"wpVersion":     b.wpVersion,
		"pluginVersion": b.pluginVersion,
	}

	if b.acssTokens != nil {
		data["acssTokens"] = b.acssTokens
	}

	// Group classes by source
	acssClasses := []map[string]string{}
	framesClasses := []map[string]string{}
	for _, c := range b.classes {
		entry := map[string]string{"name": c.Name, "id": c.ID, "source": c.Source, "category": c.Category}
		if c.Source == "acss" {
			acssClasses = append(acssClasses, entry)
		} else {
			framesClasses = append(framesClasses, entry)
		}
	}
	data["acssClasses"] = acssClasses
	data["framesClasses"] = framesClasses

	// Templates
	tmplData := []map[string]interface{}{}
	for _, t := range b.templates {
		tmplData = append(tmplData, map[string]interface{}{
			"name":     t.Name,
			"slug":     t.Slug,
			"category": t.Category,
			"elements": t.ElementCount,
		})
	}
	data["templates"] = tmplData

	jsonBytes, _ := json.MarshalIndent(data, "", "  ")
	return string(jsonBytes)
}

// RenderPrompt generates a complete LLM system prompt.
func (b *ContextBuilder) RenderPrompt() string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf(`You are a web designer for a Bricks Builder %s site using Automatic.css (ACSS).

When generating page content, write semantic HTML using the ACSS utility classes
and Frames component classes listed below. The HTML will be converted to Bricks
elements by the CLI tool "agent-to-bricks".

## Rules
- Use ACSS utility classes for layout, spacing, colors, typography
- Use Frames component classes (fr-*, btn--*) for pre-built patterns
- Use CSS variables (--primary, --space-m, etc.) for inline styles
- Wrap page sections in <section> tags
- Use semantic HTML (h1-h6, p, ul, figure, blockquote, etc.)
- Keep HTML clean — the converter handles Bricks-specific settings
- For images, use <img> with descriptive alt text
- For links, use <a> tags with href attributes

## Converting HTML to Bricks
Run: bricks convert html <file.html> --push <page-id>
Or pipe: echo "<html>" | bricks convert html --stdin --push <page-id>

## Using Templates
Search: bricks templates search "hero"
Compose: bricks templates compose hero-cali content-alpha cta-bravo --push <page-id>

`, b.bricksVersion))

	// Add context sections
	sb.WriteString("## Available Design Tokens\n")
	if b.acssTokens != nil {
		for k, v := range b.acssTokens {
			sb.WriteString(fmt.Sprintf("- `%s`: %v\n", k, v))
		}
	}
	sb.WriteString("\n")

	sb.WriteString("## Available Classes\n\n")
	b.writeClassesSection(&sb)

	sb.WriteString("## Available Templates\n\n")
	b.writeTemplatesSection(&sb)

	return sb.String()
}

// RenderSection renders only a specific section.
func (b *ContextBuilder) RenderSection(section string) string {
	var sb strings.Builder
	switch section {
	case "tokens":
		b.writeTokensSection(&sb)
	case "classes":
		b.writeClassesSection(&sb)
	case "templates":
		b.writeTemplatesSection(&sb)
	case "workflows":
		b.writeWorkflowsSection(&sb)
	case "site":
		b.writeSiteSection(&sb)
	}
	return sb.String()
}

func (b *ContextBuilder) writeSiteSection(sb *strings.Builder) {
	sb.WriteString("## Site\n")
	sb.WriteString(fmt.Sprintf("- Bricks: %s | WordPress: %s | Plugin: %s\n\n",
		b.bricksVersion, b.wpVersion, b.pluginVersion))
}

func (b *ContextBuilder) writeTokensSection(sb *strings.Builder) {
	sb.WriteString("## ACSS Design Tokens\n")
	if b.acssTokens != nil {
		keys := make([]string, 0, len(b.acssTokens))
		for k := range b.acssTokens {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		if !b.compact {
			sb.WriteString("| Token | Value |\n|-------|-------|\n")
			for _, k := range keys {
				sb.WriteString(fmt.Sprintf("| %s | %v |\n", k, b.acssTokens[k]))
			}
		} else {
			for _, k := range keys {
				sb.WriteString(fmt.Sprintf("- `%s`: %v\n", k, b.acssTokens[k]))
			}
		}
	}
	sb.WriteString("\n")
}

func (b *ContextBuilder) writeClassesSection(sb *strings.Builder) {
	// Group by source then category
	acss := groupByCategory(b.classes, "acss")
	frames := groupByCategory(b.classes, "frames")

	if len(acss) > 0 {
		sb.WriteString("## Utility Classes (ACSS)\n")
		writeClassGroups(sb, acss, b.compact)
	}

	if len(frames) > 0 {
		sb.WriteString("## Component Classes (Frames)\n")
		writeClassGroups(sb, frames, b.compact)
	}
}

func (b *ContextBuilder) writeTemplatesSection(sb *strings.Builder) {
	if len(b.templates) == 0 {
		return
	}

	sb.WriteString(fmt.Sprintf("## Templates (%d)\n", len(b.templates)))

	// Group by category
	cats := make(map[string][]TemplateInfo)
	for _, t := range b.templates {
		cats[t.Category] = append(cats[t.Category], t)
	}

	keys := make([]string, 0, len(cats))
	for k := range cats {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, cat := range keys {
		tmpls := cats[cat]
		sb.WriteString(fmt.Sprintf("### %s (%d)\n", cat, len(tmpls)))
		for _, t := range tmpls {
			if b.compact {
				sb.WriteString(fmt.Sprintf("- %s (%d el)\n", t.Slug, t.ElementCount))
			} else {
				sb.WriteString(fmt.Sprintf("- **%s** (`%s`) — %d elements\n", t.Name, t.Slug, t.ElementCount))
			}
		}
	}
	sb.WriteString("\n")
}

func (b *ContextBuilder) writeWorkflowsSection(sb *strings.Builder) {
	sb.WriteString("## Workflows\n\n")
	sb.WriteString("### 1. HTML Convert (Recommended for custom pages)\n")
	sb.WriteString("Write semantic HTML with ACSS classes, then convert:\n")
	sb.WriteString("```bash\n")
	sb.WriteString("bricks convert html page.html --push <page-id>\n")
	sb.WriteString("```\n\n")
	sb.WriteString("### 2. Template Compose (For standard layouts)\n")
	sb.WriteString("Search and compose from the Frames template library:\n")
	sb.WriteString("```bash\n")
	sb.WriteString("bricks templates search \"hero\"\n")
	sb.WriteString("bricks templates compose hero-cali content-alpha --push <page-id>\n")
	sb.WriteString("```\n\n")
	sb.WriteString("### 3. AI Generate (For rapid prototyping)\n")
	sb.WriteString("Generate content with AI and push to page:\n")
	sb.WriteString("```bash\n")
	sb.WriteString("bricks generate page --page <page-id> --prompt \"Create an about page\"\n")
	sb.WriteString("```\n\n")
}

func groupByCategory(classes []ClassInfo, source string) map[string][]ClassInfo {
	groups := make(map[string][]ClassInfo)
	for _, c := range classes {
		if c.Source == source {
			groups[c.Category] = append(groups[c.Category], c)
		}
	}
	return groups
}

func writeClassGroups(sb *strings.Builder, groups map[string][]ClassInfo, compact bool) {
	keys := make([]string, 0, len(groups))
	for k := range groups {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, cat := range keys {
		classes := groups[cat]
		sb.WriteString(fmt.Sprintf("### %s (%d)\n", cat, len(classes)))
		if compact {
			names := make([]string, len(classes))
			for i, c := range classes {
				names[i] = c.Name
			}
			sb.WriteString(strings.Join(names, ", ") + "\n")
		} else {
			for _, c := range classes {
				sb.WriteString(fmt.Sprintf("- `%s`\n", c.Name))
			}
		}
	}
	sb.WriteString("\n")
}
