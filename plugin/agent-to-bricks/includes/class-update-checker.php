<?php
/**
 * Checks GitHub for new releases and shows an admin notice.
 *
 * Based on the tailor-made GitHub Updater pattern. Does NOT hook into
 * WordPress plugin update system — directs users to the CLI instead.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Update_Checker {

	const GITHUB_REPO  = 'nerveband/agent-to-bricks';
	const CACHE_KEY    = 'atb_github_latest_release';
	const CACHE_TTL    = 21600; // 6 hours
	const DISMISS_META = 'atb_update_dismissed_until';

	public static function init() {
		add_action( 'admin_notices', array( __CLASS__, 'maybe_show_notice' ) );
		add_action( 'wp_ajax_atb_dismiss_update_notice', array( __CLASS__, 'dismiss_notice' ) );
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
				Update from your CLI: <code>bricks update</code>
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
