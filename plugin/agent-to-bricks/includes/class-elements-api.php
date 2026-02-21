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
		// GET + PATCH /pages/{id}/elements
		register_rest_route( 'agent-bricks/v1', '/pages/(?P<id>\d+)/elements', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_elements' ),
				'permission_callback' => array( __CLASS__, 'check_read_permission' ),
			),
			array(
				'methods'             => 'PATCH',
				'callback'            => array( __CLASS__, 'patch_elements' ),
				'permission_callback' => array( __CLASS__, 'check_write_permission' ),
			),
		) );
	}

	public static function check_read_permission( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		return current_user_can( 'edit_post', $post_id );
	}

	public static function check_write_permission( $request ) {
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

	/**
	 * PATCH /pages/{id}/elements — delta patch individual elements.
	 * Requires If-Match header with current contentHash.
	 * Body: { "patches": [{ "id": "abc", "label": "New", "settings": { "text": "Hello" } }] }
	 */
	public static function patch_elements( $request ) {
		$post_id = (int) $request->get_param( 'id' );

		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		// Require If-Match header for optimistic locking
		$if_match = $request->get_header( 'if_match' );
		if ( empty( $if_match ) ) {
			return new WP_REST_Response( array(
				'error' => 'If-Match header required. GET the elements first to obtain contentHash.',
			), 428 );
		}

		$body    = $request->get_json_params();
		$patches = $body['patches'] ?? array();

		if ( empty( $patches ) ) {
			return new WP_REST_Response( array( 'error' => 'No patches provided.' ), 400 );
		}

		// Read current elements
		$current  = ATB_Bricks_Lifecycle::read_elements( $post_id );
		$elements = $current['elements'];

		// Build index by ID
		$index = array();
		foreach ( $elements as $i => $el ) {
			if ( isset( $el['id'] ) ) {
				$index[ $el['id'] ] = $i;
			}
		}

		// Apply patches
		$patched_ids = array();
		foreach ( $patches as $patch ) {
			$el_id = $patch['id'] ?? null;
			if ( ! $el_id || ! isset( $index[ $el_id ] ) ) {
				return new WP_REST_Response( array(
					'error' => "Element '$el_id' not found on page.",
				), 404 );
			}

			$idx = $index[ $el_id ];

			// Merge patch fields into element (shallow merge for top-level, deep for settings)
			foreach ( $patch as $key => $value ) {
				if ( $key === 'id' ) continue;

				if ( $key === 'settings' && is_array( $value ) ) {
					// Deep merge settings
					if ( ! isset( $elements[ $idx ]['settings'] ) || ! is_array( $elements[ $idx ]['settings'] ) ) {
						$elements[ $idx ]['settings'] = array();
					}
					foreach ( $value as $skey => $sval ) {
						if ( $sval === null ) {
							unset( $elements[ $idx ]['settings'][ $skey ] );
						} else {
							$elements[ $idx ]['settings'][ $skey ] = $sval;
						}
					}
				} else {
					if ( $value === null ) {
						unset( $elements[ $idx ][ $key ] );
					} else {
						$elements[ $idx ][ $key ] = $value;
					}
				}
			}

			$patched_ids[] = $el_id;
		}

		// Write with optimistic locking
		$result = ATB_Bricks_Lifecycle::write_elements( $post_id, $elements, $if_match );

		if ( is_wp_error( $result ) ) {
			$data = $result->get_error_data();
			return new WP_REST_Response( array(
				'error'       => $result->get_error_message(),
				'currentHash' => $data['currentHash'] ?? '',
			), $data['status'] ?? 409 );
		}

		return new WP_REST_Response( array(
			'success'     => true,
			'contentHash' => $result,
			'patched'     => $patched_ids,
			'count'       => count( $patched_ids ),
		), 200 );
	}
}
