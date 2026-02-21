package templates

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// ComposeResult holds composed elements and merged global classes.
type ComposeResult struct {
	Elements      []map[string]interface{}
	GlobalClasses []map[string]interface{}
}

// Compose merges multiple templates into a single element list.
// It remaps IDs to avoid collisions.
func Compose(templates []*Template) ([]map[string]interface{}, error) {
	if len(templates) == 0 {
		return nil, fmt.Errorf("no templates to compose")
	}

	var result []map[string]interface{}
	usedIDs := make(map[string]bool)

	for _, tmpl := range templates {
		// Build an ID remap table for this template
		idMap := make(map[string]string)
		for _, el := range tmpl.Elements {
			oldID, _ := el["id"].(string)
			if oldID != "" {
				newID := generateUniqueID(usedIDs)
				idMap[oldID] = newID
				usedIDs[newID] = true
			}
		}

		// Apply remap
		for _, el := range tmpl.Elements {
			remapped := remapElement(el, idMap)
			result = append(result, remapped)
		}
	}

	return result, nil
}

// ComposeWithClasses merges templates and their global classes.
func ComposeWithClasses(templates []*Template) (*ComposeResult, error) {
	if len(templates) == 0 {
		return nil, fmt.Errorf("no templates to compose")
	}

	var allElements []map[string]interface{}
	usedIDs := make(map[string]bool)
	seenClasses := make(map[string]bool)
	var mergedClasses []map[string]interface{}

	for _, tmpl := range templates {
		// Build an ID remap table for this template
		idMap := make(map[string]string)
		for _, el := range tmpl.Elements {
			oldID, _ := el["id"].(string)
			if oldID != "" {
				newID := generateUniqueID(usedIDs)
				idMap[oldID] = newID
				usedIDs[newID] = true
			}
		}

		// Apply remap
		for _, el := range tmpl.Elements {
			allElements = append(allElements, remapElement(el, idMap))
		}

		// Merge global classes (deduplicate by name)
		for _, gc := range tmpl.GlobalClasses {
			name, _ := gc["name"].(string)
			if name != "" && !seenClasses[name] {
				seenClasses[name] = true
				mergedClasses = append(mergedClasses, gc)
			}
		}
	}

	return &ComposeResult{
		Elements:      allElements,
		GlobalClasses: mergedClasses,
	}, nil
}

// remapElement creates a copy of the element with remapped IDs.
func remapElement(el map[string]interface{}, idMap map[string]string) map[string]interface{} {
	copy := make(map[string]interface{})
	for k, v := range el {
		copy[k] = v
	}

	// Remap id
	if oldID, ok := copy["id"].(string); ok {
		if newID, ok := idMap[oldID]; ok {
			copy["id"] = newID
		}
	}

	// Remap parent
	if parent, ok := copy["parent"].(string); ok {
		if newParent, ok := idMap[parent]; ok {
			copy["parent"] = newParent
		}
	}

	// Remap children
	if children, ok := copy["children"].([]interface{}); ok {
		newChildren := make([]interface{}, len(children))
		for i, child := range children {
			if childID, ok := child.(string); ok {
				if newID, ok := idMap[childID]; ok {
					newChildren[i] = newID
				} else {
					newChildren[i] = childID
				}
			} else {
				newChildren[i] = child
			}
		}
		copy["children"] = newChildren
	}

	return copy
}

// generateUniqueID creates a 6-char hex ID not already in use.
func generateUniqueID(used map[string]bool) string {
	for {
		b := make([]byte, 3)
		rand.Read(b)
		id := hex.EncodeToString(b)
		if !used[id] {
			return id
		}
	}
}
