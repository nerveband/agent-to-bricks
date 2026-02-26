package wizard

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/nerveband/agent-to-bricks/internal/config"
)

// Step tracks which screen the wizard is on.
type step int

const (
	stepWelcome step = iota
	stepSiteURL
	stepAPIKey
	stepTestConnection
	stepSummary
	stepDone
)

// Result is the final config produced by the wizard.
type Result struct {
	Config *config.Config
	Err    error
}

// connectionTestMsg is sent after testing the site connection.
type connectionTestMsg struct {
	ok      bool
	message string
}

type model struct {
	step       step
	inputs     map[step]textinput.Model
	result     Result
	width      int
	height     int
	testResult string
	testing    bool
	quitting   bool
}

var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("99")).
			MarginBottom(1)

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42")).
			Bold(true)

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")).
			Bold(true)

	dimStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241"))

	selectedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("99")).
			Bold(true)

	boxStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("99")).
			Padding(1, 2)

)

func newTextInput(placeholder string, isPassword bool) textinput.Model {
	ti := textinput.New()
	ti.Placeholder = placeholder
	ti.CharLimit = 256
	ti.Width = 50
	if isPassword {
		ti.EchoMode = textinput.EchoPassword
		ti.EchoCharacter = '*'
	}
	return ti
}

func initialModel() model {
	inputs := map[step]textinput.Model{
		stepSiteURL: newTextInput("https://mysite.com", false),
		stepAPIKey:  newTextInput("atb_xxxxxxxxxxxxx", true),
	}

	return model{
		step:   stepWelcome,
		inputs: inputs,
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func testConnection(url, apiKey string) tea.Cmd {
	return func() tea.Msg {
		client := &http.Client{Timeout: 10 * time.Second}
		req, err := http.NewRequest("GET", strings.TrimRight(url, "/")+"/wp-json/agent-bricks/v1/site/info", nil)
		if err != nil {
			return connectionTestMsg{ok: false, message: fmt.Sprintf("Invalid URL: %v", err)}
		}
		req.Header.Set("X-ATB-Key", apiKey)

		resp, err := client.Do(req)
		if err != nil {
			return connectionTestMsg{ok: false, message: fmt.Sprintf("Connection failed: %v", err)}
		}
		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			return connectionTestMsg{ok: true, message: "Connected successfully!"}
		}
		if resp.StatusCode == 401 || resp.StatusCode == 403 {
			return connectionTestMsg{ok: false, message: "Authentication failed - check your API key"}
		}
		return connectionTestMsg{ok: false, message: fmt.Sprintf("HTTP %d - plugin may not be active", resp.StatusCode)}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case connectionTestMsg:
		m.testing = false
		if msg.ok {
			m.testResult = successStyle.Render("+ " + msg.message)
			m.step = stepSummary
		} else {
			m.testResult = errorStyle.Render("x " + msg.message)
			m.step = stepSiteURL
		}
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc":
			m.quitting = true
			return m, tea.Quit

		case "enter":
			return m.handleEnter()
		}
	}

	// Update the active text input
	if ti, ok := m.inputs[m.step]; ok {
		var cmd tea.Cmd
		ti, cmd = ti.Update(msg)
		m.inputs[m.step] = ti
		return m, cmd
	}

	return m, nil
}

func (m model) handleEnter() (tea.Model, tea.Cmd) {
	switch m.step {
	case stepWelcome:
		m.step = stepSiteURL
		ti := m.inputs[stepSiteURL]
		ti.Focus()
		m.inputs[stepSiteURL] = ti
		return m, ti.Focus()

	case stepSiteURL:
		url := strings.TrimSpace(m.inputs[stepSiteURL].Value())
		if url == "" {
			return m, nil
		}
		if !strings.HasPrefix(url, "http") {
			url = "https://" + url
			ti := m.inputs[stepSiteURL]
			ti.SetValue(url)
			m.inputs[stepSiteURL] = ti
		}
		m.step = stepAPIKey
		ti := m.inputs[stepAPIKey]
		ti.Focus()
		m.inputs[stepAPIKey] = ti
		return m, ti.Focus()

	case stepAPIKey:
		key := strings.TrimSpace(m.inputs[stepAPIKey].Value())
		if key == "" {
			return m, nil
		}
		m.step = stepTestConnection
		m.testing = true
		m.testResult = ""
		return m, testConnection(m.inputs[stepSiteURL].Value(), key)

	case stepTestConnection:
		// Waiting for test result
		return m, nil

	case stepSummary:
		m.step = stepDone
		m.result.Config = m.buildConfig()
		return m, tea.Quit
	}
	return m, nil
}

