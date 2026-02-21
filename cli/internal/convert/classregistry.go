package convert

import (
	"encoding/json"
	"os"
	"sort"
	"strings"
	"time"
)

// classEntry holds the ID and source for a single CSS class.
type classEntry struct {
	ID     string
	Source string // "acss" or "frames"
}

// ClassRegistry maps class names to their IDs and sources.
type ClassRegistry struct {
	byName map[string]classEntry
}

// RegistryStats holds aggregate counts for a ClassRegistry.
type RegistryStats struct {
	Total  int
	ACSS   int
	Frames int
}

// NewClassRegistry creates an empty ClassRegistry.
func NewClassRegistry() *ClassRegistry {
	return &ClassRegistry{
		byName: make(map[string]classEntry),
	}
}

// Add inserts or overwrites a class entry in the registry.
func (r *ClassRegistry) Add(name, id, source string) {
	r.byName[name] = classEntry{ID: id, Source: source}
}

// Lookup returns the id, source, and whether the class was found.
func (r *ClassRegistry) Lookup(name string) (id, source string, found bool) {
	e, ok := r.byName[name]
	if !ok {
		return "", "", false
	}
	return e.ID, e.Source, true
}

// Stats returns aggregate counts for the registry.
func (r *ClassRegistry) Stats() RegistryStats {
	var s RegistryStats
	for _, e := range r.byName {
		s.Total++
		switch e.Source {
		case "acss":
			s.ACSS++
		case "frames":
			s.Frames++
		}
	}
	return s
}

// Names returns all class names in sorted order.
func (r *ClassRegistry) Names() []string {
	names := make([]string, 0, len(r.byName))
	for n := range r.byName {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
}

// BySource returns sorted class names that match the given source.
func (r *ClassRegistry) BySource(source string) []string {
	var names []string
	for n, e := range r.byName {
		if e.Source == source {
			names = append(names, n)
		}
	}
	sort.Strings(names)
	return names
}

// BuildRegistryFromClasses builds a ClassRegistry from an API response.
// Each map in the slice is expected to have "id" and "name" keys (both strings).
// Classes whose id starts with "acss_import_" are classified as "acss";
// everything else is "frames".
func BuildRegistryFromClasses(classes []map[string]interface{}) *ClassRegistry {
	r := NewClassRegistry()
	for _, c := range classes {
		idVal, _ := c["id"].(string)
		nameVal, _ := c["name"].(string)
		if idVal == "" || nameVal == "" {
			continue
		}
		source := "frames"
		if strings.HasPrefix(idVal, "acss_import_") {
			source = "acss"
		}
		r.Add(nameVal, idVal, source)
	}
	return r
}

// registryFile is the JSON-serialisable format for the class registry cache.
type registryFile struct {
	FetchedAt time.Time            `json:"fetchedAt"`
	SiteURL   string               `json:"siteUrl"`
	ByName    map[string][2]string `json:"byName"` // name → [id, source]
}

// SaveToFile writes the registry to a JSON file at path.
func (r *ClassRegistry) SaveToFile(path, siteURL string) error {
	rf := registryFile{
		FetchedAt: time.Now().UTC(),
		SiteURL:   siteURL,
		ByName:    make(map[string][2]string, len(r.byName)),
	}
	for name, e := range r.byName {
		rf.ByName[name] = [2]string{e.ID, e.Source}
	}
	data, err := json.MarshalIndent(rf, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// LoadRegistryFromFile reads a cached registry JSON file and returns a ClassRegistry.
func LoadRegistryFromFile(path string) (*ClassRegistry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var rf registryFile
	if err := json.Unmarshal(data, &rf); err != nil {
		return nil, err
	}
	r := NewClassRegistry()
	for name, pair := range rf.ByName {
		r.Add(name, pair[0], pair[1])
	}
	return r, nil
}
