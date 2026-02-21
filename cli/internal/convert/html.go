package convert

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"strings"

	"golang.org/x/net/html"
)

// HTMLToBricks converts an HTML string to Bricks elements.
// Backward-compatible wrapper that calls HTMLToBricksWithRegistry with a nil registry.
func HTMLToBricks(htmlStr string) ([]map[string]interface{}, error) {
	return HTMLToBricksWithRegistry(htmlStr, nil)
}

// HTMLToBricksWithRegistry converts an HTML string to Bricks elements,
// optionally resolving CSS class names against the provided ClassRegistry.
// When registry is nil, class attributes are stored as _cssCustom (backward compat).
// When registry is provided, resolved classes go to _cssGlobalClasses and
// unresolved classes go to _cssClasses.
func HTMLToBricksWithRegistry(htmlStr string, registry *ClassRegistry) ([]map[string]interface{}, error) {
	doc, err := html.Parse(strings.NewReader(htmlStr))
	if err != nil {
		return nil, err
	}

	var elements []map[string]interface{}
	usedIDs := make(map[string]bool)

	// Process the document body
	var processNode func(*html.Node, string)
	processNode = func(n *html.Node, parentID string) {
		if n.Type == html.ElementNode {
			bricksName := mapTagToElement(n.Data)
			if bricksName == "" {
				// Skip unknown tags but process children
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					processNode(c, parentID)
				}
				return
			}

			id := generateID(usedIDs)
			el := map[string]interface{}{
				"id":       id,
				"name":     bricksName,
				"parent":   parentID,
				"children": []interface{}{},
				"settings": map[string]interface{}{},
			}

			// Extract settings from attributes and content
			settings := extractSettings(n, bricksName, registry)
			if len(settings) > 0 {
				el["settings"] = settings
			}

			// Collect child IDs
			var childIDs []interface{}
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.ElementNode {
					childName := mapTagToElement(c.Data)
					if childName != "" {
						childID := peekID(usedIDs)
						childIDs = append(childIDs, childID)
					}
				}
			}
			el["children"] = childIDs

			elements = append(elements, el)

			// Process children
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				processNode(c, id)
			}
		}
	}

	// Find body or process entire document
	var body *html.Node
	var findBody func(*html.Node)
	findBody = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "body" {
			body = n
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findBody(c)
		}
	}
	findBody(doc)

	if body != nil {
		for c := body.FirstChild; c != nil; c = c.NextSibling {
			processNode(c, "0")
		}
	} else {
		for c := doc.FirstChild; c != nil; c = c.NextSibling {
			processNode(c, "0")
		}
	}

	// Fix children arrays (they were populated with peek IDs which aren't accurate)
	// Rebuild from parent references
	idToChildren := make(map[string][]interface{})
	for _, el := range elements {
		parent, _ := el["parent"].(string)
		id, _ := el["id"].(string)
		idToChildren[parent] = append(idToChildren[parent], id)
	}
	for i := range elements {
		id, _ := elements[i]["id"].(string)
		if children, ok := idToChildren[id]; ok {
			elements[i]["children"] = children
		} else {
			elements[i]["children"] = []interface{}{}
		}
	}

	return elements, nil
}

// mapTagToElement maps HTML tags to Bricks element names.
func mapTagToElement(tag string) string {
	tag = strings.ToLower(tag)
	mapping := map[string]string{
		"section":    "section",
		"div":        "div",
		"header":     "section",
		"footer":     "section",
		"main":       "section",
		"article":    "section",
		"aside":      "div",
		"nav":        "div",
		"h1":         "heading",
		"h2":         "heading",
		"h3":         "heading",
		"h4":         "heading",
		"h5":         "heading",
		"h6":         "heading",
		"p":          "text-basic",
		"span":       "text-basic",
		"a":          "text-link",
		"button":     "button",
		"img":        "image",
		"video":      "video",
		"ul":         "list",
		"ol":         "list",
		"form":       "form",
		"code":       "code",
		"pre":        "code",
		"blockquote": "text-basic",
	}
	return mapping[tag]
}

// extractSettings extracts Bricks settings from an HTML element.
// When registry is non-nil, CSS classes are resolved against it:
//   - Resolved classes are added to _cssGlobalClasses ([]interface{} of string IDs)
//   - Unresolved classes are added to _cssClasses (space-separated string)
//
// When registry is nil, the original _cssCustom behavior is preserved.
func extractSettings(n *html.Node, bricksName string, registry *ClassRegistry) map[string]interface{} {
	settings := make(map[string]interface{})

	// Extract text content for text elements
	if bricksName == "heading" || bricksName == "text-basic" || bricksName == "button" || bricksName == "text-link" {
		text := extractText(n)
		if text != "" {
			settings["text"] = text
		}
	}

	// Map heading tag
	if bricksName == "heading" {
		settings["tag"] = n.Data
	}

	// Extract attributes
	for _, attr := range n.Attr {
		switch attr.Key {
		case "class":
			classes := strings.Fields(attr.Val)
			if len(classes) == 0 {
				continue
			}

			if registry != nil {
				// Registry mode: resolve classes
				var globalIDs []interface{}
				var unresolved []string
				for _, cls := range classes {
					if id, _, found := registry.Lookup(cls); found {
						globalIDs = append(globalIDs, id)
					} else {
						unresolved = append(unresolved, cls)
					}
				}
				if len(globalIDs) > 0 {
					settings["_cssGlobalClasses"] = globalIDs
				}
				if len(unresolved) > 0 {
					settings["_cssClasses"] = strings.Join(unresolved, " ")
				}
			} else {
				// Backward compat: store as _cssCustom
				settings["_cssCustom"] = "." + strings.Join(classes, ".")
			}
		case "href":
			if bricksName == "text-link" || bricksName == "button" {
				settings["link"] = map[string]interface{}{
					"type": "external",
					"url":  attr.Val,
				}
			}
		case "src":
			if bricksName == "image" {
				settings["image"] = map[string]interface{}{
					"url": attr.Val,
				}
			}
			if bricksName == "video" {
				settings["videoUrl"] = attr.Val
			}
		case "alt":
			if bricksName == "image" {
				if img, ok := settings["image"].(map[string]interface{}); ok {
					img["alt"] = attr.Val
				}
			}
		case "style":
			styleSettings := ParseInlineStyles(attr.Val)
			for k, v := range styleSettings {
				settings[k] = v
			}
		case "id":
			settings["_htmlId"] = attr.Val
		default:
			// Capture data-* attributes
			if strings.HasPrefix(attr.Key, "data-") {
				attrs, _ := settings["_attributes"].([]interface{})
				attrs = append(attrs, map[string]interface{}{
					"name":  attr.Key,
					"value": attr.Val,
				})
				settings["_attributes"] = attrs
			}
		}
	}

	return settings
}

// extractText gets the direct text content of a node.
func extractText(n *html.Node) string {
	var sb strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.TextNode {
			sb.WriteString(c.Data)
		}
	}
	return strings.TrimSpace(sb.String())
}

func generateID(used map[string]bool) string {
	for {
		b := make([]byte, 3)
		io.ReadFull(rand.Reader, b)
		id := hex.EncodeToString(b)
		if !used[id] {
			used[id] = true
			return id
		}
	}
}

func peekID(used map[string]bool) string {
	// This is a placeholder - actual IDs are assigned during processNode
	return ""
}
