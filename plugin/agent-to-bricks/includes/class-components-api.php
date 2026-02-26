<?php
/**
 * Components (reusable section templates) REST API endpoints.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Components_API {

	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	public static function register_routes(): void {
		register_rest_route( 'agent-bricks/v1', '/components', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'list_components' ],
			'permission_callback' => [ __CLASS__, 'check_permission' ],
		] );

		register_rest_route( 'agent-bricks/v1', '/components/(?P<id>\d+)', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_component' ],
			'permission_callback' => [ __CLASS__, 'check_single_permission' ],
		] );
	}

	public static function check_permission(): bool {
		return current_user_can( 'edit_posts' );
	}

	public static function check_single_permission( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return false;
		}
		$access = ATB_Access_Control::can_access_post( $post_id );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		return true;
	}

	public static function list_components(): WP_REST_Response {
		$posts = get_posts( [
			'post_type'      => 'bricks_template',
			'posts_per_page' => 100,
			'post_status'    => 'any',
			'orderby'        => 'title',
			'order'          => 'ASC',
			'meta_query'     => [
				[
					'key'   => '_bricks_template_type',
					'value' => 'section',
				],
			],
		] );

		$meta_key   = ATB_Bricks_Lifecycle::content_meta_key();
		$components = [];

		foreach ( $posts as $post ) {
			$content = get_post_meta( $post->ID, $meta_key, true );
			$components[] = [
				'id'           => $post->ID,
				'title'        => $post->post_title,
				'type'         => 'section',
				'status'       => $post->post_status,
				'elementCount' => is_array( $content ) ? count( $content ) : 0,
				'modified'     => $post->post_modified,
			];
		}

		return new WP_REST_Response( [
			'components' => $components,
			'count'      => count( $components ),
			'total'      => count( $components ),
		], 200 );
	}

	public static function get_component( WP_REST_Request $request ): WP_REST_Response {
		$post_id = (int) $request->get_param( 'id' );
		$post    = get_post( $post_id );

		if ( ! $post || $post->post_type !== 'bricks_template' ) {
			return new WP_REST_Response( [ 'error' => 'Component not found.' ], 404 );
		}

		$tmpl_type = get_post_meta( $post_id, '_bricks_template_type', true );
		if ( $tmpl_type !== 'section' ) {
			return new WP_REST_Response( [ 'error' => 'Not a component (section template).' ], 404 );
		}

		$meta_key = ATB_Bricks_Lifecycle::content_meta_key();
		$content  = get_post_meta( $post_id, $meta_key, true );
		$elements = is_array( $content ) ? $content : [];

		return new WP_REST_Response( [
			'id'           => $post->ID,
			'title'        => $post->post_title,
			'type'         => 'section',
			'status'       => $post->post_status,
			'elements'     => $elements,
			'contentHash'  => md5( wp_json_encode( $elements ) ),
			'elementCount' => count( $elements ),
			'modified'     => $post->post_modified,
		], 200 );
	}
}
