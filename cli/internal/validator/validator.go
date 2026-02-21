package validator

import (
	"fmt"
	"regexp"
	"strings"
)

// Known valid Bricks element types.
var ValidTypes = map[string]bool{
	"section": true, "container": true, "block": true, "div": true,
	"heading": true, "text-basic": true, "rich-text": true, "text-link": true,
	"button": true, "icon": true, "image": true, "video": true,
	"nav-menu": true, "nav-nested": true, "offcanvas": true,
	"accordion": true, "accordion-nested": true, "tabs": true, "tabs-nested": true,
	"slider": true, "slider-nested": true, "carousel": true,
	"form": true, "map": true, "code": true, "template": true,
	"post-content": true, "posts": true, "pagination": true,
	"list": true, "social-icons": true, "alert": true, "progress-bar": true,
	"countdown": true, "counter": true, "pricing-tables": true, "team-members": true,
	"testimonials": true, "logo": true, "search": true, "sidebar": true,
	"wordpress": true, "shortcode": true,
}

// StructuralTypes are elements that can contain children.
var StructuralTypes = map[string]bool{
	"section": true, "container": true, "block": true, "div": true,
	"accordion": true, "accordion-nested": true, "tabs": true, "tabs-nested": true,
	"slider": true, "slider-nested": true, "offcanvas": true,
}

// NestingRules: which types can be direct children of which.
// section can only be at root; container must be inside section/div/block.
var NestingRules = map[string][]string{
	"section": {"_root"},
}

// Dynamic data tag pattern: {post_title}, {acf_field_name}, etc.
var dynamicDataPattern = regexp.MustCompile(`\{[a-zA-Z_][a-zA-Z0-9_:]*\}`)

// Result holds validation results.
type Result struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

// Element is a generic Bricks element for validation.
type Element map[string]interface{}

// Validate checks a slice of elements for correctness.
func Validate(elements []Element) *Result {
	r := &Result{Valid: true}

	if len(elements) == 0 {
		r.Valid = false
		r.Errors = append(r.Errors, "no elements provided")
		return r
	}

	idSet := make(map[string]bool)
	parentMap := make(map[string]string) // id -> parent

	// First pass: collect all IDs and parent references
	for _, el := range elements {
		id, _ := el["id"].(string)
		if id != "" {
			if idSet[id] {
				r.Errors = append(r.Errors, fmt.Sprintf("duplicate element ID: %s", id))
				r.Valid = false
			}
			idSet[id] = true
		}
		parent, _ := el["parent"].(float64)
		if parent != 0 {
			parentMap[id] = fmt.Sprintf("%.0f", parent)
		}
		// String parent
		if ps, ok := el["parent"].(string); ok && ps != "" && ps != "0" {
			parentMap[id] = ps
		}
	}

	// Second pass: validate each element
	for i, el := range elements {
		path := fmt.Sprintf("elements[%d]", i)
		validateElement(el, path, idSet, r)
	}

	// Third pass: check parent references
	for id, parent := range parentMap {
		if !idSet[parent] {
			r.Errors = append(r.Errors, fmt.Sprintf("element %s references non-existent parent %s", id, parent))
			r.Valid = false
		}
	}

	// Fourth pass: check children references
	for _, el := range elements {
		children, ok := el["children"].([]interface{})
		if !ok {
			continue
		}
		elID, _ := el["id"].(string)
		for _, child := range children {
			childID, _ := child.(string)
			if childID != "" && !idSet[childID] {
				r.Warnings = append(r.Warnings, fmt.Sprintf("element %s lists non-existent child %s", elID, childID))
			}
		}
	}

	// Check nesting: sections should be at root
	for _, el := range elements {
		name, _ := el["name"].(string)
		if name == "section" {
			parent, hasParent := el["parent"]
			if hasParent {
				pf, isFloat := parent.(float64)
				ps, isStr := parent.(string)
				if (isFloat && pf != 0) || (isStr && ps != "" && ps != "0") {
					r.Warnings = append(r.Warnings, fmt.Sprintf("section element should be at root level, has parent"))
				}
			}
		}
	}

	return r
}

func validateElement(el Element, path string, idSet map[string]bool, r *Result) {
	// Name is required
	name, ok := el["name"].(string)
	if !ok || name == "" {
		r.Errors = append(r.Errors, fmt.Sprintf("%s: missing or invalid 'name' field", path))
		r.Valid = false
		return
	}

	// Warn on unknown types
	if !ValidTypes[name] {
		r.Warnings = append(r.Warnings, fmt.Sprintf("%s: unknown element type '%s'", path, name))
	}

	// ID should exist
	id, _ := el["id"].(string)
	if id == "" {
		r.Warnings = append(r.Warnings, fmt.Sprintf("%s: missing 'id' field", path))
	}

	// Settings validation
	settings, _ := el["settings"].(map[string]interface{})
	if settings != nil {
		validateSettings(settings, path, r)
	}
}

func validateSettings(settings map[string]interface{}, path string, r *Result) {
	// Check _cssGlobalClasses
	if classes, ok := settings["_cssGlobalClasses"]; ok {
		classArr, isArr := classes.([]interface{})
		if !isArr {
			r.Warnings = append(r.Warnings, fmt.Sprintf("%s: _cssGlobalClasses should be an array", path))
		} else {
			for _, cls := range classArr {
				if _, ok := cls.(string); !ok {
					r.Warnings = append(r.Warnings, fmt.Sprintf("%s: _cssGlobalClasses contains non-string value", path))
				}
			}
		}
	}

	// Check media references
	if img, ok := settings["image"].(map[string]interface{}); ok {
		validateMedia(img, path+".image", r)
	}

	// Dynamic data tag validation in text fields
	if text, ok := settings["text"].(string); ok {
		validateDynamicData(text, path+".text", r)
	}
}

func validateMedia(media map[string]interface{}, path string, r *Result) {
	// Media should have either id (attachment ID) or url
	_, hasID := media["id"]
	url, hasURL := media["url"].(string)

	if !hasID && !hasURL {
		r.Warnings = append(r.Warnings, fmt.Sprintf("%s: media missing both 'id' and 'url'", path))
	}
	if hasURL && !hasID && url != "" {
		if !strings.HasPrefix(url, "{") { // not a dynamic data tag
			r.Warnings = append(r.Warnings, fmt.Sprintf("%s: media uses bare URL without attachment ID (may break on migration)", path))
		}
	}
}

func validateDynamicData(text, path string, r *Result) {
	matches := dynamicDataPattern.FindAllString(text, -1)
	for _, m := range matches {
		// Remove braces
		tag := m[1 : len(m)-1]
		// Known safe prefixes
		safePrefixes := []string{"post_", "acf_", "woo_", "author_", "site_", "echo_", "wp_"}
		isSafe := false
		for _, prefix := range safePrefixes {
			if strings.HasPrefix(tag, prefix) {
				isSafe = true
				break
			}
		}
		if !isSafe {
			r.Warnings = append(r.Warnings, fmt.Sprintf("%s: dynamic data tag '%s' has unknown prefix", path, m))
		}
	}
}

// ValidateFile validates elements from a parsed JSON file structure.
func ValidateFile(data map[string]interface{}) *Result {
	elementsRaw, ok := data["elements"].([]interface{})
	if !ok {
		return &Result{
			Valid:  false,
			Errors: []string{"file missing 'elements' array"},
		}
	}

	elements := make([]Element, 0, len(elementsRaw))
	for _, e := range elementsRaw {
		if m, ok := e.(map[string]interface{}); ok {
			elements = append(elements, Element(m))
		}
	}

	return Validate(elements)
}
