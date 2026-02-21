package convert

import "strings"

// ParseInlineStyles converts a CSS style string to Bricks settings map.
func ParseInlineStyles(style string) map[string]interface{} {
	settings := make(map[string]interface{})
	pairs := strings.Split(style, ";")

	for _, pair := range pairs {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		parts := strings.SplitN(pair, ":", 2)
		if len(parts) != 2 {
			continue
		}
		prop := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		switch prop {
		case "color":
			ensureTypo(settings)["color"] = map[string]interface{}{"raw": val}
		case "font-size":
			ensureTypo(settings)["font-size"] = val
		case "font-weight":
			ensureTypo(settings)["font-weight"] = val
		case "text-align":
			ensureTypo(settings)["text-align"] = val
		case "line-height":
			ensureTypo(settings)["line-height"] = val
		case "letter-spacing":
			ensureTypo(settings)["letter-spacing"] = val
		case "font-style":
			ensureTypo(settings)["font-style"] = val
		case "text-transform":
			ensureTypo(settings)["text-transform"] = val
		case "padding":
			settings["_padding"] = expandBoxShorthand(val)
		case "padding-top":
			ensurePad(settings)["top"] = val
		case "padding-bottom":
			ensurePad(settings)["bottom"] = val
		case "padding-left":
			ensurePad(settings)["left"] = val
		case "padding-right":
			ensurePad(settings)["right"] = val
		case "margin":
			settings["_margin"] = expandBoxShorthand(val)
		case "margin-top":
			ensureMargin(settings)["top"] = val
		case "margin-bottom":
			ensureMargin(settings)["bottom"] = val
		case "margin-left":
			ensureMargin(settings)["left"] = val
		case "margin-right":
			ensureMargin(settings)["right"] = val
		case "background-color", "background":
			settings["_background"] = map[string]interface{}{
				"color": map[string]interface{}{"raw": val},
			}
		case "gap":
			settings["_gap"] = val
		case "row-gap":
			settings["_rowGap"] = val
		case "column-gap":
			settings["_columnGap"] = val
		case "max-width":
			settings["_maxWidth"] = val
		case "width":
			settings["_width"] = val
		case "min-height":
			settings["_minHeight"] = val
		case "height":
			settings["_height"] = val
		case "display":
			settings["_display"] = val
		case "flex-direction":
			settings["_direction"] = val
		case "align-items":
			settings["_alignItems"] = val
		case "justify-content":
			settings["_justifyContent"] = val
		case "grid-template-columns":
			settings["_gridTemplateColumns"] = val
		case "grid-template-rows":
			settings["_gridTemplateRows"] = val
		case "border-radius":
			settings["_borderRadius"] = val
		case "overflow":
			settings["_overflow"] = val
		case "position":
			settings["_position"] = val
		case "z-index":
			settings["_zIndex"] = val
		case "opacity":
			settings["_opacity"] = val
		}
	}
	return settings
}

func ensureTypo(s map[string]interface{}) map[string]interface{} {
	if t, ok := s["_typography"].(map[string]interface{}); ok {
		return t
	}
	t := make(map[string]interface{})
	s["_typography"] = t
	return t
}

func ensurePad(s map[string]interface{}) map[string]interface{} {
	if p, ok := s["_padding"].(map[string]interface{}); ok {
		return p
	}
	p := make(map[string]interface{})
	s["_padding"] = p
	return p
}

func ensureMargin(s map[string]interface{}) map[string]interface{} {
	if m, ok := s["_margin"].(map[string]interface{}); ok {
		return m
	}
	m := make(map[string]interface{})
	s["_margin"] = m
	return m
}

func expandBoxShorthand(val string) map[string]interface{} {
	parts := strings.Fields(val)
	switch len(parts) {
	case 1:
		return map[string]interface{}{"top": parts[0], "right": parts[0], "bottom": parts[0], "left": parts[0]}
	case 2:
		return map[string]interface{}{"top": parts[0], "right": parts[1], "bottom": parts[0], "left": parts[1]}
	case 3:
		return map[string]interface{}{"top": parts[0], "right": parts[1], "bottom": parts[2], "left": parts[1]}
	case 4:
		return map[string]interface{}{"top": parts[0], "right": parts[1], "bottom": parts[2], "left": parts[3]}
	default:
		return map[string]interface{}{"top": val, "right": val, "bottom": val, "left": val}
	}
}
