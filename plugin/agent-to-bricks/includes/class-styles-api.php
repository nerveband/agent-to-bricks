<?php
/**
 * Theme Styles and CSS Variables REST API endpoints.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Styles_API {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
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
			if ( preg_match_all( '/--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/', $css, $matches, PREG_SET_ORDER ) ) {
				foreach ( $matches as $m ) {
					$name  = '--' . $m[1];
					$value = trim( $m[2] );
					// Deduplicate by name (keep first occurrence)
					if ( ! isset( $seen[ $name ] ) ) {
						$seen[ $name ] = true;
						$vars[] = array(
							'name'   => $name,
							'value'  => $value,
							'source' => $source,
						);
					}
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
				// Extract --var-name: value patterns from :root or body blocks
				if ( preg_match_all( '/--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/', $custom_css, $matches, PREG_SET_ORDER ) ) {
					foreach ( $matches as $m ) {
						$extracted_vars[] = array(
							'name'   => '--' . $m[1],
							'value'  => trim( $m[2] ),
							'source' => $key,
						);
					}
				}
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
