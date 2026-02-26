package styles

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
)

// Profile holds learned style preferences.
type Profile struct {
	ClassFrequency    map[string]int    `json:"classFrequency"`
	SpacingValues     map[string]int    `json:"spacingValues"`
	ColorUsage        map[string]int    `json:"colorUsage"`
	ElementPatterns   map[string]int    `json:"elementPatterns"`
	PagesAnalyzed     int               `json:"pagesAnalyzed"`
}

// RankedItem is a frequency-ranked value.
type RankedItem struct {
	Value string
	Count int
}

// NewProfile creates an empty style profile.
func NewProfile() *Profile {
	return &Profile{
		ClassFrequency:  make(map[string]int),
		SpacingValues:   make(map[string]int),
		ColorUsage:      make(map[string]int),
		ElementPatterns: make(map[string]int),
	}
}

// DefaultPath returns the default profile file path.
func DefaultPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".agent-to-bricks", "style-profile.json")
	}
	return filepath.Join(home, ".agent-to-bricks", "style-profile.json")
}

// Load reads a profile from disk.
func Load(path string) (*Profile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return NewProfile(), nil
	}
	var p Profile
	if err := json.Unmarshal(data, &p); err != nil {
		return NewProfile(), nil
	}
	if p.ClassFrequency == nil {
		p.ClassFrequency = make(map[string]int)
	}
	if p.SpacingValues == nil {
		p.SpacingValues = make(map[string]int)
	}
	if p.ColorUsage == nil {
		p.ColorUsage = make(map[string]int)
	}
	if p.ElementPatterns == nil {
		p.ElementPatterns = make(map[string]int)
	}
	return &p, nil
}

// Save writes the profile to disk.
func (p *Profile) Save(path string) error {
	os.MkdirAll(filepath.Dir(path), 0700)
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

// AnalyzePage updates the profile from a set of page elements.
func (p *Profile) AnalyzePage(elements []map[string]interface{}) {
	p.PagesAnalyzed++

	for _, el := range elements {
		name, _ := el["name"].(string)
		if name != "" {
			p.ElementPatterns[name]++
		}

		settings, _ := el["settings"].(map[string]interface{})
		if settings == nil {
			continue
		}

		// Collect CSS global classes
		if classes, ok := settings["_cssGlobalClasses"].([]interface{}); ok {
			for _, cls := range classes {
				if s, ok := cls.(string); ok {
					p.ClassFrequency[s]++
				}
			}
		}

		// Collect spacing-related values
		for _, key := range []string{"_marginTop", "_marginBottom", "_paddingTop", "_paddingBottom", "_gap"} {
			if val, ok := settings[key].(string); ok && val != "" {
				p.SpacingValues[val]++
			}
		}

		// Collect color-related values
		for _, key := range []string{"_color", "_backgroundColor", "color"} {
			if val, ok := settings[key].(string); ok && val != "" {
				p.ColorUsage[val]++
			}
		}
	}
}

// TopClasses returns the most frequently used classes.
func (p *Profile) TopClasses(limit int) []RankedItem {
	return topN(p.ClassFrequency, limit)
}

// TopElements returns the most frequently used element types.
func (p *Profile) TopElements(limit int) []RankedItem {
	return topN(p.ElementPatterns, limit)
}

func topN(m map[string]int, limit int) []RankedItem {
	items := make([]RankedItem, 0, len(m))
	for k, v := range m {
		items = append(items, RankedItem{Value: k, Count: v})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Count > items[j].Count
	})
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items
}
