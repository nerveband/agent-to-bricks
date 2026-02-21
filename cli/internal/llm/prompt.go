package llm

import (
	"fmt"
	"strings"

	"github.com/nerveband/agent-to-bricks/internal/framework"
)

// PromptContext holds all context needed for building LLM prompts.
type PromptContext struct {
	Framework       *framework.Framework
	ElementTypes    []string
	ExistingContent []map[string]interface{} // current page elements for modify
	ExampleElements []map[string]interface{} // RAG examples from templates
}

// BuildSystemPrompt creates the system prompt with full Bricks context.
func BuildSystemPrompt(ctx *PromptContext) string {
	var b strings.Builder

	b.WriteString("You are an expert Bricks Builder element generator. ")
	b.WriteString("You produce valid Bricks element JSON arrays that work directly in Bricks Builder for WordPress.\n\n")

	// Element format
	b.WriteString("## Element Format\n\n")
	b.WriteString("Each element is a JSON object with these fields:\n")
	b.WriteString("- `id`: unique 6-char hex string\n")
	b.WriteString("- `name`: element type (e.g., 'section', 'container', 'heading', 'text-basic', 'button', 'image')\n")
	b.WriteString("- `parent`: parent element ID (0 for root-level sections)\n")
	b.WriteString("- `children`: array of child element IDs\n")
	b.WriteString("- `label`: human-readable label\n")
	b.WriteString("- `settings`: object with element-specific settings\n\n")

	// Nesting rules
	b.WriteString("## Nesting Rules\n\n")
	b.WriteString("- `section` must be at root level (parent: 0)\n")
	b.WriteString("- `container` goes inside section/div/block\n")
	b.WriteString("- Content elements (heading, text-basic, button, image) go inside container/div/block\n")
	b.WriteString("- Always use section > container > content hierarchy\n\n")

	// Available element types
	if len(ctx.ElementTypes) > 0 {
		b.WriteString("## Available Element Types\n\n")
		b.WriteString(strings.Join(ctx.ElementTypes, ", "))
		b.WriteString("\n\n")
	}

	// Framework context
	if ctx.Framework != nil {
		buildFrameworkPrompt(&b, ctx.Framework)
	}

	// Examples
	if len(ctx.ExampleElements) > 0 {
		b.WriteString("## Example Elements (for reference)\n\n")
		b.WriteString("```json\n")
		for i, el := range ctx.ExampleElements {
			if i >= 5 {
				break
			}
			b.WriteString(fmt.Sprintf("%v\n", el))
		}
		b.WriteString("```\n\n")
	}

	// Output format
	b.WriteString("## Output Format\n\n")
	b.WriteString("Return ONLY a JSON object with an `elements` array. No explanation, no markdown fences.\n")
	b.WriteString("Example: {\"elements\": [{\"id\": \"a1b2c3\", \"name\": \"section\", ...}]}\n")

	return b.String()
}

func buildFrameworkPrompt(b *strings.Builder, fw *framework.Framework) {
	b.WriteString(fmt.Sprintf("## CSS Framework: %s\n\n", fw.Name))
	b.WriteString(fmt.Sprintf("This site uses %s. Use its utility classes and CSS variables.\n\n", fw.Name))

	// Spacing
	b.WriteString("### Spacing Variables\n")
	for size, cssVar := range fw.Spacing.Variables {
		b.WriteString(fmt.Sprintf("- %s: `%s`\n", size, cssVar))
	}
	b.WriteString("\n")

	// Colors
	b.WriteString("### Color Variables\n")
	for _, family := range fw.Colors.Families {
		b.WriteString(fmt.Sprintf("- %s: `%s`\n", family, fw.ColorVariable(family)))
	}
	b.WriteString("\n")

	// Buttons
	b.WriteString("### Button Classes\n")
	for _, variant := range fw.Buttons.Variants {
		b.WriteString(fmt.Sprintf("- %s: `%s` (Bricks ID: `%s`)\n",
			variant, fw.ButtonClass(variant), fw.BricksClassID(fw.ButtonClass(variant))))
	}
	b.WriteString("\n")

	// Text sizes
	b.WriteString("### Text Size Classes\n")
	for size, class := range fw.Typography.TextSizes {
		b.WriteString(fmt.Sprintf("- %s: `%s`\n", size, class))
	}
	b.WriteString("\n")

	// Utility classes
	b.WriteString("### Utility Classes (subset)\n")
	classes := fw.AllUtilityClasses()
	if len(classes) > 30 {
		classes = classes[:30]
	}
	b.WriteString(strings.Join(classes, ", "))
	b.WriteString("\n\n")

	b.WriteString("### Applying Classes in Bricks\n")
	b.WriteString("To apply a CSS class to an element, add the Bricks global class ID to `settings._cssGlobalClasses`.\n")
	b.WriteString(fmt.Sprintf("Bricks ID format: `%s{className}`\n\n", fw.BricksClassPrefix))
}

// BuildSectionPrompt creates the user prompt for generating a section.
func BuildSectionPrompt(description string) string {
	return fmt.Sprintf(
		"Generate a Bricks Builder section based on this description:\n\n%s\n\n"+
			"Create a complete section with proper nesting: section > container > content elements. "+
			"Use semantic element types and apply appropriate CSS classes.",
		description,
	)
}

// BuildModifyPrompt creates the user prompt for modifying existing elements.
func BuildModifyPrompt(description string, currentElements []map[string]interface{}) string {
	return fmt.Sprintf(
		"Modify the following Bricks Builder elements based on this instruction:\n\n"+
			"Instruction: %s\n\n"+
			"Current elements (return modified version):\n%v\n\n"+
			"Return the complete modified elements array.",
		description, currentElements,
	)
}

// BuildPagePrompt creates the user prompt for generating a full page.
func BuildPagePrompt(description string) string {
	return fmt.Sprintf(
		"Generate a complete Bricks Builder page based on this description:\n\n%s\n\n"+
			"Create multiple sections with proper structure. "+
			"Include: header/hero, main content sections, and footer. "+
			"Use semantic elements and apply CSS framework classes.",
		description,
	)
}
