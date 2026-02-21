package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/nerveband/agent-to-bricks/internal/framework"
	"github.com/nerveband/agent-to-bricks/internal/llm"
	"github.com/nerveband/agent-to-bricks/internal/validator"
	"github.com/spf13/cobra"
)

var (
	genPageID    int
	genFramework string
	genDryRun    bool
	genOutput    string
)

func newLLMClient() *llm.Client {
	return llm.NewClient(
		cfg.LLM.Provider,
		cfg.LLM.APIKey,
		cfg.LLM.Model,
		cfg.LLM.BaseURL,
	)
}

func getFramework(id string) *framework.Framework {
	reg, err := framework.NewRegistry()
	if err != nil {
		return nil
	}
	return reg.Get(id)
}

func generateAndProcess(systemPrompt, userPrompt string, pageID int, dryRun bool) error {
	lc := newLLMClient()

	fmt.Printf("Generating with %s...\n", lc.Model())

	messages := []llm.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}

	content, resp, err := lc.Chat(messages, cfg.LLM.Temperature)
	if err != nil {
		return fmt.Errorf("LLM error: %w", err)
	}

	fmt.Printf("Tokens: %d prompt + %d completion = %d total\n",
		resp.Usage.PromptTokens, resp.Usage.CompletionTokens, resp.Usage.TotalTokens)

	// Parse the response
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return fmt.Errorf("LLM returned invalid JSON: %w\n\nRaw response:\n%s", err, content)
	}

	// Validate
	result := validator.ValidateFile(parsed)
	if len(result.Warnings) > 0 {
		fmt.Println("\nWarnings:")
		for _, w := range result.Warnings {
			fmt.Printf("  ! %s\n", w)
		}
	}
	if !result.Valid {
		fmt.Println("\nErrors:")
		for _, e := range result.Errors {
			fmt.Printf("  x %s\n", e)
		}
		return fmt.Errorf("generated elements failed validation")
	}

	elementsRaw, _ := parsed["elements"].([]interface{})
	fmt.Printf("\nGenerated %d elements\n", len(elementsRaw))

	// Output or push
	if genOutput != "" {
		data, _ := json.MarshalIndent(parsed, "", "  ")
		if err := os.WriteFile(genOutput, data, 0644); err != nil {
			return err
		}
		fmt.Printf("Saved to %s\n", genOutput)
		return nil
	}

	if dryRun {
		data, _ := json.MarshalIndent(parsed, "", "  ")
		fmt.Printf("\n%s\n", string(data))
		return nil
	}

	// Push to page
	if pageID <= 0 {
		return fmt.Errorf("--page is required to push (or use --dry-run / --output)")
	}

	elements := make([]map[string]interface{}, 0, len(elementsRaw))
	for _, e := range elementsRaw {
		if m, ok := e.(map[string]interface{}); ok {
			elements = append(elements, m)
		}
	}

	c := client.New(cfg.Site.URL, cfg.Site.APIKey)

	// Create snapshot first
	snap, err := c.CreateSnapshot(pageID, "Auto: before generate")
	if err != nil {
		fmt.Printf("Warning: could not create snapshot: %v\n", err)
	} else {
		fmt.Printf("Snapshot created: %s\n", snap.SnapshotID)
	}

	// Append elements to page
	resp2, err := c.AppendElements(pageID, elements, "")
	if err != nil {
		return fmt.Errorf("failed to push elements: %w", err)
	}

	fmt.Printf("Pushed to page %d (new hash: %s)\n", pageID, resp2.ContentHash)
	return nil
}

var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate Bricks elements via AI",
}

var generateSectionCmd = &cobra.Command{
	Use:   "section <description>",
	Short: "Generate a single section from a description",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		if cfg.LLM.APIKey == "" {
			return fmt.Errorf("LLM API key not configured. Run: bricks config set llm.api_key <key>")
		}

		fw := getFramework(genFramework)
		ctx := &llm.PromptContext{Framework: fw}
		systemPrompt := llm.BuildSystemPrompt(ctx)
		userPrompt := llm.BuildSectionPrompt(args[0])

		return generateAndProcess(systemPrompt, userPrompt, genPageID, genDryRun)
	},
}

