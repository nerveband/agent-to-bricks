<?php
/**
 * Validates and sanitizes AI-generated Bricks element JSON.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATB_Element_Validator {

	/**
	 * Known valid Bricks element type names.
	 */
	private static $valid_types = array(
		'section', 'container', 'block', 'div',
		'heading', 'text-basic', 'rich-text', 'text-link',
		'button', 'icon', 'image', 'video',
		'nav-menu', 'nav-nested', 'offcanvas',
		'accordion', 'accordion-nested', 'tabs', 'tabs-nested',
		'slider', 'slider-nested', 'carousel',
		'form', 'map', 'code', 'template',
		'post-content', 'posts', 'pagination',
	);

	/**
	 * Validate the full LLM response.
	 *
	 * @param array $data Parsed JSON from LLM.
	 * @return array { valid: bool, elements: array, errors: string[], warnings: string[] }
	 */
	public static function validate( $data ) {
		$result = array(
			'valid'    => true,
			'elements' => array(),
			'errors'   => array(),
			'warnings' => array(),
		);

		if ( ! is_array( $data ) ) {
			$result['valid'] = false;
			$result['errors'][] = 'Response is not a valid object.';
			return $result;
		}

		if ( empty( $data['elements'] ) || ! is_array( $data['elements'] ) ) {
			$result['valid'] = false;
			$result['errors'][] = 'Response missing "elements" array.';
			return $result;
		}

		$validated = array();
		foreach ( $data['elements'] as $i => $node ) {
			$clean = self::validate_node( $node, "elements[$i]", $result );
			if ( $clean ) {
				$validated[] = $clean;
			}
		}

		if ( empty( $validated ) ) {
			$result['valid'] = false;
			$result['errors'][] = 'No valid elements after validation.';
		}

		$result['elements'] = $validated;
		return $result;
	}

	/**
	 * Validate a single element node recursively.
	 */
	private static function validate_node( $node, $path, &$result ) {
		if ( ! is_array( $node ) ) {
			$result['errors'][] = "$path: Not a valid object.";
			return null;
		}

		// Name is required.
		if ( empty( $node['name'] ) || ! is_string( $node['name'] ) ) {
			$result['errors'][] = "$path: Missing or invalid 'name' field.";
			return null;
		}

		$name = sanitize_text_field( $node['name'] );

		// Warn on unknown element types but don't reject (Bricks may have custom elements).
		if ( ! in_array( $name, self::$valid_types, true ) ) {
			$result['warnings'][] = "$path: Unknown element type '$name'.";
		}

		$clean = array(
			'name' => $name,
		);

		// Label.
		if ( ! empty( $node['label'] ) && is_string( $node['label'] ) ) {
			$clean['label'] = sanitize_text_field( $node['label'] );
		}

		// Settings must be an object, not an array.
		if ( isset( $node['settings'] ) ) {
			if ( is_array( $node['settings'] ) && ! self::is_sequential( $node['settings'] ) ) {
				$clean['settings'] = self::sanitize_settings( $node['settings'] );
			} else {
				$clean['settings'] = array();
				$result['warnings'][] = "$path: Settings was not an object, reset to {}.";
			}
		} else {
			$clean['settings'] = array();
		}

		// Children.
		$clean['children'] = array();
		if ( ! empty( $node['children'] ) && is_array( $node['children'] ) ) {
			foreach ( $node['children'] as $j => $child ) {
				$child_clean = self::validate_node( $child, "$path.children[$j]", $result );
				if ( $child_clean ) {
					$clean['children'][] = $child_clean;
				}
			}
		}

		return $clean;
	}

	/**
	 * Sanitize a flat array of Bricks elements (as stored in post meta).
	 *
	 * Unlike validate() which handles nested LLM output, this method works
	 * with the flat array format used by Bricks internally and the CRUD API.
	 *
	 * @param array $elements Flat array of element arrays.
	 * @return array Sanitized elements.
	 */
	public static function sanitize_flat_elements( $elements ) {
		if ( ! is_array( $elements ) ) {
			return array();
		}

		$clean = array();
		foreach ( $elements as $el ) {
			if ( ! is_array( $el ) ) {
				continue;
			}

			$sanitized = array();

			// Preserve id as-is (alphanumeric Bricks IDs).
			if ( isset( $el['id'] ) ) {
				$sanitized['id'] = sanitize_text_field( $el['id'] );
			}

			// Sanitize name (element type).
			if ( isset( $el['name'] ) ) {
				$sanitized['name'] = sanitize_text_field( $el['name'] );
			}

			// Sanitize label.
			if ( isset( $el['label'] ) ) {
				$sanitized['label'] = sanitize_text_field( $el['label'] );
			}

			// Sanitize parent ID.
			if ( isset( $el['parent'] ) ) {
				$sanitized['parent'] = sanitize_text_field( $el['parent'] );
			}

			// Children is an array of IDs in flat format.
			if ( isset( $el['children'] ) && is_array( $el['children'] ) ) {
				$sanitized['children'] = array_map( 'sanitize_text_field', $el['children'] );
			}

			// Sanitize settings using the same logic as LLM validation.
			if ( isset( $el['settings'] ) && is_array( $el['settings'] ) ) {
				$sanitized['settings'] = self::sanitize_settings( $el['settings'] );
			}

			// Preserve any other scalar fields (e.g., custom Bricks metadata).
			foreach ( $el as $key => $value ) {
				if ( isset( $sanitized[ $key ] ) ) {
					continue;
				}
				if ( is_string( $value ) ) {
					$sanitized[ $key ] = sanitize_text_field( $value );
				} elseif ( is_numeric( $value ) || is_bool( $value ) ) {
					$sanitized[ $key ] = $value;
				} elseif ( is_array( $value ) ) {
					$sanitized[ $key ] = self::sanitize_settings( $value );
				}
			}

			$clean[] = $sanitized;
		}

		return $clean;
	}

	/**
	 * Settings keys that contain CSS code (multi-line, no HTML tags).
	 */
	private static $css_keys = array(
		'_cssCustom', '_cssHover', '_cssTransition', '_rawCSS',
	);

	/**
	 * Settings keys that contain rich HTML content.
	 */
	private static $html_keys = array(
		'text', 'content',
	);

	/**
	 * Sanitize element settings.
	 *
	 * Follows WordPress's own pattern: users with `unfiltered_html` capability
	 * (administrators) get lighter filtering so CLI roundtrips are lossless.
	 * Lower-privilege users get full kses filtering.
	 */
	public static function sanitize_settings( $settings ) {
		$clean = array();
		$unfiltered = current_user_can( 'unfiltered_html' );

		foreach ( $settings as $key => $value ) {
			$key = sanitize_text_field( $key );

			if ( $key === '_cssGlobalClasses' ) {
				// Must be array of strings.
				if ( is_array( $value ) ) {
					$clean[ $key ] = array_map( 'sanitize_text_field', $value );
				}
			} elseif ( in_array( $key, self::$html_keys, true ) ) {
				// Rich text fields: allow safe HTML.
				if ( is_string( $value ) ) {
					$clean[ $key ] = $unfiltered ? $value : wp_kses_post( $value );
				}
			} elseif ( in_array( $key, self::$css_keys, true ) ) {
				// CSS code: strip HTML tags, ensure readable formatting.
				if ( is_string( $value ) ) {
					$clean[ $key ] = self::prettify_css( wp_strip_all_tags( $value ) );
				}
			} elseif ( $key === 'code' ) {
				// Code element content (raw HTML/JS/CSS by design).
				// Admins can embed <script>/<style> — same as Bricks editor allows.
				if ( is_string( $value ) ) {
					$clean[ $key ] = $unfiltered ? $value : wp_kses_post( $value );
				}
			} elseif ( $key === 'tag' ) {
				$clean[ $key ] = sanitize_text_field( $value );
			} elseif ( $key === 'link' && is_array( $value ) ) {
				$clean[ $key ] = self::sanitize_link( $value );
			} elseif ( $key === '_attributes' && is_array( $value ) ) {
				$clean[ $key ] = self::sanitize_attributes( $value );
			} elseif ( is_string( $value ) ) {
				$clean[ $key ] = sanitize_text_field( $value );
			} elseif ( is_numeric( $value ) || is_bool( $value ) ) {
				$clean[ $key ] = $value;
			} elseif ( is_array( $value ) ) {
				// Recursively sanitize nested objects/arrays.
				$clean[ $key ] = self::sanitize_settings( $value );
			}
		}

		return $clean;
	}

	/**
	 * Prettify a CSS string by adding line breaks if missing.
	 *
	 * Skips strings that already contain newlines (already formatted).
	 * Produces readable output that matches what the Bricks editor expects.
	 */
	private static function prettify_css( $css ) {
		$css = trim( $css );

		if ( '' === $css || strpos( $css, "\n" ) !== false ) {
			return $css;
		}

		// Newline after opening brace.
		$css = preg_replace( '/\{\s*/', " {\n  ", $css );
		// Newline before closing brace.
		$css = preg_replace( '/\s*\}/', "\n}", $css );
		// Newline after semicolons (but not inside url() or data: values).
		$css = preg_replace( '/;\s*(?![\s}])/', ";\n  ", $css );
		// Blank line between rule blocks for readability.
		$css = preg_replace( '/\}\s*([^\s])/', "}\n\n$1", $css );

		return trim( $css );
	}

	/**
	 * Sanitize a link settings object.
	 */
	private static function sanitize_link( $value ) {
		$clean = array(
			'type'   => sanitize_text_field( $value['type'] ?? 'external' ),
			'url'    => esc_url_raw( $value['url'] ?? '#' ),
			'newTab' => ! empty( $value['newTab'] ),
		);
		// Preserve other link properties (e.g., postId for internal links).
		foreach ( $value as $k => $v ) {
			if ( isset( $clean[ $k ] ) ) {
				continue;
			}
			if ( is_string( $v ) ) {
				$clean[ $k ] = sanitize_text_field( $v );
			} elseif ( is_numeric( $v ) || is_bool( $v ) ) {
				$clean[ $k ] = $v;
			}
		}
		return $clean;
	}

	/**
	 * Sanitize custom HTML attributes array.
	 * Each entry has 'name' and 'value' keys.
	 *
	 * Validates attribute name format but does NOT block event handlers —
	 * Bricks supports them natively and CLI roundtrips must be lossless.
	 */
	private static function sanitize_attributes( $attributes ) {
		$clean = array();
		foreach ( $attributes as $attr ) {
			if ( ! is_array( $attr ) ) {
				continue;
			}
			$name = $attr['name'] ?? '';
			// Only allow valid attribute names (letters, digits, hyphens, underscores, data-*).
			if ( ! preg_match( '/^[a-zA-Z_][a-zA-Z0-9_:-]*$/', $name ) ) {
				continue;
			}
			$clean[] = array(
				'name'  => $name,
				'value' => sanitize_text_field( $attr['value'] ?? '' ),
			);
		}
		return $clean;
	}

	/**
	 * Check if array is sequential (numerically indexed) vs associative.
	 */
	private static function is_sequential( $arr ) {
		if ( empty( $arr ) ) return true;
		return array_keys( $arr ) === range( 0, count( $arr ) - 1 );
	}
}
