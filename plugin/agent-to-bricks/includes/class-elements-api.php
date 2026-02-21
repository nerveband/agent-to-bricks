<?php
/**
 * Elements CRUD REST API endpoints.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Elements_API {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		// GET /pages/{id}/elements
		register_rest_route( 'agent-bricks/v1', '/pages/(?P<id>\d+)/elements', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_elements' ),
				'permission_callback' => array( __CLASS__, 'check_read_permission' ),
			),
		) );
	}

	public static function check_read_permission( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		return current_user_can( 'edit_post', $post_id );
	}

	public static function get_elements( $request ) {
		$post_id = (int) $request->get_param( 'id' );

		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array(
				'error' => 'Post not found.',
			), 404 );
		}

		$data = ATB_Bricks_Lifecycle::read_elements( $post_id );

		return new WP_REST_Response( array(
			'elements'    => $data['elements'],
			'contentHash' => $data['contentHash'],
			'count'       => count( $data['elements'] ),
			'metaKey'     => ATB_Bricks_Lifecycle::content_meta_key(),
		), 200 );
	}
}