func (m model) buildConfig() *config.Config {
	return &config.Config{
		Site: config.SiteConfig{
			URL:    strings.TrimSpace(m.inputs[stepSiteURL].Value()),
			APIKey: strings.TrimSpace(m.inputs[stepAPIKey].Value()),
		},
	}
}

func (m model) View() string {
	if m.quitting {
		return "\n  Setup cancelled.\n\n"
	}

	var s strings.Builder

	// Header
	header := titleStyle.Render("Agent to Bricks Setup")
	steps := []string{"Site", "Auth", "Done"}
	currentStepIdx := m.stepIndex()
	stepBar := m.renderStepBar(steps, currentStepIdx)

	s.WriteString("\n")
	s.WriteString("  " + header + "\n")
	s.WriteString("  " + stepBar + "\n\n")

	// Body
	switch m.step {
	case stepWelcome:
		s.WriteString(m.renderWelcome())
	case stepSiteURL:
		s.WriteString(m.renderInput("Where is your WordPress site?", stepSiteURL, "Enter the full URL of your WordPress site with Bricks Builder"))
	case stepAPIKey:
		s.WriteString(m.renderInput("API Key", stepAPIKey, "Generate one at WP Admin > Agent to Bricks > Settings"))
	case stepTestConnection:
		s.WriteString(m.renderTesting())
	case stepSummary:
		s.WriteString(m.renderSummary())
	case stepDone:
		s.WriteString(m.renderDone())
	}

	// Footer
	s.WriteString("\n")
	s.WriteString("  " + dimStyle.Render("Press Enter to continue, Esc to cancel") + "\n\n")

	return s.String()
}

func (m model) stepIndex() int {
	switch {
	case m.step <= stepSiteURL:
		return 0
	case m.step <= stepTestConnection:
		return 1
	default:
		return 2
	}
}

func (m model) renderStepBar(steps []string, current int) string {
	var parts []string
	for i, name := range steps {
		if i < current {
			parts = append(parts, successStyle.Render("[+] "+name))
		} else if i == current {
			parts = append(parts, selectedStyle.Render("[>] "+name))
		} else {
			parts = append(parts, dimStyle.Render("[ ] "+name))
		}
	}
	return strings.Join(parts, "  ")
}

func (m model) renderWelcome() string {
	var s strings.Builder
	content := boxStyle.Render(
		titleStyle.Render("Welcome!") + "\n\n" +
			"This wizard will help you set up Agent to Bricks.\n" +
			"You'll need:\n\n" +
			"  1. A WordPress site with Bricks Builder\n" +
			"  2. The Agent to Bricks plugin activated\n" +
			"  3. An API key (generated in WP Admin)")
	s.WriteString("  " + content + "\n")
	return s.String()
}

func (m model) renderInput(title string, s step, hint string) string {
	var b strings.Builder
	b.WriteString("  " + titleStyle.Render(title) + "\n")
	b.WriteString("  " + dimStyle.Render(hint) + "\n\n")
	b.WriteString("  " + m.inputs[s].View() + "\n")

	if m.testResult != "" && s == stepSiteURL {
		b.WriteString("\n  " + m.testResult + "\n")
	}

	return b.String()
}

func (m model) renderTesting() string {
	var s strings.Builder
	s.WriteString("  " + titleStyle.Render("Testing Connection...") + "\n\n")
	s.WriteString("  Connecting to " + m.inputs[stepSiteURL].Value() + "...\n")
	return s.String()
}

func (m model) renderSummary() string {
	var s strings.Builder

	s.WriteString("  " + titleStyle.Render("Configuration Summary") + "\n\n")

	content := fmt.Sprintf(
		"  Site URL:     %s\n"+
			"  API Key:      %s...\n",
		m.inputs[stepSiteURL].Value(),
		maskKey(m.inputs[stepAPIKey].Value()),
	)

	s.WriteString(boxStyle.Render(content))
	s.WriteString("\n\n  " + dimStyle.Render("Press Enter to save configuration"))
	return s.String()
}

func (m model) renderDone() string {
	return "  " + successStyle.Render("Configuration saved!") + "\n"
}

func maskKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:8]
}

// Run starts the interactive setup wizard and returns the resulting config.
func Run() (*config.Config, error) {
	m := initialModel()
	p := tea.NewProgram(m, tea.WithAltScreen())

	finalModel, err := p.Run()
	if err != nil {
		return nil, fmt.Errorf("wizard error: %w", err)
	}

	final := finalModel.(model)
	if final.quitting {
		return nil, fmt.Errorf("setup cancelled")
	}

	return final.result.Config, final.result.Err
}
