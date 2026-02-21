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
		// GET + PATCH + POST + PUT + DELETE /pages/{id}/elements
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
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'append_elements' ),
				'permission_callback' => array( __CLASS__, 'check_write_permission' ),
			),
			array(
				'methods'             => 'PUT',
				'callback'            => array( __CLASS__, 'replace_elements' ),
				'permission_callback' => array( __CLASS__, 'check_write_permission' ),
			),
			array(
				'methods'             => 'DELETE',
				'callback'            => array( __CLASS__, 'delete_elements' ),
				'permission_callback' => array( __CLASS__, 'check_write_permission' ),
			),
		) );

		// POST /pages/{id}/elements/batch
		register_rest_route( 'agent-bricks/v1', '/pages/(?P<id>\d+)/elements/batch', array(
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'batch_operations' ),
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

	/**
	 * Require If-Match header. Returns null on success, WP_REST_Response on failure.
	 */
	private static function require_if_match( $request ) {
		$if_match = $request->get_header( 'if_match' );
		if ( empty( $if_match ) ) {
			return new WP_REST_Response( array(
				'error' => 'If-Match header required. GET the elements first to obtain contentHash.',
			), 428 );
		}
		return null;
	}

	public static function get_elements( $request ) {
		$post_id = (int) $request->get_param( 'id' );

		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
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
	 */
	public static function patch_elements( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		$err = self::require_if_match( $request );
		if ( $err ) return $err;
		$if_match = $request->get_header( 'if_match' );

		$body    = $request->get_json_params();
		$patches = $body['patches'] ?? array();

		if ( empty( $patches ) ) {
			return new WP_REST_Response( array( 'error' => 'No patches provided.' ), 400 );
		}

		$current  = ATB_Bricks_Lifecycle::read_elements( $post_id );
		$elements = $current['elements'];

		$index = array();
		foreach ( $elements as $i => $el ) {
			if ( isset( $el['id'] ) ) {
				$index[ $el['id'] ] = $i;
			}
		}

		$patched_ids = array();
		foreach ( $patches as $patch ) {
			$el_id = $patch['id'] ?? null;
			if ( ! $el_id || ! isset( $index[ $el_id ] ) ) {
				return new WP_REST_Response( array(
					'error' => "Element '$el_id' not found on page.",
				), 404 );
			}

			$idx = $index[ $el_id ];
			foreach ( $patch as $key => $value ) {
				if ( $key === 'id' ) continue;
				if ( $key === 'settings' && is_array( $value ) ) {
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

	/**
	 * POST /pages/{id}/elements — append elements to page.
	 * Body: { "elements": [...], "parentId": "optional", "insertAfter": "optional" }
	 */
	public static function append_elements( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		$err = self::require_if_match( $request );
		if ( $err ) return $err;
		$if_match = $request->get_header( 'if_match' );

		$body     = $request->get_json_params();
		$new_els  = $body['elements'] ?? array();
		$parent_id    = $body['parentId'] ?? null;
		$insert_after = $body['insertAfter'] ?? null;

		if ( empty( $new_els ) ) {
			return new WP_REST_Response( array( 'error' => 'No elements provided.' ), 400 );
		}

		$current  = ATB_Bricks_Lifecycle::read_elements( $post_id );
		$elements = $current['elements'];

		// If parentId specified, update parent's children array
		if ( $parent_id ) {
			$parent_found = false;
			foreach ( $elements as &$el ) {
				if ( isset( $el['id'] ) && $el['id'] === $parent_id ) {
					if ( ! isset( $el['children'] ) ) {
						$el['children'] = array();
					}
					foreach ( $new_els as $new_el ) {
						$el['children'][] = $new_el['id'];
					}
					$parent_found = true;
					break;
				}
			}
			unset( $el );
			if ( ! $parent_found ) {
				return new WP_REST_Response( array(
					'error' => "Parent element '$parent_id' not found.",
				), 404 );
			}
		}

		// Determine insertion position
		if ( $insert_after ) {
			$insert_idx = null;
			foreach ( $elements as $i => $el ) {
				if ( isset( $el['id'] ) && $el['id'] === $insert_after ) {
					$insert_idx = $i + 1;
					break;
				}
			}
			if ( $insert_idx !== null ) {
				array_splice( $elements, $insert_idx, 0, $new_els );
			} else {
				$elements = array_merge( $elements, $new_els );
			}
		} else {
			$elements = array_merge( $elements, $new_els );
		}

		$result = ATB_Bricks_Lifecycle::write_elements( $post_id, $elements, $if_match );
		if ( is_wp_error( $result ) ) {
			$data = $result->get_error_data();
			return new WP_REST_Response( array(
				'error'       => $result->get_error_message(),
				'currentHash' => $data['currentHash'] ?? '',
			), $data['status'] ?? 409 );
		}

		$added_ids = array_map( function( $el ) { return $el['id'] ?? null; }, $new_els );

		return new WP_REST_Response( array(
			'success'     => true,
			'contentHash' => $result,
			'added'       => array_filter( $added_ids ),
			'count'       => count( $elements ),
		), 201 );
	}

	/**
	 * DELETE /pages/{id}/elements — remove elements by ID.
	 * Body: { "ids": ["abc", "def"] }
	 */
	public static function delete_elements( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		$err = self::require_if_match( $request );
		if ( $err ) return $err;
		$if_match = $request->get_header( 'if_match' );

		$body = $request->get_json_params();
		$ids  = $body['ids'] ?? array();

		if ( empty( $ids ) ) {
			return new WP_REST_Response( array( 'error' => 'No element IDs provided.' ), 400 );
		}

		$current  = ATB_Bricks_Lifecycle::read_elements( $post_id );
		$elements = $current['elements'];
		$id_set   = array_flip( $ids );

		// Remove elements matching IDs
		$elements = array_values( array_filter( $elements, function( $el ) use ( $id_set ) {
			return ! isset( $id_set[ $el['id'] ?? '' ] );
		} ) );

		// Remove deleted IDs from parent children arrays
		foreach ( $elements as &$el ) {
			if ( isset( $el['children'] ) && is_array( $el['children'] ) ) {
				$el['children'] = array_values( array_filter( $el['children'], function( $child_id ) use ( $id_set ) {
					return ! isset( $id_set[ $child_id ] );
				} ) );
			}
		}
		unset( $el );

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
			'deleted'     => $ids,
			'count'       => count( $elements ),
		), 200 );
	}

	/**
	 * PUT /pages/{id}/elements — full replace of all elements.
	 * Body: { "elements": [...] }
	 */
	public static function replace_elements( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		$err = self::require_if_match( $request );
		if ( $err ) return $err;
		$if_match = $request->get_header( 'if_match' );

		$body     = $request->get_json_params();
		$elements = $body['elements'] ?? null;

		if ( ! is_array( $elements ) ) {
			return new WP_REST_Response( array( 'error' => 'elements array required.' ), 400 );
		}

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
			'count'       => count( $elements ),
		), 200 );
	}

	/**
	 * POST /pages/{id}/elements/batch — execute multiple operations atomically.
	 * Body: { "operations": [{ "op": "append|patch|delete", ... }] }
	 */
	public static function batch_operations( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		$err = self::require_if_match( $request );
		if ( $err ) return $err;
		$if_match = $request->get_header( 'if_match' );

		$body       = $request->get_json_params();
		$operations = $body['operations'] ?? array();

		if ( empty( $operations ) ) {
			return new WP_REST_Response( array( 'error' => 'No operations provided.' ), 400 );
		}

		$current  = ATB_Bricks_Lifecycle::read_elements( $post_id );
		$elements = $current['elements'];
		$results  = array();

		foreach ( $operations as $op_idx => $op ) {
			$op_type = $op['op'] ?? '';

			switch ( $op_type ) {
				case 'append':
					$new_els = $op['elements'] ?? array();
					$elements = array_merge( $elements, $new_els );
					$results[] = array( 'op' => 'append', 'added' => count( $new_els ) );
					break;

				case 'patch':
					$patches = $op['patches'] ?? array();
					$index = array();
					foreach ( $elements as $i => $el ) {
						if ( isset( $el['id'] ) ) $index[ $el['id'] ] = $i;
					}
					foreach ( $patches as $patch ) {
						$el_id = $patch['id'] ?? null;
						if ( ! $el_id || ! isset( $index[ $el_id ] ) ) {
							return new WP_REST_Response( array(
								'error' => "Batch op $op_idx: element '$el_id' not found.",
							), 404 );
						}
						$idx = $index[ $el_id ];
						foreach ( $patch as $key => $value ) {
							if ( $key === 'id' ) continue;
							if ( $key === 'settings' && is_array( $value ) ) {
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
					}
					$results[] = array( 'op' => 'patch', 'patched' => count( $patches ) );
					break;

				case 'delete':
					$ids = $op['ids'] ?? array();
					$id_set = array_flip( $ids );
					$elements = array_values( array_filter( $elements, function( $el ) use ( $id_set ) {
						return ! isset( $id_set[ $el['id'] ?? '' ] );
					} ) );
					foreach ( $elements as &$el ) {
						if ( isset( $el['children'] ) && is_array( $el['children'] ) ) {
							$el['children'] = array_values( array_filter( $el['children'], function( $cid ) use ( $id_set ) {
								return ! isset( $id_set[ $cid ] );
							} ) );
						}
					}
					unset( $el );
					$results[] = array( 'op' => 'delete', 'deleted' => count( $ids ) );
					break;

				default:
					return new WP_REST_Response( array(
						'error' => "Unknown operation '$op_type' at index $op_idx.",
					), 400 );
			}
		}

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
			'operations'  => $results,
			'count'       => count( $elements ),
		), 200 );
	}
}
