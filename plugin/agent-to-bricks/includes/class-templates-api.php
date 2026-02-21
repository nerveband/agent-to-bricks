<?php
/**
 * Templates CRUD REST API endpoints.
 *
 * Works with bricks_template custom post type.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Templates_API {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		// GET + POST /templates
		register_rest_route( 'agent-bricks/v1', '/templates', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'list_templates' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_template' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
		) );

		// GET + PATCH + DELETE /templates/{id}
		register_rest_route( 'agent-bricks/v1', '/templates/(?P<id>\d+)', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_template' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => 'PATCH',
				'callback'            => array( __CLASS__, 'update_template' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => 'DELETE',
				'callback'            => array( __CLASS__, 'delete_template' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
		) );
	}

	public static function check_permission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * List all bricks_template posts.
	 */
	public static function list_templates( $request ) {
		$type_filter = $request->get_param( 'type' );

		$args = array(
			'post_type'      => 'bricks_template',
			'posts_per_page' => 100,
			'post_status'    => 'any',
			'orderby'        => 'title',
			'order'          => 'ASC',
		);

		$posts     = get_posts( $args );
		$templates = array();

		foreach ( $posts as $post ) {
			$tmpl_type = get_post_meta( $post->ID, '_bricks_template_type', true );
			if ( $type_filter && $tmpl_type !== $type_filter ) {
				continue;
			}
			$content = get_post_meta( $post->ID, ATB_Bricks_Lifecycle::content_meta_key(), true );
			$templates[] = array(
				'id'           => $post->ID,
				'title'        => $post->post_title,
				'type'         => $tmpl_type ?: 'content',
				'status'       => $post->post_status,
				'elementCount' => is_array( $content ) ? count( $content ) : 0,
				'modified'     => $post->post_modified,
			);
		}

		return new WP_REST_Response( array(
			'templates' => $templates,
			'count'     => count( $templates ),
		), 200 );
	}

	/**
	 * Get a single template with full element content.
	 */
	public static function get_template( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		$post    = get_post( $post_id );

		if ( ! $post || $post->post_type !== 'bricks_template' ) {
			return new WP_REST_Response( array( 'error' => 'Template not found.' ), 404 );
		}

		$content  = get_post_meta( $post_id, ATB_Bricks_Lifecycle::content_meta_key(), true );
		$elements = is_array( $content ) ? $content : array();

		return new WP_REST_Response( array(
			'id'           => $post->ID,
			'title'        => $post->post_title,
			'type'         => get_post_meta( $post_id, '_bricks_template_type', true ) ?: 'content',
			'status'       => $post->post_status,
			'elements'     => $elements,
			'contentHash'  => md5( serialize( $elements ) ),
			'settings'     => get_post_meta( $post_id, '_bricks_template_settings', true ) ?: array(),
		), 200 );
	}

	/**
	 * Create a new bricks_template from element JSON.
	 */
	public static function create_template( $request ) {
		$body     = $request->get_json_params();
		$title    = sanitize_text_field( $body['title'] ?? 'Untitled Template' );
		$type     = sanitize_text_field( $body['type'] ?? 'section' );
		$elements = $body['elements'] ?? array();
		$status   = sanitize_text_field( $body['status'] ?? 'publish' );

		$post_id = wp_insert_post( array(
			'post_title'  => $title,
			'post_type'   => 'bricks_template',
			'post_status' => $status,
		), true );

		if ( is_wp_error( $post_id ) ) {
			return new WP_REST_Response( array(
				'error' => $post_id->get_error_message(),
			), 500 );
		}

		update_post_meta( $post_id, '_bricks_template_type', $type );
		update_post_meta( $post_id, ATB_Bricks_Lifecycle::content_meta_key(), $elements );
		update_post_meta( $post_id, '_bricks_editor_mode', 'bricks' );

		if ( ! empty( $body['settings'] ) ) {
			update_post_meta( $post_id, '_bricks_template_settings', $body['settings'] );
		}

		return new WP_REST_Response( array(
			'id'           => $post_id,
			'title'        => $title,
			'type'         => $type,
			'elementCount' => count( $elements ),
		), 201 );
	}

	/**
	 * Update an existing template.
	 */
	public static function update_template( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		$post    = get_post( $post_id );

		if ( ! $post || $post->post_type !== 'bricks_template' ) {
			return new WP_REST_Response( array( 'error' => 'Template not found.' ), 404 );
		}

		$body = $request->get_json_params();

		if ( isset( $body['title'] ) ) {
			wp_update_post( array(
				'ID'         => $post_id,
				'post_title' => sanitize_text_field( $body['title'] ),
			) );
		}

		if ( isset( $body['elements'] ) ) {
			update_post_meta( $post_id, ATB_Bricks_Lifecycle::content_meta_key(), $body['elements'] );
		}

		if ( isset( $body['type'] ) ) {
			update_post_meta( $post_id, '_bricks_template_type', sanitize_text_field( $body['type'] ) );
		}

		if ( isset( $body['settings'] ) ) {
			update_post_meta( $post_id, '_bricks_template_settings', $body['settings'] );
		}

		// Read back
		$updated  = get_post( $post_id );
		$content  = get_post_meta( $post_id, ATB_Bricks_Lifecycle::content_meta_key(), true );
		$elements = is_array( $content ) ? $content : array();

		return new WP_REST_Response( array(
			'id'       => $post_id,
			'title'    => $updated->post_title,
			'type'     => get_post_meta( $post_id, '_bricks_template_type', true ),
			'elements' => $elements,
		), 200 );
	}

	/**
	 * Delete a template (move to trash).
	 */
	public static function delete_template( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		$post    = get_post( $post_id );

		if ( ! $post || $post->post_type !== 'bricks_template' ) {
			return new WP_REST_Response( array( 'error' => 'Template not found.' ), 404 );
		}

		wp_delete_post( $post_id, true );

		return new WP_REST_Response( array(
			'success' => true,
			'deleted' => $post_id,
		), 200 );
	}
}
