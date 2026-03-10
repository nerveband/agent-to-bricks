<?php
/**
 * Bricks lifecycle management — content read/write with CSS regeneration.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Bricks_Lifecycle {

	/**
	 * Drop post/meta caches so the next read reflects persisted storage.
	 */
	private static function refresh_post_caches( $post_id ) {
		wp_cache_delete( $post_id, 'post_meta' );
		clean_post_cache( $post_id );
	}

	/**
	 * Get the correct post meta key for Bricks content.
	 */
	public static function content_meta_key() {
		if ( defined( 'BRICKS_VERSION' ) && version_compare( BRICKS_VERSION, '1.7.3', '>=' ) ) {
			return '_bricks_page_content_2';
		}
		return '_bricks_page_content';
	}

	/**
	 * Read page elements from post meta.
	 * Returns [ 'elements' => array, 'contentHash' => string ]
	 */
	public static function read_elements( $post_id ) {
		$meta_key = self::content_meta_key();
		$elements = get_post_meta( $post_id, $meta_key, true );
		if ( ! is_array( $elements ) ) {
			$elements = array();
		}
		$hash = md5( maybe_serialize( $elements ) );
		return array(
			'elements'    => $elements,
			'contentHash' => $hash,
		);
	}

	/**
	 * Write page elements to post meta + trigger Bricks lifecycle.
	 * Returns new contentHash on success, WP_Error on failure.
	 */
	public static function write_elements( $post_id, $elements, $expected_hash = null ) {
		// Optimistic locking: verify content hasn't changed since client read it
		if ( $expected_hash !== null ) {
			$current = self::read_elements( $post_id );
			if ( $current['contentHash'] !== $expected_hash ) {
				return new WP_Error(
					'content_conflict',
					'Content has been modified since you last read it. Re-fetch and try again.',
					array(
						'status'      => 409,
						'currentHash' => $current['contentHash'],
					)
				);
			}
		}

		$meta_key = self::content_meta_key();
		$desired_hash = md5( maybe_serialize( $elements ) );

		update_post_meta( $post_id, $meta_key, $elements );
		self::refresh_post_caches( $post_id );

		$persisted = self::read_elements( $post_id );
		if ( $persisted['contentHash'] !== $desired_hash ) {
			// Some Bricks/WordPress installs refuse update_post_meta() for this key
			// even though a delete+add cycle succeeds. Retry once with that path.
			delete_post_meta( $post_id, $meta_key );
			add_post_meta( $post_id, $meta_key, $elements, true );
			self::refresh_post_caches( $post_id );

			$persisted = self::read_elements( $post_id );
			if ( $persisted['contentHash'] !== $desired_hash ) {
				return new WP_Error(
					'content_write_failed',
					'Failed to persist page content.',
					array(
						'status'       => 500,
						'expectedHash' => $desired_hash,
						'currentHash'  => $persisted['contentHash'],
					)
				);
			}
		}

		// Trigger Bricks CSS regeneration
		self::regenerate_css( $post_id );

		// Clear Bricks caches
		self::clear_cache( $post_id );

		// Fire action for other plugins
		do_action( 'agent_bricks_content_updated', $post_id, $elements );

		// Return the persisted hash, not the pre-write in-memory hash. Bricks/WP can
		// normalize stored meta, and clients use this value for the next If-Match.
		self::refresh_post_caches( $post_id );
		return self::read_elements( $post_id )['contentHash'];
	}

	/**
	 * Regenerate Bricks CSS file for a post.
	 */
	public static function regenerate_css( $post_id ) {
		if ( class_exists( '\Bricks\Assets' ) ) {
			if ( method_exists( '\Bricks\Assets', 'generate_css_file' ) ) {
				\Bricks\Assets::generate_css_file( $post_id );
			}
		}
	}

	/**
	 * Clear Bricks-related caches for a post.
	 */
	public static function clear_cache( $post_id ) {
		// Delete Bricks transients
		delete_transient( 'bricks_' . $post_id );

		// Clear CSS variables cache (may have changed if CSS framework regenerated)
		delete_transient( 'atb_css_vars_cache' );

		// Clear object cache for this post
		wp_cache_delete( $post_id, 'post_meta' );
		clean_post_cache( $post_id );
	}
}
