package doctor

import (
	"fmt"
)

// Issue represents a health check finding.
type Issue struct {
	Severity string `json:"severity"` // "error", "warning", "info"
	Check    string `json:"check"`
	Message  string `json:"message"`
	ElementID string `json:"elementId,omitempty"`
}

// Report holds all issues found during a health check.
type Report struct {
	Issues  []Issue `json:"issues"`
	Summary map[string]int `json:"summary"` // severity -> count
}

// Check runs all health checks on a set of elements.
func Check(elements []map[string]interface{}) *Report {
	r := &Report{
		Summary: map[string]int{"error": 0, "warning": 0, "info": 0},
	}

	checkDuplicateIDs(elements, r)
	checkOrphanedParents(elements, r)
	checkMismatchedChildren(elements, r)
	checkNestingViolations(elements, r)
	checkMissingIDs(elements, r)
	checkEmptySettings(elements, r)

	return r
}

func addIssue(r *Report, severity, check, msg, elID string) {
	r.Issues = append(r.Issues, Issue{
		Severity:  severity,
		Check:     check,
		Message:   msg,
		ElementID: elID,
	})
	r.Summary[severity]++
}

func checkDuplicateIDs(elements []map[string]interface{}, r *Report) {
	seen := make(map[string]int)
	for _, el := range elements {
		id, _ := el["id"].(string)
		if id != "" {
			seen[id]++
		}
	}
	for id, count := range seen {
		if count > 1 {
			addIssue(r, "error", "duplicate-id",
				fmt.Sprintf("ID '%s' appears %d times", id, count), id)
		}
	}
}

func checkOrphanedParents(elements []map[string]interface{}, r *Report) {
	idSet := make(map[string]bool)
	for _, el := range elements {
		id, _ := el["id"].(string)
		if id != "" {
			idSet[id] = true
		}
	}

	for _, el := range elements {
		id, _ := el["id"].(string)
		parent := getParentStr(el)
		if parent != "" && parent != "0" && !idSet[parent] {
			addIssue(r, "error", "orphaned-parent",
				fmt.Sprintf("references non-existent parent '%s'", parent), id)
		}
	}
}

func checkMismatchedChildren(elements []map[string]interface{}, r *Report) {
	idSet := make(map[string]bool)
	for _, el := range elements {
		id, _ := el["id"].(string)
		if id != "" {
			idSet[id] = true
		}
	}

	for _, el := range elements {
		id, _ := el["id"].(string)
		children, ok := el["children"].([]interface{})
		if !ok {
			continue
		}
		for _, child := range children {
			childID, _ := child.(string)
			if childID != "" && !idSet[childID] {
				addIssue(r, "warning", "broken-child-ref",
					fmt.Sprintf("lists non-existent child '%s'", childID), id)
			}
		}
	}

	// Check reverse: if parent says A is child of B, does A's parent == B?
	parentOf := make(map[string]string)
	for _, el := range elements {
		id, _ := el["id"].(string)
		parent := getParentStr(el)
		if id != "" {
			parentOf[id] = parent
		}
	}

	for _, el := range elements {
		id, _ := el["id"].(string)
		children, ok := el["children"].([]interface{})
		if !ok {
			continue
		}
		for _, child := range children {
			childID, _ := child.(string)
			if childID == "" {
				continue
			}
			if actual, exists := parentOf[childID]; exists && actual != id {
				addIssue(r, "warning", "parent-child-mismatch",
					fmt.Sprintf("claims child '%s' but child's parent is '%s'", childID, actual), id)
			}
		}
	}
}

func checkNestingViolations(elements []map[string]interface{}, r *Report) {
	for _, el := range elements {
		name, _ := el["name"].(string)
		id, _ := el["id"].(string)
		parent := getParentStr(el)

		if name == "section" && parent != "" && parent != "0" {
			addIssue(r, "warning", "nesting-violation",
				"section should be at root level (parent=0)", id)
		}
	}
}

func checkMissingIDs(elements []map[string]interface{}, r *Report) {
	for i, el := range elements {
		id, _ := el["id"].(string)
		if id == "" {
			addIssue(r, "warning", "missing-id",
				fmt.Sprintf("element at index %d has no ID", i), "")
		}
	}
}

func checkEmptySettings(elements []map[string]interface{}, r *Report) {
	for _, el := range elements {
		id, _ := el["id"].(string)
		name, _ := el["name"].(string)
		settings, _ := el["settings"].(map[string]interface{})

		// Content elements should have settings
		contentTypes := map[string]bool{
			"heading": true, "text-basic": true, "button": true, "image": true,
		}
		if contentTypes[name] && (settings == nil || len(settings) == 0) {
			addIssue(r, "info", "empty-settings",
				fmt.Sprintf("%s element has no settings", name), id)
		}
	}
}

func getParentStr(el map[string]interface{}) string {
	switch v := el["parent"].(type) {
	case float64:
		if v == 0 {
			return "0"
		}
		return fmt.Sprintf("%.0f", v)
	case string:
		return v
	default:
		return ""
	}
}
