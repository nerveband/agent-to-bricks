<?php
/**
 * Per-key access control for page/template/component access.
 *
 * Supports three modes per API key:
 * - 'unrestricted' (default): full access to all content
 * - 'allow': only listed post IDs and post types are accessible
 * - 'deny': listed post IDs and post types are blocked, everything else is allowed
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Access_Control {

	const OPTION_KEY = 'agent_bricks_access_rules';

	/**
	 * Current request's API key prefix (set during authentication).
	 */
	private static $current_key_prefix = null;

	/**
	 * Set the current API key prefix after successful authentication.
	 */
	public static function set_current_key( $key_prefix ) {
		self::$current_key_prefix = $key_prefix;
	}

	/**
	 * Get the current API key prefix.
	 */
	public static function get_current_key() {
		return self::$current_key_prefix;
	}

	/**
	 * Check if the current API key is allowed to access a specific post.
	 *
	 * @param int $post_id The post ID to check access for.
	 * @return true|WP_Error True if allowed, WP_Error if denied.
	 */
	public static function can_access_post( $post_id ) {
		if ( self::$current_key_prefix === null ) {
			return true;
		}

		$rules = self::get_rules_for_key( self::$current_key_prefix );

		if ( empty( $rules ) || ( $rules['mode'] ?? 'unrestricted' ) === 'unrestricted' ) {
			return true;
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return true;
		}

		$mode          = $rules['mode'];
		$allowed_ids   = $rules['post_ids'] ?? array();
		$allowed_types = $rules['post_types'] ?? array();

		$id_match   = in_array( (int) $post_id, array_map( 'intval', $allowed_ids ), true );
		$type_match = in_array( $post->post_type, $allowed_types, true );

		if ( $mode === 'allow' ) {
			if ( ! $id_match && ! $type_match ) {
				return new WP_Error(
					'atb_access_denied',
					sprintf( 'Access denied: API key %s... is not allowed to access post %d.', self::$current_key_prefix, $post_id ),
					array( 'status' => 403 )
				);
			}
		} elseif ( $mode === 'deny' ) {
			if ( $id_match || $type_match ) {
				return new WP_Error(
					'atb_access_denied',
					sprintf( 'Access denied: API key %s... is blocked from accessing post %d.', self::$current_key_prefix, $post_id ),
					array( 'status' => 403 )
				);
			}
		}

		return true;
	}

	/**
	 * Filter an array of post IDs based on access rules.
	 */
	public static function filter_post_ids( array $post_ids ) {
		if ( self::$current_key_prefix === null ) {
			return $post_ids;
		}

		$rules = self::get_rules_for_key( self::$current_key_prefix );
		if ( empty( $rules ) || ( $rules['mode'] ?? 'unrestricted' ) === 'unrestricted' ) {
			return $post_ids;
		}

		return array_values( array_filter( $post_ids, function( $pid ) {
			return self::can_access_post( (int) $pid ) === true;
		} ) );
	}

	/**
	 * Get access rules for a specific key prefix.
	 */
	public static function get_rules_for_key( $key_prefix ) {
		$all_rules = get_option( self::OPTION_KEY, array() );

		if ( isset( $all_rules[ $key_prefix ] ) ) {
			return $all_rules[ $key_prefix ];
		}

		if ( isset( $all_rules['__default__'] ) ) {
			return $all_rules['__default__'];
		}

		return array( 'mode' => 'unrestricted' );
	}

	/**
	 * Save access rules for a key prefix.
	 */
	public static function save_rules( $key_prefix, $rules ) {
		$all_rules = get_option( self::OPTION_KEY, array() );
		$all_rules[ $key_prefix ] = $rules;
		update_option( self::OPTION_KEY, $all_rules );
	}

	/**
	 * Delete access rules for a key prefix.
	 */
	public static function delete_rules( $key_prefix ) {
		$all_rules = get_option( self::OPTION_KEY, array() );
		unset( $all_rules[ $key_prefix ] );
		update_option( self::OPTION_KEY, $all_rules );
	}

	/**
	 * Get all access rules (for admin display).
	 */
	public static function get_all_rules() {
		return get_option( self::OPTION_KEY, array() );
	}
}
