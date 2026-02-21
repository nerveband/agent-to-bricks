<?php
/**
 * Media library REST API endpoints.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Media_API {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		register_rest_route( 'agent-bricks/v1', '/media', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'list_media' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'search' => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
				),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/media/upload', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'upload_media' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
		) );
	}

	public static function check_permission() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * GET /media — list media items with optional search.
	 */
	public static function list_media( $request ) {
		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 50,
			'orderby'        => 'date',
			'order'          => 'DESC',
		);

		$search = $request->get_param( 'search' );
		if ( ! empty( $search ) ) {
			$args['s'] = $search;
		}

		$query = new WP_Query( $args );
		$media = array();

		foreach ( $query->posts as $post ) {
			$file_path = get_attached_file( $post->ID );
			$filesize  = $file_path && file_exists( $file_path ) ? filesize( $file_path ) : 0;

			$media[] = array(
				'id'       => $post->ID,
				'title'    => $post->post_title,
				'url'      => wp_get_attachment_url( $post->ID ),
				'mimeType' => $post->post_mime_type,
				'date'     => $post->post_date,
				'filesize' => $filesize,
			);
		}

		return new WP_REST_Response( array(
			'media' => $media,
			'count' => count( $media ),
		), 200 );
	}

	/**
	 * POST /media/upload — upload a file to the media library.
	 */
	public static function upload_media( $request ) {
		$files = $request->get_file_params();

		if ( empty( $files['file'] ) ) {
			return new WP_REST_Response( array(
				'error' => 'No file provided. Send a multipart field named "file".',
			), 400 );
		}

		$file = $files['file'];

		// Use wp_handle_sideload to process the upload.
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$overrides = array(
			'test_form' => false,
			'test_size' => true,
		);

		$uploaded = wp_handle_sideload( $file, $overrides );

		if ( isset( $uploaded['error'] ) ) {
			return new WP_REST_Response( array(
				'error' => $uploaded['error'],
			), 400 );
		}

		$attachment = array(
			'post_title'     => sanitize_file_name( pathinfo( $uploaded['file'], PATHINFO_FILENAME ) ),
			'post_mime_type' => $uploaded['type'],
			'post_status'    => 'inherit',
		);

		$attach_id = wp_insert_attachment( $attachment, $uploaded['file'] );
		if ( is_wp_error( $attach_id ) ) {
			return new WP_REST_Response( array(
				'error' => $attach_id->get_error_message(),
			), 400 );
		}

		$metadata = wp_generate_attachment_metadata( $attach_id, $uploaded['file'] );
		wp_update_attachment_metadata( $attach_id, $metadata );

		$filesize = file_exists( $uploaded['file'] ) ? filesize( $uploaded['file'] ) : 0;

		return new WP_REST_Response( array(
			'id'       => $attach_id,
			'url'      => wp_get_attachment_url( $attach_id ),
			'mimeType' => $uploaded['type'],
			'filename' => basename( $uploaded['file'] ),
			'filesize' => $filesize,
		), 201 );
	}
}
