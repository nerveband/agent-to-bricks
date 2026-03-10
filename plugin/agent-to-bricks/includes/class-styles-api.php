<?php
/**
 * Theme Styles and CSS Variables REST API endpoints.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Styles_API {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		// Invalidate CSS vars cache when theme changes or customizer saves
		add_action( 'switch_theme', array( __CLASS__, 'clear_css_cache' ) );
		add_action( 'customize_save_after', array( __CLASS__, 'clear_css_cache' ) );
	}

	public static function clear_css_cache() {
		delete_transient( 'atb_css_vars_cache' );
	}

	public static function register_routes() {
		register_rest_route( 'agent-bricks/v1', '/styles', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_styles' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/variables', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_variables' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
		) );
	}

	public static function check_permission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Extract CSS custom properties without splitting inside strings or functions.
	 */
	private static function extract_custom_properties( string $css, string $source ): array {
		$vars    = array();
		$length  = strlen( $css );
		$quote   = '';
		$escape  = false;
		$comment = false;

		for ( $i = 0; $i < $length; $i++ ) {
			$char = $css[ $i ];
			$next = ( $i + 1 < $length ) ? $css[ $i + 1 ] : '';

			if ( $comment ) {
				if ( '*' === $char && '/' === $next ) {
					$comment = false;
					$i++;
				}
				continue;
			}

			if ( '' !== $quote ) {
				if ( $escape ) {
					$escape = false;
					continue;
				}
				if ( '\\' === $char ) {
					$escape = true;
					continue;
				}
				if ( $char === $quote ) {
					$quote = '';
				}
				continue;
			}

			if ( '/' === $char && '*' === $next ) {
				$comment = true;
				$i++;
				continue;
			}

			if ( '"' === $char || "'" === $char ) {
				$quote = $char;
				continue;
			}

			if ( '-' !== $char || '-' !== $next ) {
				continue;
			}

			$name_start = $i + 2;
			$name_end   = $name_start;

			while ( $name_end < $length && self::is_custom_property_name_char( $css[ $name_end ] ) ) {
				$name_end++;
			}

			if ( $name_end === $name_start ) {
				continue;
			}

			$cursor = $name_end;
			while ( $cursor < $length && ctype_space( $css[ $cursor ] ) ) {
				$cursor++;
			}

			if ( $cursor >= $length || ':' !== $css[ $cursor ] ) {
				continue;
			}

			$value_quote   = '';
			$value_escape  = false;
			$value_comment = false;
			$value_parens  = 0;
			$value         = '';

			for ( $cursor++; $cursor < $length; $cursor++ ) {
				$value_char = $css[ $cursor ];
				$value_next = ( $cursor + 1 < $length ) ? $css[ $cursor + 1 ] : '';

				if ( $value_comment ) {
					if ( '*' === $value_char && '/' === $value_next ) {
						$value      .= '*/';
						$value_comment = false;
						$cursor++;
					} else {
						$value .= $value_char;
					}
					continue;
				}

				if ( '' !== $value_quote ) {
					$value .= $value_char;
					if ( $value_escape ) {
						$value_escape = false;
						continue;
					}
					if ( '\\' === $value_char ) {
						$value_escape = true;
						continue;
					}
					if ( $value_char === $value_quote ) {
						$value_quote = '';
					}
					continue;
				}

				if ( '/' === $value_char && '*' === $value_next ) {
					$value         .= '/*';
					$value_comment = true;
					$cursor++;
					continue;
				}

				if ( '"' === $value_char || "'" === $value_char ) {
					$value_quote = $value_char;
					$value      .= $value_char;
					continue;
				}

				if ( '(' === $value_char ) {
					$value_parens++;
					$value .= $value_char;
					continue;
				}

				if ( ')' === $value_char && $value_parens > 0 ) {
					$value_parens--;
					$value .= $value_char;
					continue;
				}

				if ( ';' === $value_char && 0 === $value_parens ) {
					break;
				}

				$value .= $value_char;
			}

			$vars[] = array(
				'name'   => '--' . substr( $css, $name_start, $name_end - $name_start ),
				'value'  => trim( $value ),
				'source' => $source,
			);

			$i = $cursor;
		}

		return $vars;
	}

	private static function is_custom_property_name_char( string $char ): bool {
		return (bool) preg_match( '/^[A-Za-z0-9_-]$/', $char );
	}

	/**
	 * Scan generated CSS files for custom properties (ACSS, Cwicly, theme).
	 */
	private static function scan_css_files(): array {
		$cached = get_transient( 'atb_css_vars_cache' );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$vars = array();
		$seen = array();
		$upload_dir = wp_upload_dir()['basedir'];
		$scan_dirs  = array(
			$upload_dir . '/automatic-css',
			$upload_dir . '/cwicly',
		);

		// Also scan active theme stylesheet
		$theme_css     = get_stylesheet_directory() . '/style.css';
		$files_to_scan = array();

		foreach ( $scan_dirs as $dir ) {
			if ( is_dir( $dir ) ) {
				$css_files = glob( $dir . '/*.css' );
				if ( $css_files ) {
					$files_to_scan = array_merge( $files_to_scan, $css_files );
				}
			}
		}

		if ( file_exists( $theme_css ) ) {
			$files_to_scan[] = $theme_css;
		}

		foreach ( $files_to_scan as $file ) {
			$css = @file_get_contents( $file );
			if ( empty( $css ) ) {
				continue;
			}
			$source = basename( dirname( $file ) ) . '/' . basename( $file );
			foreach ( self::extract_custom_properties( $css, $source ) as $var ) {
				$name = $var['name'];
				// Deduplicate by name (keep first occurrence)
				if ( ! isset( $seen[ $name ] ) ) {
					$seen[ $name ] = true;
					$vars[] = $var;
				}
			}
		}

		set_transient( 'atb_css_vars_cache', $vars, HOUR_IN_SECONDS );
		return $vars;
	}

	/**
	 * Check if a CSS value looks like a color.
	 */
	private static function is_color_value( string $value ): bool {
		$value = strtolower( trim( $value ) );
		// Hex colors
		if ( preg_match( '/^#[0-9a-f]{3,8}$/', $value ) ) {
			return true;
		}
		// Functional color notations
		if ( preg_match( '/^(rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|color)\s*\(/', $value ) ) {
			return true;
		}
		return false;
	}

	/**
	 * GET /styles — returns theme styles + global settings + CSS colors.
	 */
	public static function get_styles() {
		$theme_styles    = get_option( 'bricks_theme_styles', array() );
		$global_settings = get_option( 'bricks_global_settings', array() );
		$color_palette   = $global_settings['colorPalette'] ?? array();

		// Format theme styles as array with key included
		$styles_list = array();
		foreach ( $theme_styles as $key => $style ) {
			$styles_list[] = array(
				'key'      => $key,
				'label'    => $style['label'] ?? $key,
				'settings' => $style['settings'] ?? array(),
			);
		}

		// Extract colors from scanned CSS custom properties
		$css_vars   = self::scan_css_files();
		$css_colors = array();
		foreach ( $css_vars as $var ) {
			if ( self::is_color_value( $var['value'] ) ) {
				$css_colors[] = array(
					'slug'   => $var['name'],
					'color'  => $var['value'],
					'source' => $var['source'],
				);
			}
		}

		return new WP_REST_Response( array(
			'themeStyles'    => $styles_list,
			'colorPalette'   => $color_palette,
			'cssColors'      => $css_colors,
			'globalSettings' => $global_settings,
		), 200 );
	}

	/**
	 * GET /variables — CSS custom properties from Bricks + scanned CSS files.
	 */
	public static function get_variables() {
		$custom_props = get_option( 'bricks_custom_properties', array() );

		// Also extract CSS variables from theme style _custom CSS
		$theme_styles   = get_option( 'bricks_theme_styles', array() );
		$extracted_vars = array();

		foreach ( $theme_styles as $key => $style ) {
			$custom_css = $style['settings']['_custom'] ?? '';
			if ( ! empty( $custom_css ) ) {
				$extracted_vars = array_merge( $extracted_vars, self::extract_custom_properties( $custom_css, $key ) );
			}
		}

		// Merge in CSS file-scanned variables
		$css_file_vars = self::scan_css_files();
		$seen = array();
		foreach ( $extracted_vars as $v ) {
			$seen[ $v['name'] ] = true;
		}
		foreach ( $css_file_vars as $v ) {
			if ( ! isset( $seen[ $v['name'] ] ) ) {
				$seen[ $v['name'] ] = true;
				$extracted_vars[] = $v;
			}
		}

		return new WP_REST_Response( array(
			'variables'        => is_array( $custom_props ) ? $custom_props : array(),
			'extractedFromCSS' => $extracted_vars,
		), 200 );
	}
}
