<?php
/**
 * System prompt builder for LLM requests.
 *
 * Constructs the system prompt with element schema, ACSS context,
 * and page context for section, full-page, or modify modes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BricksAI_System_Prompt {

	/**
	 * Build the system prompt for the given mode.
	 *
	 * @param string $mode    "section", "page", or "modify"
	 * @param array  $context Optional context: acssClasses, sections, currentElement
	 * @return string
	 */
	public static function build( $mode, $context = array() ) {
		$parts = array();

		$parts[] = self::role_intro( $mode );
		$parts[] = self::element_schema();
		$parts[] = self::structure_rules( $mode );
		$parts[] = self::output_format();
		$parts[] = self::acss_reference( $context );

		if ( ! empty( $context['sections'] ) ) {
			$parts[] = self::page_context( $context['sections'] );
		}

		if ( $mode === 'modify' && ! empty( $context['currentElement'] ) ) {
			$parts[] = self::modify_context( $context['currentElement'] );
		}

		return implode( "\n\n", array_filter( $parts ) );
	}

	private static function role_intro( $mode ) {
		if ( $mode === 'modify' ) {
			return <<<'PROMPT'
You are a Bricks Builder element modifier for WordPress.
You will receive an existing element (and its children) along with a user instruction.
Apply the user's requested changes and return the modified element(s).
PROMPT;
		}

		if ( $mode === 'page' ) {
			return <<<'PROMPT'
You are a Bricks Builder page generator for WordPress.
Generate MULTIPLE sections forming a complete page layout based on the user's request.
Each section should be a separate top-level element in the elements array.
Include appropriate sections like hero, content areas, CTAs, etc. as the prompt suggests.
PROMPT;
		}

		// Default: section mode.
		return <<<'PROMPT'
You are a Bricks Builder element generator for WordPress.
Generate a SINGLE section with appropriate children based on the user's request.
The output should be one section element containing containers and content elements.
PROMPT;
	}

	private static function element_schema() {
		return <<<'PROMPT'
## Element Schema

Return a JSON object with this structure:
{
  "elements": [ ...nested element nodes... ],
  "explanation": "Brief description of what was generated"
}

Each element node has this shape:
{
  "name": "elementType",
  "label": "Display Name (shown in structure panel)",
  "settings": {
    "text": "Text content for heading/text/button elements",
    "tag": "HTML tag (h1-h6, div, p, span, etc.)",
    "_cssGlobalClasses": ["className1", "className2"],
    "_cssClasses": "custom-class-1 custom-class-2",
    "link": { "type": "external", "url": "#", "newTab": false }
  },
  "children": [ ...child element nodes... ]
}

### Available Element Types
- **Layout:** section, container, block, div
- **Typography:** heading, text-basic, rich-text, text-link
- **Interactive:** button, icon, image, video
- **Navigation:** nav-menu, nav-nested, offcanvas
- **Components:** accordion, accordion-nested, tabs, tabs-nested, slider, slider-nested
- **Data:** form, map, code, template, post-content, posts, pagination

### Settings Reference
- `text` — Content string (heading, text-basic, button)
- `tag` — HTML tag override (h1-h6, div, p, section, article, nav, etc.)
- `_cssGlobalClasses` — Array of global class NAMES (will be resolved to IDs)
- `_cssClasses` — Space-separated custom CSS class string
- `_cssId` — Custom CSS ID
- `link` — Link object: { type: "external"|"internal", url: "", newTab: false }
- `style` — Button style variant
- `size` — Button size
- `_typography` — Typography overrides { "font-size": "2rem", "font-weight": "700" }
- `_background` — Background settings
- `_border` — Border and border-radius
PROMPT;
	}

	private static function structure_rules( $mode ) {
		$rules = <<<'PROMPT'
## Structure Rules

1. Top level must be "section" element(s)
2. Each section contains one or more "container" children
3. Containers hold content elements (heading, text-basic, button, image, block, div)
4. Use "block" for flex rows/columns inside containers (e.g., side-by-side buttons)
5. Use "div" for generic wrapper elements
6. Every element that has content must have a "text" setting
7. Always set meaningful "label" values for the structure panel
8. Use semantic HTML tags via the "tag" setting where appropriate
9. settings must always be an object {}, never an array []
10. _cssGlobalClasses should contain class NAMES (not IDs) — they will be resolved automatically
PROMPT;

		if ( $mode === 'page' ) {
			$rules .= "\n11. Generate multiple top-level sections, each as a separate element in the elements array";
			$rules .= "\n12. Include variety — hero, content sections, feature grids, testimonials, CTAs as appropriate";
		}

		return $rules;
	}

	private static function output_format() {
		return <<<'PROMPT'
## Output Format

Return ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON.

Example (section mode):
{
  "elements": [
    {
      "name": "section",
      "label": "Hero Section",
      "settings": {},
      "children": [
        {
          "name": "container",
          "label": "Hero Container",
          "settings": {},
          "children": [
            {
              "name": "heading",
              "label": "Hero Heading",
              "settings": { "text": "Welcome to Our Site", "tag": "h1" },
              "children": []
            },
            {
              "name": "text-basic",
              "label": "Hero Subtitle",
              "settings": { "text": "We build amazing things." },
              "children": []
            }
          ]
        }
      ]
    }
  ],
  "explanation": "Hero section with heading and subtitle text"
}
PROMPT;
	}

	private static function acss_reference( $context ) {
		$parts = array();
		$parts[] = '## Available ACSS Variables';
		$parts[] = 'Spacing: --space-xs, --space-s, --space-m, --space-l, --space-xl';
		$parts[] = 'Section spacing: --section-space-s, --section-space-m, --section-space-l';
		$parts[] = 'Typography: --h1 through --h6, --text-s, --text-m, --text-l';
		$parts[] = 'Colors: --primary, --secondary, --accent, --base, --neutral';
		$parts[] = 'Grid: --grid-2, --grid-3, --grid-4, --gutter';

		if ( ! empty( $context['acssClasses'] ) ) {
			$parts[] = '';
			$parts[] = '## Available ACSS Global Classes';
			$parts[] = 'Use these class NAMES in _cssGlobalClasses arrays. They will be resolved to IDs automatically.';
			$parts[] = '';

			// Group classes by prefix.
			$grouped = array();
			foreach ( $context['acssClasses'] as $cls ) {
				$name = $cls['name'] ?? '';
				if ( empty( $name ) ) continue;

				$prefix = 'Other';
				if ( strpos( $name, 'btn' ) === 0 )      $prefix = 'Buttons';
				elseif ( strpos( $name, 'space' ) === 0 ) $prefix = 'Spacing';
				elseif ( strpos( $name, 'grid' ) === 0 )  $prefix = 'Grid';
				elseif ( strpos( $name, 'text' ) === 0 )  $prefix = 'Typography';
				elseif ( strpos( $name, 'heading' ) === 0 || strpos( $name, 'h-' ) === 0 ) $prefix = 'Headings';
				elseif ( strpos( $name, 'section' ) === 0 ) $prefix = 'Sections';
				elseif ( strpos( $name, 'flex' ) === 0 || strpos( $name, 'f-' ) === 0 )   $prefix = 'Flex';
				elseif ( strpos( $name, 'pad' ) === 0 )   $prefix = 'Padding';
				elseif ( strpos( $name, 'margin' ) === 0 || strpos( $name, 'mt-' ) === 0 || strpos( $name, 'mb-' ) === 0 ) $prefix = 'Margin';

				$grouped[ $prefix ][] = $name;
			}

			foreach ( $grouped as $group => $names ) {
				$parts[] = "**{$group}:** " . implode( ', ', array_slice( $names, 0, 20 ) );
			}
		}

		return implode( "\n", $parts );
	}

	private static function page_context( $sections ) {
		if ( empty( $sections ) ) return '';

		$lines = array( '## Current Page Sections (for context)' );
		foreach ( $sections as $i => $section ) {
			$label = $section['label'] ?? $section['name'] ?? 'Section';
			$lines[] = ( $i + 1 ) . ". {$label}";
		}
		return implode( "\n", $lines );
	}

	private static function modify_context( $element ) {
		$json = wp_json_encode( $element, JSON_PRETTY_PRINT );
		return <<<PROMPT
## Current Element (to modify)

Here is the element and its children as they currently exist:

```json
{$json}
```

Apply the user's instruction to this element. Return the modified version with the same structure.
Keep any unchanged properties intact. Only modify what the user asks for.
PROMPT;
	}
}
