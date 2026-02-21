package convert_test

import (
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/convert"
)

func TestConvertSimpleHTML(t *testing.T) {
	html := `<section><h1>Hello</h1><p>World</p></section>`
	elements, err := convert.HTMLToBricks(html)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(elements) != 3 {
		t.Fatalf("expected 3 elements, got %d", len(elements))
	}

	// First should be section
	if elements[0]["name"] != "section" {
		t.Errorf("expected section, got %s", elements[0]["name"])
	}

	// Second should be heading
	if elements[1]["name"] != "heading" {
		t.Errorf("expected heading, got %s", elements[1]["name"])
	}

	// Third should be text-basic (p)
	if elements[2]["name"] != "text-basic" {
		t.Errorf("expected text-basic, got %s", elements[2]["name"])
	}
}

func TestConvertHeadingTag(t *testing.T) {
	html := `<h2>Test Heading</h2>`
	elements, err := convert.HTMLToBricks(html)
	if err != nil {
		t.Fatal(err)
	}

	if len(elements) != 1 {
		t.Fatalf("expected 1 element, got %d", len(elements))
	}

	settings, _ := elements[0]["settings"].(map[string]interface{})
	if settings["tag"] != "h2" {
		t.Errorf("expected tag h2, got %v", settings["tag"])
	}
	if settings["text"] != "Test Heading" {
		t.Errorf("expected text 'Test Heading', got %v", settings["text"])
	}
}

func TestConvertImage(t *testing.T) {
	html := `<img src="https://example.com/photo.jpg" alt="Photo">`
	elements, err := convert.HTMLToBricks(html)
	if err != nil {
		t.Fatal(err)
	}

	if len(elements) != 1 {
		t.Fatalf("expected 1 element, got %d", len(elements))
	}

	if elements[0]["name"] != "image" {
		t.Errorf("expected image, got %s", elements[0]["name"])
	}

	settings, _ := elements[0]["settings"].(map[string]interface{})
	img, _ := settings["image"].(map[string]interface{})
	if img == nil {
		t.Fatal("expected image settings")
	}
	if img["url"] != "https://example.com/photo.jpg" {
		t.Errorf("expected image URL, got %v", img["url"])
	}
}

func TestConvertLink(t *testing.T) {
	html := `<a href="https://example.com">Click here</a>`
	elements, err := convert.HTMLToBricks(html)
	if err != nil {
		t.Fatal(err)
	}

	if len(elements) != 1 {
		t.Fatalf("expected 1 element, got %d", len(elements))
	}

	if elements[0]["name"] != "text-link" {
		t.Errorf("expected text-link, got %s", elements[0]["name"])
	}

	settings, _ := elements[0]["settings"].(map[string]interface{})
	link, _ := settings["link"].(map[string]interface{})
	if link == nil {
		t.Fatal("expected link settings")
	}
	if link["url"] != "https://example.com" {
		t.Errorf("expected URL, got %v", link["url"])
	}
}

func TestConvertParentChildren(t *testing.T) {
	html := `<section><h1>Title</h1></section>`
	elements, err := convert.HTMLToBricks(html)
	if err != nil {
		t.Fatal(err)
	}

	if len(elements) != 2 {
		t.Fatalf("expected 2 elements, got %d", len(elements))
	}

	// Section's children should contain heading ID
	sectionID, _ := elements[0]["id"].(string)
	headingID, _ := elements[1]["id"].(string)
	headingParent, _ := elements[1]["parent"].(string)

	if headingParent != sectionID {
		t.Errorf("heading parent should be section: %s != %s", headingParent, sectionID)
	}

	children, _ := elements[0]["children"].([]interface{})
	if len(children) != 1 || children[0] != headingID {
		t.Errorf("section children should contain heading: %v", children)
	}
}

func TestConvertButton(t *testing.T) {
	html := `<button>Submit</button>`
	elements, err := convert.HTMLToBricks(html)
	if err != nil {
		t.Fatal(err)
	}

	if len(elements) != 1 {
		t.Fatalf("expected 1 element, got %d", len(elements))
	}

	if elements[0]["name"] != "button" {
		t.Errorf("expected button, got %s", elements[0]["name"])
	}

	settings, _ := elements[0]["settings"].(map[string]interface{})
	if settings["text"] != "Submit" {
		t.Errorf("expected text 'Submit', got %v", settings["text"])
	}
}

func TestConvertEmptyHTML(t *testing.T) {
	elements, err := convert.HTMLToBricks("")
	if err != nil {
		t.Fatal(err)
	}
	if len(elements) != 0 {
		t.Errorf("expected 0 elements for empty HTML, got %d", len(elements))
	}
}

func TestConvertClassAttribute(t *testing.T) {
	html := `<div class="hero dark-bg"></div>`
	elements, err := convert.HTMLToBricks(html)
	if err != nil {
		t.Fatal(err)
	}

	if len(elements) != 1 {
		t.Fatalf("expected 1 element, got %d", len(elements))
	}

	settings, _ := elements[0]["settings"].(map[string]interface{})
	css, _ := settings["_cssCustom"].(string)
	if css != ".hero.dark-bg" {
		t.Errorf("expected '.hero.dark-bg', got '%s'", css)
	}
}
