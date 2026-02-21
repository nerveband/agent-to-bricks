package convert

import "testing"

func TestParseInlineStyles_Typography(t *testing.T) {
	style := "color: var(--primary); font-size: var(--h2); font-weight: 700; text-align: center"
	settings := ParseInlineStyles(style)

	typo, ok := settings["_typography"].(map[string]interface{})
	if !ok {
		t.Fatal("expected _typography settings")
	}
	color, _ := typo["color"].(map[string]interface{})
	if color["raw"] != "var(--primary)" {
		t.Errorf("expected var(--primary), got %v", color["raw"])
	}
	if typo["font-size"] != "var(--h2)" {
		t.Errorf("expected var(--h2), got %v", typo["font-size"])
	}
	if typo["font-weight"] != "700" {
		t.Errorf("expected 700, got %v", typo["font-weight"])
	}
	if typo["text-align"] != "center" {
		t.Errorf("expected center, got %v", typo["text-align"])
	}
}

func TestParseInlineStyles_Spacing(t *testing.T) {
	style := "padding: var(--space-m); margin-top: var(--space-l)"
	settings := ParseInlineStyles(style)

	pad, ok := settings["_padding"].(map[string]interface{})
	if !ok {
		t.Fatal("expected _padding settings")
	}
	if pad["top"] != "var(--space-m)" || pad["right"] != "var(--space-m)" {
		t.Errorf("expected all sides var(--space-m), got %v", pad)
	}

	margin, ok := settings["_margin"].(map[string]interface{})
	if !ok {
		t.Fatal("expected _margin settings")
	}
	if margin["top"] != "var(--space-l)" {
		t.Errorf("expected var(--space-l), got %v", margin["top"])
	}
}

func TestParseInlineStyles_Background(t *testing.T) {
	style := "background-color: var(--bg-dark)"
	settings := ParseInlineStyles(style)

	bg, ok := settings["_background"].(map[string]interface{})
	if !ok {
		t.Fatal("expected _background settings")
	}
	bgColor, _ := bg["color"].(map[string]interface{})
	if bgColor["raw"] != "var(--bg-dark)" {
		t.Errorf("expected var(--bg-dark), got %v", bgColor["raw"])
	}
}

func TestParseInlineStyles_Layout(t *testing.T) {
	style := "display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 20px; max-width: var(--content-width)"
	settings := ParseInlineStyles(style)

	if settings["_display"] != "flex" {
		t.Errorf("expected flex, got %v", settings["_display"])
	}
	if settings["_direction"] != "column" {
		t.Errorf("expected column, got %v", settings["_direction"])
	}
	if settings["_alignItems"] != "center" {
		t.Errorf("expected center, got %v", settings["_alignItems"])
	}
	if settings["_justifyContent"] != "space-between" {
		t.Errorf("expected space-between, got %v", settings["_justifyContent"])
	}
	if settings["_gap"] != "20px" {
		t.Errorf("expected 20px, got %v", settings["_gap"])
	}
	if settings["_maxWidth"] != "var(--content-width)" {
		t.Errorf("expected var(--content-width), got %v", settings["_maxWidth"])
	}
}

func TestParseInlineStyles_Empty(t *testing.T) {
	settings := ParseInlineStyles("")
	if len(settings) != 0 {
		t.Errorf("expected empty settings for empty style, got %v", settings)
	}
}

func TestExpandBoxShorthand_TwoValues(t *testing.T) {
	result := expandBoxShorthand("10px 20px")
	if result["top"] != "10px" || result["right"] != "20px" || result["bottom"] != "10px" || result["left"] != "20px" {
		t.Errorf("unexpected 2-value shorthand: %v", result)
	}
}

func TestExpandBoxShorthand_FourValues(t *testing.T) {
	result := expandBoxShorthand("10px 20px 30px 40px")
	if result["top"] != "10px" || result["right"] != "20px" || result["bottom"] != "30px" || result["left"] != "40px" {
		t.Errorf("unexpected 4-value shorthand: %v", result)
	}
}
