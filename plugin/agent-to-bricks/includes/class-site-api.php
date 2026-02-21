<?php
/**
 * Site info and framework detection REST API endpoints.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Site_API {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		register_rest_route( 'agent-bricks/v1', '/site/info', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_info' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
		) );

		register_rest_route( 'agent-bricks/v1', '/site/frameworks', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_frameworks' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
		) );
	}

	public static function check_permission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * GET /site/info — Bricks environment info.
	 */
	public static function get_info() {
		$breakpoints = get_option( 'bricks_breakpoints', array() );
		if ( empty( $breakpoints ) && class_exists( '\Bricks\Breakpoints' ) ) {
			$breakpoints = \Bricks\Breakpoints::$breakpoints ?? array();
		}

		$element_types = array();
		if ( class_exists( '\Bricks\Elements' ) && ! empty( \Bricks\Elements::$elements ) ) {
			$element_types = array_keys( \Bricks\Elements::$elements );
		}

		return new WP_REST_Response( array(
			'bricksVersion'  => defined( 'BRICKS_VERSION' ) ? BRICKS_VERSION : null,
			'contentMetaKey' => ATB_Bricks_Lifecycle::content_meta_key(),
			'elementTypes'   => $element_types,
			'breakpoints'    => $breakpoints,
			'pluginVersion'  => defined( 'AGENT_BRICKS_VERSION' ) ? AGENT_BRICKS_VERSION : null,
			'phpVersion'     => PHP_VERSION,
			'wpVersion'      => get_bloginfo( 'version' ),
		), 200 );
	}

	/**
	 * GET /site/frameworks — detect CSS frameworks (ACSS, etc.).
	 */
	public static function get_frameworks() {
		$frameworks = array();

		// Detect Automatic.css
		$active_plugins = get_option( 'active_plugins', array() );
		$acss_active = false;
		foreach ( $active_plugins as $plugin ) {
			if ( stripos( $plugin, 'automaticcss' ) !== false || stripos( $plugin, 'acss' ) !== false ) {
				$acss_active = true;
				break;
			}
		}

		if ( $acss_active ) {
			$acss_settings = get_option( 'automatic_css_settings', array() );
			$settings_keys = is_array( $acss_settings ) ? array_keys( $acss_settings ) : array();

			// Count ACSS-imported global classes
			$all_classes = get_option( 'bricks_global_classes', array() );
			$acss_classes = array_filter( $all_classes, function( $c ) {
				return strpos( $c['id'] ?? '', 'acss_import_' ) === 0;
			} );

			// Extract key design tokens
			$colors = array();
			foreach ( array( 'primary', 'secondary', 'accent', 'base', 'neutral' ) as $family ) {
				$key = "color-$family";
				if ( isset( $acss_settings[ $key ] ) ) {
					$colors[ $family ] = $acss_settings[ $key ];
				}
			}

			$frameworks['acss'] = array(
				'name'         => 'Automatic.css',
				'active'       => true,
				'version'      => get_option( 'automatic_css_db_version', '' ),
				'settingsKeys' => $settings_keys,
				'classCount'   => count( $acss_classes ),
				'colors'       => $colors,
				'spacing'      => array(
					'scale'          => $acss_settings['space-scale'] ?? '',
					'sectionPadding' => $acss_settings['section-padding-block'] ?? '',
				),
				'typography'   => array(
					'rootFontSize'    => $acss_settings['root-font-size'] ?? '',
					'textFontFamily'  => $acss_settings['text-font-family'] ?? '',
					'headingFontFamily' => $acss_settings['heading-font-family'] ?? '',
				),
			);
		}

		return new WP_REST_Response( array( 'frameworks' => $frameworks ), 200 );
	}
}
