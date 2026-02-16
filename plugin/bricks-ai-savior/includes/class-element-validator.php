<?php
/**
 * Validates and sanitizes AI-generated Bricks element JSON.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BricksAI_Element_Validator {

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
	 * Sanitize element settings.
	 */
	private static function sanitize_settings( $settings ) {
		$clean = array();

		foreach ( $settings as $key => $value ) {
			$key = sanitize_text_field( $key );

			if ( $key === '_cssGlobalClasses' ) {
				// Must be array of strings.
				if ( is_array( $value ) ) {
					$clean[ $key ] = array_map( 'sanitize_text_field', $value );
				}
			} elseif ( $key === 'text' ) {
				// Allow HTML in text content (Bricks supports rich text).
				$clean[ $key ] = wp_kses_post( $value );
			} elseif ( $key === 'tag' ) {
				$clean[ $key ] = sanitize_text_field( $value );
			} elseif ( $key === 'link' && is_array( $value ) ) {
				$clean[ $key ] = array(
					'type'   => sanitize_text_field( $value['type'] ?? 'external' ),
					'url'    => esc_url_raw( $value['url'] ?? '#' ),
					'newTab' => ! empty( $value['newTab'] ),
				);
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
	 * Check if array is sequential (numerically indexed) vs associative.
	 */
	private static function is_sequential( $arr ) {
		if ( empty( $arr ) ) return true;
		return array_keys( $arr ) === range( 0, count( $arr ) - 1 );
	}
}
