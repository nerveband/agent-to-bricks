<?php
/**
 * Snapshot and Rollback REST API endpoints.
 *
 * Stores up to 10 snapshots per page in post meta.
 * Auto-creates snapshots before destructive operations (PUT full replace).
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Snapshots_API {

	const META_KEY     = '_agent_bricks_snapshots';
	const MAX_SNAPSHOTS = 10;

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		// GET + POST /pages/{id}/snapshots
		register_rest_route( 'agent-bricks/v1', '/pages/(?P<id>\d+)/snapshots', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'list_snapshots' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_snapshot' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
		) );

		// POST /pages/{id}/snapshots/{snapshot_id}/rollback
		register_rest_route( 'agent-bricks/v1', '/pages/(?P<id>\d+)/snapshots/(?P<snapshot_id>[a-zA-Z0-9_-]+)/rollback', array(
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rollback_snapshot' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
		) );
	}

	public static function check_permission( $request ) {
		$post_id = (int) $request->get_param( 'id' );
		return current_user_can( 'edit_post', $post_id );
	}

	/**
	 * List all snapshots for a page.
	 */
	public static function list_snapshots( $request ) {
		$post_id = (int) $request->get_param( 'id' );

		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		$snapshots = self::get_snapshots( $post_id );

		// Return without full element data (too large for listing)
		$listing = array_map( function( $s ) {
			return array(
				'snapshotId'  => $s['snapshotId'],
				'contentHash' => $s['contentHash'],
				'elementCount'=> $s['elementCount'],
				'timestamp'   => $s['timestamp'],
				'label'       => $s['label'] ?? '',
			);
		}, $snapshots );

		return new WP_REST_Response( array( 'snapshots' => $listing ), 200 );
	}

	/**
	 * Create a snapshot of the current page content.
	 */
	public static function create_snapshot( $request ) {
		$post_id = (int) $request->get_param( 'id' );

		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		$body  = $request->get_json_params();
		$label = sanitize_text_field( $body['label'] ?? '' );

		$snapshot = self::take_snapshot( $post_id, $label );

		return new WP_REST_Response( array(
			'snapshotId'  => $snapshot['snapshotId'],
			'contentHash' => $snapshot['contentHash'],
			'elementCount'=> $snapshot['elementCount'],
			'timestamp'   => $snapshot['timestamp'],
		), 201 );
	}

	/**
	 * Rollback a page to a specific snapshot.
	 */
	public static function rollback_snapshot( $request ) {
		$post_id     = (int) $request->get_param( 'id' );
		$snapshot_id = sanitize_text_field( $request->get_param( 'snapshot_id' ) );

		if ( ! get_post( $post_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
		}

		$snapshots = self::get_snapshots( $post_id );
		$target    = null;

		foreach ( $snapshots as $s ) {
			if ( $s['snapshotId'] === $snapshot_id ) {
				$target = $s;
				break;
			}
		}

		if ( ! $target ) {
			return new WP_REST_Response( array( 'error' => 'Snapshot not found.' ), 404 );
		}

		// Auto-snapshot current state before rollback
		self::take_snapshot( $post_id, 'Pre-rollback auto-snapshot' );

		// Restore the elements (bypass hash check since we're rolling back)
		$meta_key = ATB_Bricks_Lifecycle::content_meta_key();
		update_post_meta( $post_id, $meta_key, $target['elements'] );

		// Regenerate CSS and clear caches
		ATB_Bricks_Lifecycle::regenerate_css( $post_id );
		ATB_Bricks_Lifecycle::clear_cache( $post_id );

		// Read back to get fresh hash
		$data = ATB_Bricks_Lifecycle::read_elements( $post_id );

		return new WP_REST_Response( array(
			'contentHash'  => $data['contentHash'],
			'count'        => count( $data['elements'] ),
			'restoredFrom' => $snapshot_id,
		), 200 );
	}

	/**
	 * Take a snapshot of the current page content.
	 * Returns the snapshot data.
	 */
	public static function take_snapshot( $post_id, $label = '' ) {
		$data     = ATB_Bricks_Lifecycle::read_elements( $post_id );
		$snapshot = array(
			'snapshotId'   => 'snap_' . substr( md5( uniqid( '', true ) ), 0, 12 ),
			'contentHash'  => $data['contentHash'],
			'elementCount' => count( $data['elements'] ),
			'elements'     => $data['elements'],
			'timestamp'    => current_time( 'mysql' ),
			'label'        => $label,
		);

		$snapshots   = self::get_snapshots( $post_id );
		$snapshots[] = $snapshot;

		// FIFO: keep max N snapshots
		if ( count( $snapshots ) > self::MAX_SNAPSHOTS ) {
			$snapshots = array_slice( $snapshots, -self::MAX_SNAPSHOTS );
		}

		update_post_meta( $post_id, self::META_KEY, $snapshots );

		return $snapshot;
	}

	/**
	 * Get all snapshots for a page.
	 */
	private static function get_snapshots( $post_id ) {
		$snapshots = get_post_meta( $post_id, self::META_KEY, true );
		return is_array( $snapshots ) ? $snapshots : array();
	}
}