var generatePageCmd = &cobra.Command{
	Use:   "page <description>",
	Short: "Generate a full page from a description",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		if cfg.LLM.APIKey == "" {
			return fmt.Errorf("LLM API key not configured. Run: bricks config set llm.api_key <key>")
		}

		fw := getFramework(genFramework)
		ctx := &llm.PromptContext{Framework: fw}
		systemPrompt := llm.BuildSystemPrompt(ctx)
		userPrompt := llm.BuildPagePrompt(args[0])

		return generateAndProcess(systemPrompt, userPrompt, genPageID, genDryRun)
	},
}

var generateModifyCmd = &cobra.Command{
	Use:   "modify <instruction>",
	Short: "Modify existing elements on a page",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		if cfg.LLM.APIKey == "" {
			return fmt.Errorf("LLM API key not configured")
		}
		if genPageID <= 0 {
			return fmt.Errorf("--page is required for modify")
		}

		c := client.New(cfg.Site.URL, cfg.Site.APIKey)

		// Pull current elements
		current, err := c.GetElements(genPageID)
		if err != nil {
			return fmt.Errorf("failed to pull current elements: %w", err)
		}

		fw := getFramework(genFramework)
		ctx := &llm.PromptContext{
			Framework:       fw,
			ExistingContent: current.Elements,
		}
		systemPrompt := llm.BuildSystemPrompt(ctx)
		userPrompt := llm.BuildModifyPrompt(args[0], current.Elements)

		lc := newLLMClient()
		fmt.Printf("Modifying page %d with %s...\n", genPageID, lc.Model())

		messages := []llm.Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		}

		content, resp, err := lc.Chat(messages, cfg.LLM.Temperature)
		if err != nil {
			return fmt.Errorf("LLM error: %w", err)
		}

		fmt.Printf("Tokens: %d total\n", resp.Usage.TotalTokens)

		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(content), &parsed); err != nil {
			return fmt.Errorf("LLM returned invalid JSON: %w", err)
		}

		result := validator.ValidateFile(parsed)
		if !result.Valid {
			return fmt.Errorf("modified elements failed validation: %v", result.Errors)
		}

		if genDryRun {
			data, _ := json.MarshalIndent(parsed, "", "  ")
			fmt.Printf("\n%s\n", string(data))
			return nil
		}

		elementsRaw, _ := parsed["elements"].([]interface{})
		elements := make([]map[string]interface{}, 0, len(elementsRaw))
		for _, e := range elementsRaw {
			if m, ok := e.(map[string]interface{}); ok {
				elements = append(elements, m)
			}
		}

		// Snapshot + replace
		c.CreateSnapshot(genPageID, "Auto: before modify")
		resp2, err := c.ReplaceElements(genPageID, elements, current.ContentHash)
		if err != nil {
			return fmt.Errorf("failed to push modified elements: %w", err)
		}

		fmt.Printf("Modified page %d (%d elements, hash: %s)\n",
			genPageID, len(elements), resp2.ContentHash)
		return nil
	},
}

func init() {
	for _, cmd := range []*cobra.Command{generateSectionCmd, generatePageCmd, generateModifyCmd} {
		cmd.Flags().IntVar(&genPageID, "page", 0, "target page ID")
		cmd.Flags().StringVar(&genFramework, "framework", "acss", "CSS framework to use")
		cmd.Flags().BoolVar(&genDryRun, "dry-run", false, "preview without pushing")
		cmd.Flags().StringVarP(&genOutput, "output", "o", "", "save to file instead of pushing")
	}

	generateCmd.AddCommand(generateSectionCmd)
	generateCmd.AddCommand(generatePageCmd)
	generateCmd.AddCommand(generateModifyCmd)
	rootCmd.AddCommand(generateCmd)
}

func init() {
	// Alias for convenience: bricks gen = bricks generate
}

// parsePageID is a helper to parse page ID from string.
func parsePageID(s string) (int, error) {
	return strconv.Atoi(s)
}
