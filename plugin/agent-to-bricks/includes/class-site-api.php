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

		register_rest_route( 'agent-bricks/v1', '/site/element-types', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_element_types' ],
			'permission_callback' => [ __CLASS__, 'check_permission' ],
		] );
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

	/**
	 * GET /site/element-types — rich element type metadata with optional controls.
	 */
	public static function get_element_types( WP_REST_Request $request ): WP_REST_Response {
		$include_controls = (bool) $request->get_param( 'include_controls' );
		$category_filter  = $request->get_param( 'category' );

		if ( ! class_exists( '\Bricks\Elements' ) || empty( \Bricks\Elements::$elements ) ) {
			return new WP_REST_Response( [
				'elementTypes' => [],
				'count'        => 0,
			], 200 );
		}

		$types = [];

		foreach ( \Bricks\Elements::$elements as $name => $entry ) {
			$label    = '';
			$category = 'general';
			$icon     = '';
			$controls = [];

			// Bricks stores entries as arrays with 'class', 'name', 'label' keys.
			// Use get_element() to retrieve the fully populated element data.
			if ( is_array( $entry ) && method_exists( '\Bricks\Elements', 'get_element' ) ) {
				$full = \Bricks\Elements::get_element( [ 'name' => $name ] );
				if ( is_array( $full ) ) {
					$label    = $full['label'] ?? $name;
					$category = $full['category'] ?? 'general';
					$icon     = $full['icon'] ?? '';

					if ( $include_controls && ! empty( $full['controls'] ) ) {
						$controls = $full['controls'];
					}
				} else {
					$label = $entry['label'] ?? $name;
				}
			} elseif ( is_object( $entry ) ) {
				$label    = $entry->label ?? $name;
				$category = $entry->category ?? 'general';
				$icon     = $entry->icon ?? '';

				if ( $include_controls && method_exists( $entry, 'set_controls' ) ) {
					$entry->set_controls();
					$controls = $entry->controls ?? [];
				}
			} elseif ( is_string( $entry ) && class_exists( $entry ) ) {
				try {
					$instance = new $entry();
					$label    = $instance->label ?? $name;
					$category = $instance->category ?? 'general';
					$icon     = $instance->icon ?? '';

					if ( $include_controls && method_exists( $instance, 'set_controls' ) ) {
						$instance->set_controls();
						$controls = $instance->controls ?? [];
					}
				} catch ( \Throwable $e ) {
					$label = $name;
				}
			}

			if ( $category_filter && $category !== $category_filter ) {
				continue;
			}

			$type_data = [
				'name'     => $name,
				'label'    => $label,
				'category' => $category,
				'icon'     => $icon,
			];

			if ( $include_controls && ! empty( $controls ) ) {
				$type_data['controls'] = self::sanitize_controls( $controls );
			}

			$types[] = $type_data;
		}

		usort( $types, fn( $a, $b ) => strcmp( $a['name'], $b['name'] ) );

		return new WP_REST_Response( [
			'elementTypes' => $types,
			'count'        => count( $types ),
		], 200 );
	}

	/**
	 * Sanitize controls for API response — strip closures and internal fields.
	 */
	private static function sanitize_controls( array $controls ): array {
		$clean = [];
		foreach ( $controls as $key => $control ) {
			if ( ! is_array( $control ) ) continue;

			$entry = [];
			foreach ( [ 'type', 'label', 'default', 'options', 'placeholder', 'description', 'units', 'min', 'max', 'step' ] as $field ) {
				if ( isset( $control[ $field ] ) && ! ( $control[ $field ] instanceof \Closure ) ) {
					$entry[ $field ] = $control[ $field ];
				}
			}

			if ( ! empty( $entry ) ) {
				$clean[ $key ] = $entry;
			}
		}
		return $clean;
	}
}
