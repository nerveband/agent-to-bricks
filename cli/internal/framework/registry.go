package framework

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

//go:embed acss.json
var embeddedACSS []byte

// Framework represents a CSS framework configuration.
type Framework struct {
	Name             string           `json:"name"`
	ID               string           `json:"id"`
	Version          string           `json:"version"`
	Description      string           `json:"description"`
	PluginSlug       string           `json:"pluginSlug"`
	OptionKey        string           `json:"optionKey"`
	BricksClassPrefix string          `json:"bricksClassPrefix"`
	Spacing          SpacingConfig    `json:"spacing"`
	Colors           ColorsConfig     `json:"colors"`
	Typography       TypographyConfig `json:"typography"`
	Buttons          ButtonsConfig    `json:"buttons"`
	Layout           LayoutConfig     `json:"layout"`
	UtilityClasses   UtilityConfig    `json:"utilityClasses"`
}

// SpacingConfig holds spacing variable mappings.
type SpacingConfig struct {
	Variables    map[string]string `json:"variables"`
	SettingsKeys []string          `json:"settingsKeys"`
}

// ColorsConfig holds color family definitions.
type ColorsConfig struct {
	Families          []string `json:"families"`
	VariablePattern   string   `json:"variablePattern"`
	ShadePattern      string   `json:"shadePattern"`
	Shades            []string `json:"shades"`
	SettingsKeyPattern string  `json:"settingsKeyPattern"`
}

// TypographyConfig holds typography definitions.
type TypographyConfig struct {
	Headings  []string          `json:"headings"`
	TextSizes map[string]string `json:"textSizes"`
	Variables map[string]string `json:"variables"`
}

// ButtonsConfig holds button variant definitions.
type ButtonsConfig struct {
	Variants     []string `json:"variants"`
	ClassPattern string   `json:"classPattern"`
	Modifiers    []string `json:"modifiers"`
}

// LayoutConfig holds layout class/variable definitions.
type LayoutConfig struct {
	Classes   map[string][]string `json:"classes"`
	Variables map[string]string   `json:"variables"`
}

// UtilityConfig holds utility class categories.
type UtilityConfig struct {
	Spacing []string `json:"spacing"`
	Display []string `json:"display"`
	Text    []string `json:"text"`
	Sizing  []string `json:"sizing"`
}

// Registry manages loaded CSS framework configurations.
type Registry struct {
	frameworks map[string]*Framework
}

// NewRegistry creates a registry with the embedded ACSS config.
func NewRegistry() (*Registry, error) {
	r := &Registry{frameworks: make(map[string]*Framework)}

	var acss Framework
	if err := json.Unmarshal(embeddedACSS, &acss); err != nil {
		return nil, fmt.Errorf("failed to parse embedded ACSS config: %w", err)
	}
	r.frameworks[acss.ID] = &acss

	return r, nil
}

// LoadFromDir loads additional framework configs from a directory.
func (r *Registry) LoadFromDir(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var fw Framework
		if err := json.Unmarshal(data, &fw); err != nil {
			continue
		}
		if fw.ID != "" {
			r.frameworks[fw.ID] = &fw
		}
	}
	return nil
}

// Get returns a framework by ID.
func (r *Registry) Get(id string) *Framework {
	return r.frameworks[id]
}

// List returns all loaded framework IDs.
func (r *Registry) List() []string {
	ids := make([]string, 0, len(r.frameworks))
	for id := range r.frameworks {
		ids = append(ids, id)
	}
	return ids
}

// SpacingVariable returns the CSS variable for a spacing size.
func (f *Framework) SpacingVariable(size string) string {
	return f.Spacing.Variables[size]
}

// ButtonClass returns the CSS class for a button variant.
func (f *Framework) ButtonClass(variant string) string {
	return strings.ReplaceAll(f.Buttons.ClassPattern, "{variant}", variant)
}

// BricksClassID returns the Bricks global class ID for a given class name.
func (f *Framework) BricksClassID(className string) string {
	return f.BricksClassPrefix + className
}

// ColorVariable returns the CSS variable for a color family.
func (f *Framework) ColorVariable(family string) string {
	return strings.ReplaceAll(f.Colors.VariablePattern, "{family}", family)
}

// ColorShadeVariable returns the CSS variable for a color shade.
func (f *Framework) ColorShadeVariable(family, shade string) string {
	v := strings.ReplaceAll(f.Colors.ShadePattern, "{family}", family)
	return strings.ReplaceAll(v, "{shade}", shade)
}

// AllUtilityClasses returns all known utility classes.
func (f *Framework) AllUtilityClasses() []string {
	var all []string
	all = append(all, f.UtilityClasses.Spacing...)
	all = append(all, f.UtilityClasses.Display...)
	all = append(all, f.UtilityClasses.Text...)
	all = append(all, f.UtilityClasses.Sizing...)
	for _, classes := range f.Layout.Classes {
		all = append(all, classes...)
	}
	for _, size := range f.Typography.TextSizes {
		all = append(all, size)
	}
	return all
}

// AllVariables returns all known CSS custom properties.
func (f *Framework) AllVariables() map[string]string {
	vars := make(map[string]string)
	for k, v := range f.Spacing.Variables {
		vars["spacing."+k] = v
	}
	for k, v := range f.Typography.Variables {
		vars["typography."+k] = v
	}
	for k, v := range f.Layout.Variables {
		vars["layout."+k] = v
	}
	for _, family := range f.Colors.Families {
		vars["color."+family] = f.ColorVariable(family)
	}
	return vars
}
