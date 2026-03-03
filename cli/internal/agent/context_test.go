// cli/internal/agent/context_test.go
package agent

import (
	"strings"
	"testing"
)

func TestContextBuilder_Markdown(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.9.1", "1.3.0")
	b.AddACSSTokens(map[string]interface{}{
		"primary-hsl":   "90, 54%, 44%",
		"spacing-scale": "1.5",
	})
	b.AddClasses([]ClassInfo{
		{Name: "height--full", ID: "acss_import_height--full", Source: "acss", Category: "sizing"},
		{Name: "bg--ultra-dark", ID: "acss_import_bg--ultra-dark", Source: "acss", Category: "backgrounds"},
		{Name: "fr-lede", ID: "kddjfd", Source: "frames", Category: "typography"},
	})
	b.AddTemplates([]TemplateInfo{
		{Name: "Hero Cali", Slug: "hero-cali", Category: "hero", ElementCount: 13},
		{Name: "Hero Barcelona", Slug: "hero-barcelona", Category: "hero", ElementCount: 8},
	})

	md := b.RenderMarkdown()

	expected := []string{
		"# Bricks Site Context",
		"Bricks: 2.2",
		"WordPress: 6.9.1",
		"height--full",
		"bg--ultra-dark",
		"fr-lede",
		"Hero Cali",
		"## Utility Classes (ACSS)",
		"## Component Classes (Frames)",
		"## Templates",
		"## Workflows",
	}
	for _, s := range expected {
		if !strings.Contains(md, s) {
			t.Errorf("markdown missing %q", s)
		}
	}
}

func TestContextBuilder_JSON(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.9.1", "1.3.0")
	b.AddClasses([]ClassInfo{
		{Name: "height--full", ID: "acss_import_height--full", Source: "acss", Category: "sizing"},
	})

	jsonStr := b.RenderJSON()

	expected := []string{
		`"bricksVersion"`,
		`"height--full"`,
		`"acss"`,
	}
	for _, s := range expected {
		if !strings.Contains(jsonStr, s) {
			t.Errorf("JSON missing %q", s)
		}
	}
}

func TestContextBuilder_Prompt(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.9.1", "1.3.0")
	b.AddClasses([]ClassInfo{
		{Name: "height--full", ID: "acss_import_height--full", Source: "acss", Category: "sizing"},
	})

	prompt := b.RenderPrompt()

	expected := []string{
		"You are a web designer",
		"Bricks Builder",
		"ACSS",
		"semantic HTML",
		"Rules",
		"height--full",
		"bricks convert html",
		"bricks templates compose",
	}
	for _, s := range expected {
		if !strings.Contains(prompt, s) {
			t.Errorf("prompt missing %q", s)
		}
	}
}

func TestContextBuilder_Section(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.9.1", "1.3.0")
	b.AddClasses([]ClassInfo{
		{Name: "height--full", ID: "acss_import_height--full", Source: "acss", Category: "sizing"},
	})
	b.AddTemplates([]TemplateInfo{
		{Name: "Hero Cali", Slug: "hero-cali", Category: "hero", ElementCount: 13},
	})

	// Request only classes section
	section := b.RenderSection("classes")
	if !strings.Contains(section, "height--full") {
		t.Error("classes section missing class names")
	}
	if strings.Contains(section, "Hero Cali") {
		t.Error("classes section should NOT contain templates")
	}

	// Request only templates section
	section = b.RenderSection("templates")
	if !strings.Contains(section, "Hero Cali") {
		t.Error("templates section missing template names")
	}
}

func TestContextBuilder_Abilities(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.9.1", "1.7.0")
	b.AddAbilities([]AbilityInfo{
		{
			Name:          "agent-bricks/get-site-info",
			Label:         "Get Site Info",
			Description:   "Returns Bricks version info",
			Category:      "agent-bricks-site",
			CategoryLabel: "Bricks Site Info",
			Readonly:      true,
		},
		{
			Name:          "yoast/get-seo-meta",
			Label:         "Get SEO Meta",
			Description:   "Returns SEO metadata for a post",
			Category:      "seo",
			CategoryLabel: "SEO",
			Readonly:      true,
			InputHint:     `{"post_id": <integer>}`,
		},
	})

	// Markdown should include abilities
	md := b.RenderMarkdown()
	expected := []string{
		"## WordPress Abilities",
		"plugins register \"abilities\"",
		"named actions that any AI agent",
		"agent-bricks/get-site-info",
		"yoast/get-seo-meta",
		"Get SEO Meta",
		"GET ",
		"/wp-json/wp-abilities/v1/",
	}
	for _, s := range expected {
		if !strings.Contains(md, s) {
			t.Errorf("markdown missing %q", s)
		}
	}

	// JSON should include abilities
	jsonStr := b.RenderJSON()
	jsonExpected := []string{
		`"abilities"`,
		`"yoast/get-seo-meta"`,
		`"seo"`,
	}
	for _, s := range jsonExpected {
		if !strings.Contains(jsonStr, s) {
			t.Errorf("JSON missing %q", s)
		}
	}

	// Prompt should include abilities with explanation
	prompt := b.RenderPrompt()
	promptExpected := []string{
		"WordPress Abilities",
		"plugins register \"abilities\"",
		"named actions",
		"Why abilities matter",
		"When to use abilities vs. the ATB REST API",
		"agent-bricks/get-site-info",
		"yoast/get-seo-meta",
		"/wp-abilities/v1/",
	}
	for _, s := range promptExpected {
		if !strings.Contains(prompt, s) {
			t.Errorf("prompt missing %q", s)
		}
	}

	// Section render
	section := b.RenderSection("abilities")
	if !strings.Contains(section, "yoast/get-seo-meta") {
		t.Error("abilities section missing ability name")
	}
}

func TestContextBuilder_NoAbilities(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.4", "1.7.0")
	// No abilities added — should not include section
	md := b.RenderMarkdown()
	if strings.Contains(md, "WordPress Abilities") {
		t.Error("should not include abilities section when none are set")
	}
}

func TestContextBuilder_Compact(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.9.1", "1.3.0")
	b.AddClasses([]ClassInfo{
		{Name: "height--full", ID: "acss_import_height--full", Source: "acss", Category: "sizing"},
	})

	full := b.RenderMarkdown()
	b.SetCompact(true)
	compact := b.RenderMarkdown()

	if len(compact) >= len(full) {
		t.Errorf("compact (%d chars) should be shorter than full (%d chars)", len(compact), len(full))
	}
}
