<?php
/**
 * Cross-site element search REST API endpoint.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Search_API {

	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	public static function register_routes(): void {
		register_rest_route( 'agent-bricks/v1', '/search/elements', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'search_elements' ],
			'permission_callback' => [ __CLASS__, 'check_permission' ],
		] );
	}

	public static function check_permission(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * GET /search/elements — search elements across all Bricks content.
	 */
	public static function search_elements( WP_REST_Request $request ): WP_REST_Response {
		$element_type  = sanitize_text_field( $request->get_param( 'element_type' ) ?? '' ) ?: null;
		$setting_key   = sanitize_text_field( $request->get_param( 'setting_key' ) ?? '' ) ?: null;
		$setting_value = sanitize_text_field( $request->get_param( 'setting_value' ) ?? '' ) ?: null;
		$global_class  = sanitize_text_field( $request->get_param( 'global_class' ) ?? '' ) ?: null;
		$post_type     = sanitize_text_field( $request->get_param( 'post_type' ) ?? '' ) ?: null;
		$per_page      = min( (int) ( $request->get_param( 'per_page' ) ?: 50 ), 100 );
		$page          = max( (int) ( $request->get_param( 'page' ) ?: 1 ), 1 );

		$meta_key  = ATB_Bricks_Lifecycle::content_meta_key();
		$max_posts = 500;
		$batch_size = 50;
		$offset = 0;

		// Resolve global class name to ID if needed
		$class_id = null;
		if ( $global_class ) {
			$class_id = self::resolve_class_id( $global_class );
		}

		$all_results = [];

		while ( $offset < $max_posts ) {
			$query_args = [
				'post_type'      => [ 'page', 'post', 'bricks_template' ],
				'posts_per_page' => $batch_size,
				'offset'         => $offset,
				'post_status'    => 'any',
				'meta_query'     => [
					[
						'key'     => $meta_key,
						'compare' => 'EXISTS',
					],
				],
				'fields' => 'ids',
			];

			if ( $post_type ) {
				$query_args['post_type'] = $post_type;
			}

			$post_ids = get_posts( $query_args );
			if ( empty( $post_ids ) ) {
				break;
			}

			foreach ( $post_ids as $pid ) {
				$post     = get_post( $pid );
				$elements = get_post_meta( $pid, $meta_key, true );
				if ( ! is_array( $elements ) ) continue;

				foreach ( $elements as $el ) {
					if ( ! self::element_matches( $el, $element_type, $setting_key, $setting_value, $class_id, $global_class ) ) {
						continue;
					}

					$all_results[] = [
						'postId'       => $pid,
						'postTitle'    => $post->post_title,
						'postType'     => $post->post_type,
						'elementId'    => $el['id'] ?? '',
						'elementType'  => $el['name'] ?? '',
						'elementLabel' => $el['label'] ?? '',
						'settings'     => $el['settings'] ?? new \stdClass(),
						'parentId'     => $el['parent'] ?? '',
					];
				}
			}

			$offset += $batch_size;
		}

		$total       = count( $all_results );
		$total_pages = (int) ceil( $total / $per_page );
		$offset      = ( $page - 1 ) * $per_page;
		$paged       = array_slice( $all_results, $offset, $per_page );

		return new WP_REST_Response( [
			'results'    => $paged,
			'total'      => $total,
			'page'       => $page,
			'perPage'    => $per_page,
			'totalPages' => $total_pages,
		], 200 );
	}

	private static function element_matches(
		array $el,
		?string $element_type,
		?string $setting_key,
		?string $setting_value,
		?string $class_id,
		?string $global_class
	): bool {
		if ( $element_type && ( $el['name'] ?? '' ) !== $element_type ) {
			return false;
		}

		$settings = $el['settings'] ?? [];

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
			foreach ( $settings as $v ) {
				if ( is_string( $v ) && str_contains( strtolower( $v ), strtolower( $setting_value ) ) ) {
					$found = true;
					break;
				}
			}
			if ( ! $found ) return false;
		}

		if ( $global_class ) {
			$el_classes = $settings['_cssGlobalClasses'] ?? [];
			if ( ! is_array( $el_classes ) ) return false;
			$matched = false;
			if ( $class_id && in_array( $class_id, $el_classes, true ) ) {
				$matched = true;
			}
			if ( ! $matched && in_array( $global_class, $el_classes, true ) ) {
				$matched = true;
			}
			if ( ! $matched ) return false;
		}

		return true;
	}

	private static function resolve_class_id( string $name ): ?string {
		$classes = get_option( 'bricks_global_classes', [] );
		foreach ( $classes as $c ) {
			if ( ( $c['name'] ?? '' ) === $name ) {
				return $c['id'] ?? null;
			}
		}
		return null;
	}
}
