<?php
/**
 * Site info, discovery, and WooCommerce read-only REST API endpoints.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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

		register_rest_route( 'agent-bricks/v1', '/site/features', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_features' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
		) );

		register_rest_route( 'agent-bricks/v1', '/site/element-types', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_element_types' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'include_controls' => array(
					'type'              => 'boolean',
					'sanitize_callback' => 'rest_sanitize_boolean',
					'default'           => false,
				),
				'category'         => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/site/query-elements', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_query_elements' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'include_controls' => array(
					'type'              => 'boolean',
					'sanitize_callback' => 'rest_sanitize_boolean',
					'default'           => false,
				),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/site/woocommerce', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_woocommerce_status' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
		) );

		register_rest_route( 'agent-bricks/v1', '/woo/products', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_woocommerce_products' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'search'   => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'per_page' => array(
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
					'default'           => 20,
				),
				'page'     => array(
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
					'default'           => 1,
				),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/woo/product-categories', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_woocommerce_product_categories' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'search'   => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'per_page' => array(
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
					'default'           => 20,
				),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/woo/product-tags', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_woocommerce_product_tags' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'search'   => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'per_page' => array(
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
					'default'           => 20,
				),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/pages', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_pages' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'search'   => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'per_page' => array(
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
					'default'           => 20,
				),
			),
		) );
	}

	public static function check_permission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * GET /site/info — Bricks environment info.
	 */
	public static function get_info( ?WP_REST_Request $request = null ): WP_REST_Response {
		return new WP_REST_Response( self::get_info_data(), 200 );
	}

	/**
	 * GET /site/frameworks — detect CSS frameworks (ACSS, etc.).
	 */
	public static function get_frameworks( ?WP_REST_Request $request = null ): WP_REST_Response {
		return new WP_REST_Response( array( 'frameworks' => self::get_frameworks_data() ), 200 );
	}

	/**
	 * GET /site/features — summarize machine-discoverable capabilities.
	 */
	public static function get_features( ?WP_REST_Request $request = null ): WP_REST_Response {
		$info        = self::get_info_data();
		$frameworks  = self::get_frameworks_data();
		$query_types = self::get_query_element_types_data( false );
		$woocommerce = self::get_woocommerce_status_data();

		return new WP_REST_Response( array(
			'bricks' => array(
				'active'  => ! empty( $info['bricksVersion'] ),
				'version' => $info['bricksVersion'],
			),
			'wordpress' => array(
				'version' => $info['wpVersion'],
			),
			'plugin' => array(
				'version' => defined( 'AGENT_BRICKS_VERSION' ) ? AGENT_BRICKS_VERSION : null,
			),
			'abilities' => array(
				'available' => function_exists( 'wp_register_ability_category' ),
			),
			'frameworks'        => array_keys( $frameworks ),
			'queryElements'     => array_map( static fn( $type ) => $type['name'], $query_types['queryElements'] ),
			'queryElementCount' => $query_types['count'],
			'woocommerce'       => $woocommerce,
		), 200 );
	}

	/**
	 * GET /site/element-types — rich element type metadata with optional controls.
	 */
	public static function get_element_types( WP_REST_Request $request ): WP_REST_Response {
		$include_controls = (bool) $request->get_param( 'include_controls' );
		$category_filter  = sanitize_text_field( $request->get_param( 'category' ) ?? '' ) ?: null;

		return new WP_REST_Response( self::get_element_types_data( $include_controls, $category_filter ), 200 );
	}

	/**
	 * GET /site/query-elements — element types with a Bricks query control.
	 */
	public static function get_query_elements( WP_REST_Request $request ): WP_REST_Response {
		$include_controls = (bool) $request->get_param( 'include_controls' );

		return new WP_REST_Response( self::get_query_element_types_data( $include_controls ), 200 );
	}

	/**
	 * GET /site/woocommerce — WooCommerce availability summary.
	 */
	public static function get_woocommerce_status( ?WP_REST_Request $request = null ): WP_REST_Response {
		return new WP_REST_Response( self::get_woocommerce_status_data(), 200 );
	}

	/**
	 * GET /woo/products — list WooCommerce products for discovery/autocomplete.
	 */
	public static function get_woocommerce_products( WP_REST_Request $request ): WP_REST_Response {
		if ( ! post_type_exists( 'product' ) ) {
			return new WP_REST_Response( array(
				'products'          => array(),
				'count'             => 0,
				'total'             => 0,
				'page'              => 1,
				'perPage'           => 0,
				'totalPages'        => 0,
				'woocommerceActive' => self::is_woocommerce_active(),
			), 200 );
		}

		$search   = sanitize_text_field( $request->get_param( 'search' ) ?? '' );
		$per_page = min( max( (int) $request->get_param( 'per_page' ), 1 ), 50 );
		$page     = max( (int) $request->get_param( 'page' ), 1 );

		$query = new WP_Query( array(
			'post_type'      => 'product',
			'post_status'    => array( 'publish', 'draft', 'private' ),
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => 'title',
			'order'          => 'ASC',
			's'              => $search,
		) );

		$products = array();
		foreach ( $query->posts as $post ) {
			if ( ATB_Access_Control::can_access_post( $post->ID ) !== true ) {
				continue;
			}

			$products[] = array(
				'id'         => $post->ID,
				'title'      => $post->post_title ?: '(no title)',
				'slug'       => $post->post_name,
				'status'     => $post->post_status,
				'modified'   => $post->post_modified,
				'sku'        => (string) get_post_meta( $post->ID, '_sku', true ),
				'price'      => (string) get_post_meta( $post->ID, '_price', true ),
				'categories' => self::map_term_summary( wp_get_post_terms( $post->ID, 'product_cat' ) ),
				'tags'       => self::map_term_summary( wp_get_post_terms( $post->ID, 'product_tag' ) ),
			);
		}

		return new WP_REST_Response( array(
			'products'          => $products,
			'count'             => count( $products ),
			'total'             => (int) $query->found_posts,
			'page'              => $page,
			'perPage'           => $per_page,
			'totalPages'        => (int) $query->max_num_pages,
			'woocommerceActive' => self::is_woocommerce_active(),
		), 200 );
	}

	/**
	 * GET /woo/product-categories — list Woo product categories.
	 */
	public static function get_woocommerce_product_categories( WP_REST_Request $request ): WP_REST_Response {
		$categories = self::get_woocommerce_terms( 'product_cat', $request );

		return new WP_REST_Response( array(
			'categories'        => $categories,
			'count'             => count( $categories ),
			'woocommerceActive' => self::is_woocommerce_active(),
		), 200 );
	}

	/**
	 * GET /woo/product-tags — list Woo product tags.
	 */
	public static function get_woocommerce_product_tags( WP_REST_Request $request ): WP_REST_Response {
		$tags = self::get_woocommerce_terms( 'product_tag', $request );

		return new WP_REST_Response( array(
			'tags'              => $tags,
			'count'             => count( $tags ),
			'woocommerceActive' => self::is_woocommerce_active(),
		), 200 );
	}

	/**
	 * GET /pages — search pages on the site.
	 */
	public static function get_pages( WP_REST_Request $request ): WP_REST_Response {
		$search   = $request->get_param( 'search' );
		$per_page = min( (int) $request->get_param( 'per_page' ), 50 );
		if ( $per_page < 1 ) {
			$per_page = 20;
		}

		$args = array(
			'post_type'      => 'page',
			'post_status'    => array( 'publish', 'draft', 'private' ),
			'posts_per_page' => $per_page,
			'orderby'        => 'title',
			'order'          => 'ASC',
		);

		if ( ! empty( $search ) ) {
			$args['s'] = $search;
		}

		$query = new WP_Query( $args );
		$pages = array();

		foreach ( $query->posts as $post ) {
			if ( ATB_Access_Control::can_access_post( $post->ID ) !== true ) {
				continue;
			}
			$pages[] = array(
				'id'       => $post->ID,
				'title'    => $post->post_title ?: '(no title)',
				'slug'     => $post->post_name,
				'status'   => $post->post_status,
				'modified' => $post->post_modified,
			);
		}

		return new WP_REST_Response( $pages, 200 );
	}

	private static function get_info_data(): array {
		$breakpoints = get_option( 'bricks_breakpoints', array() );
		if ( empty( $breakpoints ) && class_exists( '\Bricks\Breakpoints' ) ) {
			$breakpoints = \Bricks\Breakpoints::$breakpoints ?? array();
		}

		$element_types = array();
		if ( class_exists( '\Bricks\Elements' ) && ! empty( \Bricks\Elements::$elements ) ) {
			$element_types = array_keys( \Bricks\Elements::$elements );
		}

		return array(
			'bricksVersion'  => defined( 'BRICKS_VERSION' ) ? BRICKS_VERSION : null,
			'contentMetaKey' => ATB_Bricks_Lifecycle::content_meta_key(),
			'elementTypes'   => $element_types,
			'breakpoints'    => $breakpoints,
			'pluginVersion'  => defined( 'AGENT_BRICKS_VERSION' ) ? AGENT_BRICKS_VERSION : null,
			'phpVersion'     => current_user_can( 'manage_options' ) ? PHP_VERSION : null,
			'wpVersion'      => get_bloginfo( 'version' ),
		);
	}

	private static function get_frameworks_data(): array {
		$frameworks = array();

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

			$all_classes = get_option( 'bricks_global_classes', array() );
			$acss_classes = array_filter( $all_classes, function( $c ) {
				return strpos( $c['id'] ?? '', 'acss_import_' ) === 0;
			} );

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
					'rootFontSize'      => $acss_settings['root-font-size'] ?? '',
					'textFontFamily'    => $acss_settings['text-font-family'] ?? '',
					'headingFontFamily' => $acss_settings['heading-font-family'] ?? '',
				),
			);
		}

		return $frameworks;
	}

	private static function get_element_types_data( bool $include_controls = false, ?string $category_filter = null ): array {
		if ( ! class_exists( '\Bricks\Elements' ) || empty( \Bricks\Elements::$elements ) ) {
			return array(
				'elementTypes' => array(),
				'count'        => 0,
			);
		}

		$types = array();
		foreach ( \Bricks\Elements::$elements as $name => $entry ) {
			$label    = '';
			$category = 'general';
			$icon     = '';
			$controls = array();

			if ( is_array( $entry ) && method_exists( '\Bricks\Elements', 'get_element' ) ) {
				$full = \Bricks\Elements::get_element( array( 'name' => $name ) );
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
					$controls = $entry->controls ?? array();
				}
			} elseif ( is_string( $entry ) && class_exists( $entry ) ) {
				try {
					$instance = new $entry();
					$label    = $instance->label ?? $name;
					$category = $instance->category ?? 'general';
					$icon     = $instance->icon ?? '';
					if ( $include_controls && method_exists( $instance, 'set_controls' ) ) {
						$instance->set_controls();
						$controls = $instance->controls ?? array();
					}
				} catch ( \Throwable $e ) {
					$label = $name;
				}
			}

			if ( $category_filter && $category !== $category_filter ) {
				continue;
			}

			$type_data = array(
				'name'     => $name,
				'label'    => $label,
				'category' => $category,
				'icon'     => $icon,
			);
			if ( $include_controls && ! empty( $controls ) ) {
				$type_data['controls'] = self::sanitize_controls( $controls );
			}
			$types[] = $type_data;
		}

		usort( $types, fn( $a, $b ) => strcmp( $a['name'], $b['name'] ) );

		return array(
			'elementTypes' => $types,
			'count'        => count( $types ),
		);
	}

	private static function get_query_element_types_data( bool $include_controls = false ): array {
		$types_data = self::get_element_types_data( true, null );
		$query_types = array_values( array_filter(
			$types_data['elementTypes'],
			static fn( $type ) => self::element_supports_query( $type )
		) );

		if ( ! $include_controls ) {
			$query_types = array_map( static function( $type ) {
				unset( $type['controls'] );
				return $type;
			}, $query_types );
		}

		return array(
			'queryElements' => $query_types,
			'count'         => count( $query_types ),
		);
	}

	private static function element_supports_query( array $type ): bool {
		return ! empty( $type['controls']['query'] );
	}

	private static function get_woocommerce_status_data(): array {
		$element_types = self::get_element_types_data( false, null );
		$woo_element_types = array_values( array_map(
			static fn( $type ) => $type['name'],
			array_filter(
				$element_types['elementTypes'],
				static fn( $type ) => self::is_woocommerce_element_type( $type['name'] ?? '' )
			)
		) );

		return array(
			'active'             => self::is_woocommerce_active(),
			'version'            => defined( 'WC_VERSION' ) ? WC_VERSION : '',
			'hpos'               => self::is_woocommerce_hpos_enabled(),
			'productPostType'    => post_type_exists( 'product' ),
			'productCategories'  => taxonomy_exists( 'product_cat' ),
			'productTags'        => taxonomy_exists( 'product_tag' ),
			'elementTypes'       => $woo_element_types,
			'elementTypeCount'   => count( $woo_element_types ),
			'abilitiesAvailable' => function_exists( 'wp_register_ability_category' ),
		);
	}

	private static function is_woocommerce_active(): bool {
		return defined( 'WC_VERSION' ) || class_exists( 'WooCommerce' ) || post_type_exists( 'product' );
	}

	private static function is_woocommerce_hpos_enabled(): bool {
		if ( ! class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			return false;
		}
		if ( ! method_exists( '\Automattic\WooCommerce\Utilities\OrderUtil', 'custom_orders_table_usage_is_enabled' ) ) {
			return false;
		}
		return (bool) \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
	}

	private static function is_woocommerce_element_type( string $name ): bool {
		if ( '' === $name ) {
			return false;
		}
		if ( str_starts_with( $name, 'woocommerce-' ) || str_starts_with( $name, 'product-' ) ) {
			return true;
		}
		return in_array( $name, array(
			'cart-items',
			'cart-totals',
			'checkout-customer-details',
			'checkout-order-review',
			'mini-cart',
		), true );
	}

	private static function get_woocommerce_terms( string $taxonomy, WP_REST_Request $request ): array {
		if ( ! taxonomy_exists( $taxonomy ) ) {
			return array();
		}

		$search   = sanitize_text_field( $request->get_param( 'search' ) ?? '' );
		$per_page = min( max( (int) $request->get_param( 'per_page' ), 1 ), 50 );

		$terms = get_terms( array(
			'taxonomy'   => $taxonomy,
			'hide_empty' => false,
			'search'     => $search,
			'number'     => $per_page,
			'orderby'    => 'name',
			'order'      => 'ASC',
		) );

		return self::map_term_summary( $terms );
	}

	private static function map_term_summary( $terms ): array {
		if ( is_wp_error( $terms ) || ! is_array( $terms ) ) {
			return array();
		}

		return array_values( array_map( static function( $term ) {
			return array(
				'id'    => $term->term_id,
				'name'  => $term->name,
				'slug'  => $term->slug,
				'count' => isset( $term->count ) ? (int) $term->count : 0,
			);
		}, $terms ) );
	}

	/**
	 * Sanitize controls for API response — strip closures and internal fields.
	 */
	private static function sanitize_controls( array $controls ): array {
		$clean = array();
		foreach ( $controls as $key => $control ) {
			if ( ! is_array( $control ) ) {
				continue;
			}

			$entry = array();
			foreach ( array( 'type', 'label', 'default', 'options', 'placeholder', 'description', 'units', 'min', 'max', 'step' ) as $field ) {
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
