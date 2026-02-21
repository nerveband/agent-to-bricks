package templates

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Template represents a reusable Bricks element template.
type Template struct {
	Name          string                   `json:"name"`
	Description   string                   `json:"description"`
	Category      string                   `json:"category"`
	Tags          []string                 `json:"tags"`
	Elements      []map[string]interface{} `json:"elements"`
	GlobalClasses []map[string]interface{} `json:"globalClasses,omitempty"`
	Source        string                   `json:"source,omitempty"` // file path or "learned"
}

// Catalog manages a collection of templates.
type Catalog struct {
	templates map[string]*Template
	dirs      []string
}

// NewCatalog creates an empty catalog.
func NewCatalog() *Catalog {
	return &Catalog{
		templates: make(map[string]*Template),
	}
}

// LoadDir loads all template JSON files from a directory (recursively).
func (c *Catalog) LoadDir(dir string) error {
	c.dirs = append(c.dirs, dir)
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip errors
		}
		if info.IsDir() || !strings.HasSuffix(info.Name(), ".json") {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		// Try to detect Frames format first
		var raw map[string]interface{}
		if err := json.Unmarshal(data, &raw); err != nil {
			return nil
		}

		var tmpl Template
		if bricksExport, ok := raw["bricksExport"].(map[string]interface{}); ok {
			// Frames format: extract from bricksExport wrapper
			tmpl.Name = stringVal(raw, "title")
			if content, ok := bricksExport["content"].([]interface{}); ok {
				tmpl.Elements = toElementSlice(content)
			}
			if gc, ok := bricksExport["globalClasses"].([]interface{}); ok {
				tmpl.GlobalClasses = toElementSlice(gc)
			}
			// Derive category from parent directory name
			tmpl.Category = filepath.Base(filepath.Dir(path))
		} else {
			// Standard format
			if err := json.Unmarshal(data, &tmpl); err != nil {
				return nil
			}
		}

		if tmpl.Name == "" {
			tmpl.Name = strings.TrimSuffix(info.Name(), ".json")
		}
		tmpl.Source = path
		c.templates[tmpl.Name] = &tmpl
		return nil
	})
}

// stringVal safely extracts a string value from a map.
func stringVal(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// toElementSlice converts a []interface{} to []map[string]interface{}.
func toElementSlice(raw []interface{}) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(raw))
	for _, item := range raw {
		if m, ok := item.(map[string]interface{}); ok {
			result = append(result, m)
		}
	}
	return result
}

// Add adds a template to the catalog.
func (c *Catalog) Add(tmpl *Template) {
	c.templates[tmpl.Name] = tmpl
}

// Get returns a template by name.
func (c *Catalog) Get(name string) *Template {
	return c.templates[name]
}

// List returns all template names.
func (c *Catalog) List() []string {
	names := make([]string, 0, len(c.templates))
	for name := range c.templates {
		names = append(names, name)
	}
	return names
}

// Search finds templates matching a query (checks name, description, tags, category).
func (c *Catalog) Search(query string) []*Template {
	query = strings.ToLower(query)
	var results []*Template

	for _, tmpl := range c.templates {
		if matchesQuery(tmpl, query) {
			results = append(results, tmpl)
		}
	}
	return results
}

// Save writes a template to a JSON file.
func (c *Catalog) Save(tmpl *Template, dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(tmpl, "", "  ")
	if err != nil {
		return err
	}
	filename := sanitizeFilename(tmpl.Name) + ".json"
	path := filepath.Join(dir, filename)
	tmpl.Source = path
	return os.WriteFile(path, data, 0644)
}

// Count returns the number of templates.
func (c *Catalog) Count() int {
	return len(c.templates)
}

func matchesQuery(tmpl *Template, query string) bool {
	if strings.Contains(strings.ToLower(tmpl.Name), query) {
		return true
	}
	if strings.Contains(strings.ToLower(tmpl.Description), query) {
		return true
	}
	if strings.Contains(strings.ToLower(tmpl.Category), query) {
		return true
	}
	for _, tag := range tmpl.Tags {
		if strings.Contains(strings.ToLower(tag), query) {
			return true
		}
	}
	return false
}

func sanitizeFilename(name string) string {
	name = strings.ToLower(name)
	name = strings.ReplaceAll(name, " ", "-")
	clean := strings.Builder{}
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			clean.WriteRune(r)
		}
	}
	return clean.String()
}

// LearnFromPage splits a flat element list into section-level templates.
func LearnFromPage(elements []map[string]interface{}, pageName string) []*Template {
	var templates []*Template

	// Find all root-level sections (parent == 0)
	sectionIdx := 0
	for _, el := range elements {
		name, _ := el["name"].(string)
		parent := getParent(el)
		if name == "section" && parent == "0" {
			sectionIdx++
			// Collect this section and all its descendants
			sectionID, _ := el["id"].(string)
			sectionElements := collectDescendants(sectionID, elements)
			sectionElements = append([]map[string]interface{}{el}, sectionElements...)

			label, _ := el["label"].(string)
			if label == "" {
				label = fmt.Sprintf("Section %d", sectionIdx)
			}

			tmpl := &Template{
				Name:        fmt.Sprintf("%s-%s", pageName, sanitizeFilename(label)),
				Description: fmt.Sprintf("Learned from %s: %s", pageName, label),
				Category:    "learned",
				Tags:        []string{"learned", pageName},
				Elements:    sectionElements,
				Source:      "learned",
			}
			templates = append(templates, tmpl)
		}
	}

	return templates
}

func getParent(el map[string]interface{}) string {
	switch v := el["parent"].(type) {
	case float64:
		return fmt.Sprintf("%.0f", v)
	case string:
		return v
	default:
		return "0"
	}
}

func collectDescendants(parentID string, elements []map[string]interface{}) []map[string]interface{} {
	var result []map[string]interface{}
	for _, el := range elements {
		elParent := getParent(el)
		if elParent == parentID {
			result = append(result, el)
			elID, _ := el["id"].(string)
			if elID != "" {
				result = append(result, collectDescendants(elID, elements)...)
			}
		}
	}
	return result
}
