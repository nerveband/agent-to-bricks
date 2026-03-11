<?php
/**
 * Cross-site element search REST API endpoint.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATB_Search_API {

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route( 'agent-bricks/v1', '/search/elements', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'search_elements' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'element_type'      => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'setting_key'       => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'setting_value'     => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'global_class'      => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'post_type'         => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'has_query'         => array(
					'type'              => 'boolean',
					'sanitize_callback' => 'rest_sanitize_boolean',
					'default'           => false,
				),
				'query_object_type' => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'query_post_type'   => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'query_taxonomy'    => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				),
				'per_page'          => array(
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
					'default'           => 50,
				),
				'page'              => array(
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
					'default'           => 1,
				),
			),
		) );
	}

	public static function check_permission(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * GET /search/elements — search elements across all Bricks content.
	 */
	public static function search_elements( WP_REST_Request $request ): WP_REST_Response {
		$element_type      = sanitize_text_field( $request->get_param( 'element_type' ) ?? '' ) ?: null;
		$setting_key       = sanitize_text_field( $request->get_param( 'setting_key' ) ?? '' ) ?: null;
		$setting_value     = sanitize_text_field( $request->get_param( 'setting_value' ) ?? '' ) ?: null;
		$global_class      = sanitize_text_field( $request->get_param( 'global_class' ) ?? '' ) ?: null;
		$post_type         = sanitize_text_field( $request->get_param( 'post_type' ) ?? '' ) ?: null;
		$has_query         = (bool) $request->get_param( 'has_query' );
		$query_object_type = sanitize_text_field( $request->get_param( 'query_object_type' ) ?? '' ) ?: null;
		$query_post_type   = sanitize_text_field( $request->get_param( 'query_post_type' ) ?? '' ) ?: null;
		$query_taxonomy    = sanitize_text_field( $request->get_param( 'query_taxonomy' ) ?? '' ) ?: null;
		$per_page          = min( max( (int) ( $request->get_param( 'per_page' ) ?: 50 ), 1 ), 100 );
		$page              = max( (int) ( $request->get_param( 'page' ) ?: 1 ), 1 );

		$meta_key   = ATB_Bricks_Lifecycle::content_meta_key();
		$max_posts  = 500;
		$batch_size = 50;
		$offset     = 0;

		$class_id = null;
		if ( $global_class ) {
			$class_id = self::resolve_class_id( $global_class );
		}

		$all_results = array();

		while ( $offset < $max_posts ) {
			$query_args = array(
				'post_type'      => array( 'page', 'post', 'product', 'bricks_template' ),
				'posts_per_page' => $batch_size,
				'offset'         => $offset,
				'post_status'    => 'any',
				'meta_query'     => array(
					array(
						'key'     => $meta_key,
						'compare' => 'EXISTS',
					),
				),
				'fields'         => 'ids',
			);

			if ( $post_type ) {
				$query_args['post_type'] = $post_type;
			}

			$post_ids = get_posts( $query_args );
			if ( empty( $post_ids ) ) {
				break;
			}

			$post_ids = ATB_Access_Control::filter_post_ids( $post_ids );

			foreach ( $post_ids as $pid ) {
				$post     = get_post( $pid );
				$elements = get_post_meta( $pid, $meta_key, true );
				if ( ! is_array( $elements ) ) {
					continue;
				}

				foreach ( $elements as $el ) {
					$query_meta = self::extract_query_metadata( $el['settings'] ?? array() );
					if ( ! self::element_matches(
						$el,
						$query_meta,
						$element_type,
						$setting_key,
						$setting_value,
						$class_id,
						$global_class,
						$has_query,
						$query_object_type,
						$query_post_type,
						$query_taxonomy
					) ) {
						continue;
					}

					$all_results[] = array(
						'postId'          => $pid,
						'postTitle'       => $post->post_title,
						'postType'        => $post->post_type,
						'elementId'       => $el['id'] ?? '',
						'elementType'     => $el['name'] ?? '',
						'elementLabel'    => $el['label'] ?? '',
						'settings'        => $el['settings'] ?? new \stdClass(),
						'parentId'        => $el['parent'] ?? '',
						'hasQuery'        => $query_meta['hasQuery'],
						'queryObjectType' => $query_meta['queryObjectType'],
						'queryPostTypes'  => $query_meta['queryPostTypes'],
						'queryTaxonomies' => $query_meta['queryTaxonomies'],
						'queryRaw'        => $query_meta['queryRaw'],
					);
				}
			}

			$offset += $batch_size;
		}

		$total       = count( $all_results );
		$total_pages = (int) ceil( $total / $per_page );
		$offset      = ( $page - 1 ) * $per_page;
		$paged       = array_slice( $all_results, $offset, $per_page );

		return new WP_REST_Response( array(
			'results'    => $paged,
			'total'      => $total,
			'page'       => $page,
			'perPage'    => $per_page,
			'totalPages' => $total_pages,
		), 200 );
	}

	private static function element_matches(
		array $el,
		array $query_meta,
		?string $element_type,
		?string $setting_key,
		?string $setting_value,
		?string $class_id,
		?string $global_class,
		bool $has_query,
		?string $query_object_type,
		?string $query_post_type,
		?string $query_taxonomy
	): bool {
		if ( $element_type && ( $el['name'] ?? '' ) !== $element_type ) {
			return false;
		}

		$settings = $el['settings'] ?? array();

		if ( $setting_key && ! array_key_exists( $setting_key, $settings ) ) {
			return false;
		}

		if ( $setting_value && $setting_key ) {
			$val = $settings[ $setting_key ] ?? '';
			if ( is_string( $val ) && ! str_contains( strtolower( $val ), strtolower( $setting_value ) ) ) {
				return false;
			}
		} elseif ( $setting_value && ! $setting_key ) {
			$found = false;
			foreach ( $settings as $value ) {
				if ( is_string( $value ) && str_contains( strtolower( $value ), strtolower( $setting_value ) ) ) {
					$found = true;
					break;
				}
			}
			if ( ! $found ) {
				return false;
			}
		}

		if ( $global_class ) {
			$el_classes = $settings['_cssGlobalClasses'] ?? array();
			if ( ! is_array( $el_classes ) ) {
				return false;
			}
			$matched = false;
			if ( $class_id && in_array( $class_id, $el_classes, true ) ) {
				$matched = true;
			}
			if ( ! $matched && in_array( $global_class, $el_classes, true ) ) {
				$matched = true;
			}
			if ( ! $matched ) {
				return false;
			}
		}

		if ( $has_query && ! $query_meta['hasQuery'] ) {
			return false;
		}
		if ( $query_object_type && $query_meta['queryObjectType'] !== $query_object_type ) {
			return false;
		}
		if ( $query_post_type && ! in_array( $query_post_type, $query_meta['queryPostTypes'], true ) ) {
			return false;
		}
		if ( $query_taxonomy && ! in_array( $query_taxonomy, $query_meta['queryTaxonomies'], true ) ) {
			return false;
		}

		return true;
	}

	private static function extract_query_metadata( $settings ): array {
		$query = is_array( $settings ) ? ( $settings['query'] ?? null ) : null;
		$raw   = is_array( $query ) ? $query : array();

		$post_types = array();
		if ( isset( $raw['post_type'] ) ) {
			if ( is_array( $raw['post_type'] ) ) {
				$post_types = array_values( array_filter( array_map( 'strval', $raw['post_type'] ) ) );
			} elseif ( is_string( $raw['post_type'] ) && '' !== $raw['post_type'] ) {
				$post_types = array( $raw['post_type'] );
			}
		}

		$taxonomies = array();
		foreach ( array( 'taxonomy', 'taxonomies', 'termsTaxonomy' ) as $key ) {
			if ( empty( $raw[ $key ] ) ) {
				continue;
			}
			if ( is_array( $raw[ $key ] ) ) {
				foreach ( $raw[ $key ] as $value ) {
					if ( is_string( $value ) && '' !== $value ) {
						$taxonomies[] = $value;
					}
				}
			} elseif ( is_string( $raw[ $key ] ) ) {
				$taxonomies[] = $raw[ $key ];
			}
		}

		$taxonomies = array_values( array_unique( $taxonomies ) );

		return array(
			'hasQuery'        => ! empty( $raw ) || ! empty( $settings['hasLoop'] ),
			'queryObjectType' => is_string( $raw['objectType'] ?? null ) ? $raw['objectType'] : '',
			'queryPostTypes'  => $post_types,
			'queryTaxonomies' => $taxonomies,
			'queryRaw'        => ! empty( $raw ) ? $raw : new \stdClass(),
		);
	}

	private static function resolve_class_id( string $name ): ?string {
		$classes = get_option( 'bricks_global_classes', array() );
		foreach ( $classes as $class ) {
			if ( ( $class['name'] ?? '' ) === $name ) {
				return $class['id'] ?? null;
			}
		}
		return null;
	}
}
