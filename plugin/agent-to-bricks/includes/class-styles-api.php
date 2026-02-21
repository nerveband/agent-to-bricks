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
	 * GET /styles — returns theme styles + global settings.
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

		return new WP_REST_Response( array(
			'themeStyles'    => $styles_list,
			'colorPalette'   => $color_palette,
			'globalSettings' => $global_settings,
		), 200 );
	}

	/**
	 * GET /variables — CSS custom properties from Bricks.
	 */
	public static function get_variables() {
		$custom_props = get_option( 'bricks_custom_properties', array() );

		// Also extract CSS variables from theme style _custom CSS
		$theme_styles  = get_option( 'bricks_theme_styles', array() );
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

		return new WP_REST_Response( array(
			'variables'        => is_array( $custom_props ) ? $custom_props : array(),
			'extractedFromCSS' => $extracted_vars,
		), 200 );
	}
}
