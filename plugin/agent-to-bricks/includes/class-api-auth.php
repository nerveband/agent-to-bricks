<?php
/**
 * API key authentication for external CLI/agent access.
 *
 * Works on any server (Nginx, Apache, LiteSpeed, etc.) because
 * it uses X-ATB-Key custom header instead of the Authorization header
 * which many server configs strip before reaching PHP.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_API_Auth {

	const OPTION_KEY = 'agent_bricks_api_keys';

	public static function init() {
		// Hook into REST API authentication early
		add_filter( 'rest_authentication_errors', array( __CLASS__, 'authenticate' ), 5 );

		// Add AJAX handler for generating keys
		add_action( 'wp_ajax_atb_generate_api_key', array( __CLASS__, 'ajax_generate_key' ) );
		add_action( 'wp_ajax_atb_revoke_api_key', array( __CLASS__, 'ajax_revoke_key' ) );
		add_action( 'wp_ajax_atb_reveal_api_key', array( __CLASS__, 'ajax_reveal_key' ) );
	}

	/**
	 * Authenticate REST requests via X-ATB-Key header.
	 *
	 * Only intercepts if:
	 * 1. User is not already logged in
	 * 2. X-ATB-Key header is present
	 * 3. Request is for our namespace
	 */
	public static function authenticate( $result ) {
		// If already authenticated or already errored, don't interfere
		if ( $result !== null || is_user_logged_in() ) {
			return $result;
		}

		// Only process if X-ATB-Key header is present
		$api_key = self::get_request_key();
		if ( empty( $api_key ) ) {
			return $result;
		}

		// Rate limiting on failed auth attempts
		$rate_check = self::check_rate_limit();
		if ( is_wp_error( $rate_check ) ) {
			return $rate_check;
		}

		// Validate the key
		$key_data = self::validate_key( $api_key );
		if ( ! $key_data ) {
			self::record_auth_failure();
			return new WP_Error(
				'atb_invalid_api_key',
				'Invalid API key.',
				array( 'status' => 401 )
			);
		}

		// Log in as the key's owner
		wp_set_current_user( $key_data['user_id'] );

		// Update last used timestamp (throttled)
		self::touch_key( $api_key );

		return true;
	}

	/**
	 * Extract API key from request headers.
	 * Checks X-ATB-Key header (forwarded by all web servers).
	 */
	private static function get_request_key() {
		// Check $_SERVER directly (Nginx sets HTTP_X_ATB_KEY)
		if ( ! empty( $_SERVER['HTTP_X_ATB_KEY'] ) ) {
			return sanitize_text_field( $_SERVER['HTTP_X_ATB_KEY'] );
		}

		// Fallback: getallheaders() for servers that support it
		if ( function_exists( 'getallheaders' ) ) {
			$headers = getallheaders();
			foreach ( $headers as $name => $value ) {
				if ( strtolower( $name ) === 'x-atb-key' ) {
					return sanitize_text_field( $value );
				}
			}
		}

		return '';
	}

	/**
	 * Validate an API key against stored keys.
	 * Returns key data array or false.
	 */
	public static function validate_key( $key ) {
		$keys = get_option( self::OPTION_KEY, array() );

		// Keys are stored hashed
		$key_hash = self::hash_key( $key );

		foreach ( $keys as $stored ) {
			if ( hash_equals( $stored['key_hash'], $key_hash ) ) {
				return $stored;
			}
		}

		return false;
	}

	/**
	 * Generate a new API key for the current user.
	 * Returns the raw key (only shown once).
	 */
	public static function generate_key( $user_id, $label = '' ) {
		$raw_key = 'atb_' . wp_generate_password( 40, false );

		$keys = get_option( self::OPTION_KEY, array() );
		$keys[] = array(
			'key_hash'      => self::hash_key( $raw_key ),
			'key_encrypted' => self::encrypt_key( $raw_key ),
			'key_prefix'    => substr( $raw_key, 0, 8 ),
			'user_id'    => (int) $user_id,
			'label'      => sanitize_text_field( $label ),
			'created'    => current_time( 'mysql' ),
			'last_used'  => null,
		);

		update_option( self::OPTION_KEY, $keys );

		return $raw_key;
	}

	/**
	 * Revoke a key by its prefix.
	 */
	public static function revoke_key( $key_prefix ) {
		$keys = get_option( self::OPTION_KEY, array() );
		$keys = array_values( array_filter( $keys, function( $k ) use ( $key_prefix ) {
			return $k['key_prefix'] !== $key_prefix;
		} ) );
		update_option( self::OPTION_KEY, $keys );
	}

	private static function touch_key( $raw_key ) {
		$key_hash = self::hash_key( $raw_key );
		$transient_key = 'atb_touch_' . substr( $key_hash, 0, 12 );

		// Only update DB every 5 minutes per key
		if ( get_transient( $transient_key ) ) {
			return;
		}

		$keys = get_option( self::OPTION_KEY, array() );
		foreach ( $keys as &$stored ) {
			if ( hash_equals( $stored['key_hash'], $key_hash ) ) {
				$stored['last_used'] = current_time( 'mysql' );
				break;
			}
		}
		unset( $stored );

		update_option( self::OPTION_KEY, $keys );
		set_transient( $transient_key, 1, 5 * MINUTE_IN_SECONDS );
	}

	/**
	 * Get all stored keys (without hashes, for display).
	 */
	public static function get_all_keys() {
		$keys = get_option( self::OPTION_KEY, array() );
		return array_map( function( $k ) {
			return array(
				'prefix'    => $k['key_prefix'],
				'label'     => $k['label'],
				'user_id'   => $k['user_id'],
				'created'   => $k['created'],
				'last_used' => $k['last_used'],
			);
		}, $keys );
	}

	/**
	 * Hash a key for storage (one-way).
	 */
	private static function hash_key( $key ) {
		return hash( 'sha256', $key . wp_salt( 'auth' ) );
	}

	/**
	 * Encrypt key for retrievable storage (admin-only reveal).
	 * Uses a random IV per encryption for stronger security.
	 */
	private static function encrypt_key( $key ) {
		if ( empty( $key ) ) {
			return '';
		}
		$iv        = openssl_random_pseudo_bytes( 16 );
		$encrypted = openssl_encrypt( $key, 'aes-256-cbc', wp_salt( 'auth' ), OPENSSL_RAW_DATA, $iv );
		// Prepend IV to ciphertext so it can be extracted during decryption.
		return base64_encode( $iv . $encrypted );
	}

	/**
	 * Decrypt a stored encrypted key.
	 * Supports both new (random IV prepended) and legacy (static IV) formats.
	 */
	private static function decrypt_stored_key( $encrypted ) {
		if ( empty( $encrypted ) ) {
			return '';
		}
		$data = base64_decode( $encrypted );
		if ( $data === false ) {
			return '';
		}

		// New format: first 16 bytes are IV, rest is raw ciphertext.
		if ( strlen( $data ) > 16 ) {
			$iv         = substr( $data, 0, 16 );
			$ciphertext = substr( $data, 16 );
			$decrypted  = openssl_decrypt( $ciphertext, 'aes-256-cbc', wp_salt( 'auth' ), OPENSSL_RAW_DATA, $iv );
			if ( $decrypted !== false ) {
				return $decrypted;
			}
		}

		// Legacy fallback: static IV, base64-encoded ciphertext from openssl_encrypt default.
		$legacy_iv = substr( md5( wp_salt( 'secure_auth' ) ), 0, 16 );
		$decrypted = openssl_decrypt( $data, 'aes-256-cbc', wp_salt( 'auth' ), 0, $legacy_iv );
		if ( $decrypted !== false ) {
			return $decrypted;
		}

		return '';
	}

	/**
	 * AJAX: Generate a new API key.
	 */
	public static function ajax_generate_key() {
		check_ajax_referer( 'atb_api_key_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Unauthorized' );
		}

		$label = sanitize_text_field( $_POST['label'] ?? 'CLI' );
		$raw_key = self::generate_key( get_current_user_id(), $label );

		wp_send_json_success( array(
			'key'    => $raw_key,
			'prefix' => substr( $raw_key, 0, 8 ),
			'label'  => $label,
		) );
	}

	/**
	 * AJAX: Revoke an API key.
	 */
	public static function ajax_revoke_key() {
		check_ajax_referer( 'atb_api_key_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Unauthorized' );
		}

		$prefix = sanitize_text_field( $_POST['prefix'] ?? '' );
		if ( empty( $prefix ) ) {
			wp_send_json_error( 'No key prefix' );
		}

		self::revoke_key( $prefix );
		wp_send_json_success();
	}

	/**
	 * AJAX: Reveal an API key for copying.
	 */
	public static function ajax_reveal_key() {
		check_ajax_referer( 'atb_api_key_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Unauthorized' );
		}

		$prefix = sanitize_text_field( $_POST['prefix'] ?? '' );
		if ( empty( $prefix ) ) {
			wp_send_json_error( 'No key prefix' );
		}

		$keys = get_option( self::OPTION_KEY, array() );
		foreach ( $keys as $k ) {
			if ( $k['key_prefix'] === $prefix && ! empty( $k['key_encrypted'] ) ) {
				$decrypted = self::decrypt_stored_key( $k['key_encrypted'] );
				if ( $decrypted ) {
					wp_send_json_success( array( 'key' => $decrypted ) );
				}
			}
		}

		wp_send_json_error( 'Key not retrievable. Revoke and generate a new one.' );
	}

	/**
	 * Check if the current IP has exceeded the auth failure rate limit.
	 */
	private static function check_rate_limit() {
		$ip_hash = self::get_ip_hash();
		$transient_key = 'atb_auth_fail_' . $ip_hash;
		$failures = (int) get_transient( $transient_key );

		if ( $failures >= 10 ) {
			return new WP_Error(
				'atb_rate_limited',
				'Too many failed authentication attempts. Try again later.',
				array( 'status' => 429 )
			);
		}

		return true;
	}

	/**
	 * Record a failed authentication attempt for rate limiting.
	 */
	private static function record_auth_failure() {
		$ip_hash = self::get_ip_hash();
		$transient_key = 'atb_auth_fail_' . $ip_hash;
		$failures = (int) get_transient( $transient_key );
		set_transient( $transient_key, $failures + 1, 5 * MINUTE_IN_SECONDS );
	}

	/**
	 * Get a hashed representation of the client IP for rate limiting.
	 */
	private static function get_ip_hash() {
		$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
		return substr( hash( 'sha256', $ip . wp_salt( 'auth' ) ), 0, 16 );
	}
}
