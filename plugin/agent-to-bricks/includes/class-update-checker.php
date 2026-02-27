<?php
/**
 * Checks GitHub for new releases, hooks into WordPress native plugin
 * update system for one-click updates, and shows an admin notice.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Update_Checker {

	const GITHUB_REPO  = 'nerveband/agent-to-bricks';
	const CACHE_KEY    = 'atb_github_latest_release';
	const CACHE_TTL    = 21600; // 6 hours
	const DISMISS_META = 'atb_update_dismissed_until';
	const PLUGIN_FILE  = 'agent-to-bricks/agent-to-bricks.php';

	public static function init() {
		add_action( 'admin_notices', array( __CLASS__, 'maybe_show_notice' ) );
		add_action( 'wp_ajax_atb_dismiss_update_notice', array( __CLASS__, 'dismiss_notice' ) );
		add_filter( 'pre_set_site_transient_update_plugins', array( __CLASS__, 'inject_update' ) );
		add_filter( 'plugins_api', array( __CLASS__, 'plugin_info' ), 20, 3 );
	}

	/**
	 * Inject update info into the plugin update transient so WordPress
	 * shows "Update available" on the Plugins page.
	 */
	public static function inject_update( $transient ) {
		if ( ! is_object( $transient ) ) {
			$transient = new \stdClass();
		}

		$release = self::get_latest_release();
		if ( ! $release ) {
			return $transient;
		}

		$remote_version = ltrim( $release['tag_name'], 'v' );

		if ( version_compare( $remote_version, AGENT_BRICKS_VERSION, '<=' ) ) {
			return $transient;
		}

		$update              = new \stdClass();
		$update->slug        = 'agent-to-bricks';
		$update->plugin      = self::PLUGIN_FILE;
		$update->new_version = $remote_version;
		$update->url         = 'https://github.com/' . self::GITHUB_REPO;
		$update->package     = 'https://github.com/' . self::GITHUB_REPO
			. '/releases/download/v' . $remote_version
			. '/agent-to-bricks-plugin-' . $remote_version . '.zip';
		$update->tested      = '6.7';
		$update->requires_php = '8.0';

		$transient->response[ self::PLUGIN_FILE ] = $update;

		return $transient;
	}

	/**
	 * Provide plugin details for the "View details" modal on the Plugins page.
	 */
	public static function plugin_info( $result, $action, $args ) {
		if ( $action !== 'plugin_information' ) {
			return $result;
		}
		if ( ! isset( $args->slug ) || $args->slug !== 'agent-to-bricks' ) {
			return $result;
		}

		$release = self::get_latest_release();
		if ( ! $release ) {
			return $result;
		}

		$remote_version = ltrim( $release['tag_name'], 'v' );

		$info                = new \stdClass();
		$info->name          = 'Agent to Bricks';
		$info->slug          = 'agent-to-bricks';
		$info->version       = $remote_version;
		$info->author        = '<a href="https://agenttobricks.com">WaveDepth</a>';
		$info->homepage      = 'https://agenttobricks.com';
		$info->download_link = 'https://github.com/' . self::GITHUB_REPO
			. '/releases/download/v' . $remote_version
			. '/agent-to-bricks-plugin-' . $remote_version . '.zip';
		$info->requires_php  = '8.0';
		$info->tested        = '6.7';
		$info->sections      = array(
			'description' => 'AI-powered element generation for Bricks Builder with multi-provider LLM support.',
			'changelog'   => nl2br( esc_html( $release['body'] ?? '' ) ),
		);

		return $info;
	}

	/**
	 * Show update notice if a newer version is available.
	 */
	public static function maybe_show_notice() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Check if dismissed
		$dismissed_until = get_user_meta( get_current_user_id(), self::DISMISS_META, true );
		if ( $dismissed_until && time() < (int) $dismissed_until ) {
			return;
		}

		$release = self::get_latest_release();
		if ( ! $release ) {
			return;
		}

		$remote_version = ltrim( $release['tag_name'], 'v' );
		$local_version  = AGENT_BRICKS_VERSION;

		if ( version_compare( $remote_version, $local_version, '<=' ) ) {
			return;
		}

		$nonce = wp_create_nonce( 'atb_dismiss_update' );
		?>
		<div class="notice notice-info is-dismissible" id="atb-update-notice">
			<p>
				<strong>Agent to Bricks v<?php echo esc_html( $remote_version ); ?></strong> is available
				(you have v<?php echo esc_html( $local_version ); ?>).
				Update via CLI: <code>bricks update</code> or download from
				<a href="https://agenttobricks.com/getting-started/installation/" target="_blank">agenttobricks.com</a>.
			</p>
		</div>
		<script>
		jQuery(document).on('click', '#atb-update-notice .notice-dismiss', function() {
			jQuery.post(ajaxurl, {
				action: 'atb_dismiss_update_notice',
				nonce: '<?php echo esc_js( $nonce ); ?>'
			});
		});
		</script>
		<?php
	}

	/**
	 * AJAX handler: dismiss update notice for 7 days.
	 */
	public static function dismiss_notice() {
		check_ajax_referer( 'atb_dismiss_update', 'nonce' );
		$until = time() + ( 7 * DAY_IN_SECONDS );
		update_user_meta( get_current_user_id(), self::DISMISS_META, $until );
		wp_send_json_success();
	}

	/**
	 * Fetch latest release from GitHub (cached 6h).
	 */
	private static function get_latest_release() {
		$cached = get_transient( self::CACHE_KEY );
		if ( $cached !== false ) {
			return $cached;
		}

		$url = 'https://api.github.com/repos/' . self::GITHUB_REPO . '/releases/latest';

		$response = wp_remote_get( $url, array(
			'headers' => array(
				'Accept'     => 'application/vnd.github.v3+json',
				'User-Agent' => 'AgentToBricks-WP/' . AGENT_BRICKS_VERSION,
			),
			'timeout' => 15,
		) );

		if ( is_wp_error( $response ) ) {
			return null;
		}

		if ( wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return null;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $body ) || isset( $body['message'] ) ) {
			return null;
		}

		set_transient( self::CACHE_KEY, $body, self::CACHE_TTL );

		return $body;
	}
}
