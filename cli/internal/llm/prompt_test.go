package llm_test

import (
	"strings"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/framework"
	"github.com/nerveband/agent-to-bricks/internal/llm"
)

func TestBuildSystemPromptBasic(t *testing.T) {
	ctx := &llm.PromptContext{
		ElementTypes: []string{"section", "container", "heading"},
	}

	prompt := llm.BuildSystemPrompt(ctx)

	if !strings.Contains(prompt, "Bricks Builder") {
		t.Error("prompt should mention Bricks Builder")
	}
	if !strings.Contains(prompt, "section") {
		t.Error("prompt should mention section")
	}
	if !strings.Contains(prompt, "elements") {
		t.Error("prompt should mention elements array format")
	}
}

func TestBuildSystemPromptWithFramework(t *testing.T) {
	reg, _ := framework.NewRegistry()
	acss := reg.Get("acss")

	ctx := &llm.PromptContext{
		Framework:    acss,
		ElementTypes: []string{"section", "container", "heading"},
	}

	prompt := llm.BuildSystemPrompt(ctx)

	if !strings.Contains(prompt, "Automatic.css") {
		t.Error("prompt should mention Automatic.css")
	}
	if !strings.Contains(prompt, "--space-m") {
		t.Error("prompt should include spacing variables")
	}
	if !strings.Contains(prompt, "--primary") {
		t.Error("prompt should include color variables")
	}
	if !strings.Contains(prompt, "btn--primary") {
		t.Error("prompt should include button classes")
	}
	if !strings.Contains(prompt, "acss_import_") {
		t.Error("prompt should include Bricks class prefix")
	}
}

func TestBuildSectionPrompt(t *testing.T) {
	prompt := llm.BuildSectionPrompt("dark hero with two CTA buttons")
	if !strings.Contains(prompt, "dark hero") {
		t.Error("prompt should include description")
	}
}

func TestBuildModifyPrompt(t *testing.T) {
	elements := []map[string]interface{}{
		{"id": "e1", "name": "heading"},
	}
	prompt := llm.BuildModifyPrompt("make the heading larger", elements)
	if !strings.Contains(prompt, "make the heading larger") {
		t.Error("prompt should include instruction")
	}
}

func TestBuildPagePrompt(t *testing.T) {
	prompt := llm.BuildPagePrompt("SaaS landing page")
	if !strings.Contains(prompt, "SaaS landing page") {
		t.Error("prompt should include description")
	}
	if !strings.Contains(prompt, "hero") {
		t.Error("prompt should mention hero section")
	}
}
