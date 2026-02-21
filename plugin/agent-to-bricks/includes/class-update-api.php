<?php
/**
 * Plugin self-update via REST API.
 *
 * Allows the CLI to trigger plugin updates by downloading from GitHub Releases
 * and using WordPress Plugin_Upgrader.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Update_API {

	const GITHUB_REPO = 'nerveband/agent-to-bricks';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		register_rest_route( 'agent-bricks/v1', '/site/update', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'handle_update' ),
			'permission_callback' => array( __CLASS__, 'check_permission' ),
			'args'                => array(
				'version' => array(
					'required' => true,
					'type'     => 'string',
				),
			),
		) );
	}

	public static function check_permission() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * POST /site/update — Download and install plugin update from GitHub.
	 */
	public static function handle_update( $request ) {
		$version          = sanitize_text_field( $request->get_param( 'version' ) );
		$previous_version = AGENT_BRICKS_VERSION;

		// Build download URL
		$download_url = sprintf(
			'https://github.com/%s/releases/download/v%s/agent-to-bricks-plugin-%s.zip',
			self::GITHUB_REPO,
			$version,
			$version
		);

		// Verify the release exists
		$head = wp_remote_head( $download_url, array( 'timeout' => 10 ) );
		if ( is_wp_error( $head ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => 'Cannot reach GitHub: ' . $head->get_error_message(),
			), 502 );
		}

		$status = wp_remote_retrieve_response_code( $head );
		if ( $status !== 200 && $status !== 302 ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => sprintf( 'Plugin zip not found for v%s (HTTP %d)', $version, $status ),
			), 404 );
		}

		// Use WordPress upgrader
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/plugin.php';

		$skin     = new WP_Ajax_Upgrader_Skin();
		$upgrader = new Plugin_Upgrader( $skin );

		// Download and install
		$result = $upgrader->install( $download_url, array(
			'overwrite_package' => true,
		) );

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $result->get_error_message(),
			), 500 );
		}

		if ( $result === false ) {
			$errors = $skin->get_errors();
			$msg    = is_wp_error( $errors ) ? $errors->get_error_message() : 'Unknown install error';
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $msg,
			), 500 );
		}

		// Reactivate plugin
		$plugin_file = 'agent-to-bricks/agent-to-bricks.php';
		if ( ! is_plugin_active( $plugin_file ) ) {
			activate_plugin( $plugin_file );
		}

		return new WP_REST_Response( array(
			'success'         => true,
			'version'         => $version,
			'previousVersion' => $previous_version,
		), 200 );
	}
}
