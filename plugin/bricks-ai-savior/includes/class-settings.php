<?php
/**
 * Admin settings page for Bricks AI Savior.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BricksAI_Settings {

	const OPTION_KEY = 'bricks_ai_settings';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'add_menu_page' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
	}

	public static function add_menu_page() {
		add_options_page(
			'Bricks AI Savior',
			'Bricks AI',
			'manage_options',
			'bricks-ai-settings',
			array( __CLASS__, 'render_page' )
		);
	}

	public static function register_settings() {
		register_setting( 'bricks_ai', self::OPTION_KEY, array(
			'type'              => 'array',
			'sanitize_callback' => array( __CLASS__, 'sanitize' ),
		) );
	}

	/**
	 * Get all settings with defaults.
	 */
	public static function get_all() {
		$defaults = array(
			'provider'    => 'cerebras',
			'api_key'     => '',
			'model'       => '',
			'base_url'    => '',
			'temperature' => 0.7,
			'max_tokens'  => 4000,
		);
		$saved = get_option( self::OPTION_KEY, array() );
		return wp_parse_args( $saved, $defaults );
	}

	/**
	 * Sanitize settings before save.
	 */
	public static function sanitize( $input ) {
		$clean = array();
		$clean['provider']    = sanitize_text_field( $input['provider'] ?? 'cerebras' );
		$clean['model']       = sanitize_text_field( $input['model'] ?? '' );
		$clean['base_url']    = esc_url_raw( $input['base_url'] ?? '' );
		$clean['temperature'] = floatval( $input['temperature'] ?? 0.7 );
		$clean['max_tokens']  = intval( $input['max_tokens'] ?? 4000 );

		// Encrypt API key if changed.
		$existing = self::get_all();
		$raw_key  = $input['api_key'] ?? '';
		if ( $raw_key !== '' && $raw_key !== '••••••••' ) {
			$clean['api_key'] = self::encrypt_key( $raw_key );
		} else {
			$clean['api_key'] = $existing['api_key'];
		}

		return $clean;
	}

	/**
	 * Simple encryption for API key storage.
	 */
	private static function encrypt_key( $key ) {
		if ( empty( $key ) ) {
			return '';
		}
		return base64_encode( openssl_encrypt(
			$key,
			'aes-256-cbc',
			wp_salt( 'auth' ),
			0,
			substr( md5( wp_salt( 'secure_auth' ) ), 0, 16 )
		) );
	}

	/**
	 * Decrypt API key for use.
	 */
	public static function decrypt_key( $encrypted ) {
		if ( empty( $encrypted ) ) {
			return '';
		}
		return openssl_decrypt(
			base64_decode( $encrypted ),
			'aes-256-cbc',
			wp_salt( 'auth' ),
			0,
			substr( md5( wp_salt( 'secure_auth' ) ), 0, 16 )
		);
	}

	/**
	 * Render the settings page.
	 */
	public static function render_page() {
		$settings  = self::get_all();
		$providers = BricksAI_Providers::get_all();
		$has_key   = ! empty( $settings['api_key'] );
		?>
		<div class="wrap">
			<h1>Bricks AI Savior</h1>

			<form method="post" action="options.php">
				<?php settings_fields( 'bricks_ai' ); ?>

				<table class="form-table">
					<tr>
						<th scope="row"><label for="bricks_ai_provider">LLM Provider</label></th>
						<td>
							<select name="<?php echo self::OPTION_KEY; ?>[provider]" id="bricks_ai_provider">
								<?php foreach ( $providers as $id => $provider ) : ?>
									<option value="<?php echo esc_attr( $id ); ?>"
										<?php selected( $settings['provider'], $id ); ?>
										data-base-url="<?php echo esc_attr( $provider['base_url'] ); ?>"
										data-models="<?php echo esc_attr( implode( ',', $provider['models'] ) ); ?>"
										data-default="<?php echo esc_attr( $provider['default'] ); ?>">
										<?php echo esc_html( $provider['name'] ); ?>
									</option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="bricks_ai_api_key">API Key</label></th>
						<td>
							<input type="password"
								name="<?php echo self::OPTION_KEY; ?>[api_key]"
								id="bricks_ai_api_key"
								value="<?php echo $has_key ? '••••••••' : ''; ?>"
								class="regular-text"
								autocomplete="off" />
							<?php if ( $has_key ) : ?>
								<span class="description" style="color: green;">Key saved</span>
							<?php endif; ?>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="bricks_ai_model">Model</label></th>
						<td>
							<input type="text"
								name="<?php echo self::OPTION_KEY; ?>[model]"
								id="bricks_ai_model"
								value="<?php echo esc_attr( $settings['model'] ); ?>"
								class="regular-text"
								placeholder="Leave empty for provider default" />
							<p class="description" id="bricks_ai_model_suggestions"></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="bricks_ai_base_url">Base URL</label></th>
						<td>
							<input type="url"
								name="<?php echo self::OPTION_KEY; ?>[base_url]"
								id="bricks_ai_base_url"
								value="<?php echo esc_attr( $settings['base_url'] ); ?>"
								class="regular-text"
								placeholder="Auto-filled per provider" />
							<p class="description">Only change for custom providers.</p>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="bricks_ai_temperature">Temperature</label></th>
						<td>
							<input type="range"
								name="<?php echo self::OPTION_KEY; ?>[temperature]"
								id="bricks_ai_temperature"
								min="0" max="1.5" step="0.1"
								value="<?php echo esc_attr( $settings['temperature'] ); ?>" />
							<span id="bricks_ai_temp_value"><?php echo esc_html( $settings['temperature'] ); ?></span>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="bricks_ai_max_tokens">Max Tokens</label></th>
						<td>
							<input type="number"
								name="<?php echo self::OPTION_KEY; ?>[max_tokens]"
								id="bricks_ai_max_tokens"
								value="<?php echo esc_attr( $settings['max_tokens'] ); ?>"
								min="1000" max="16000" step="500" />
							<p class="description">4000 for sections, 8000+ for full pages.</p>
						</td>
					</tr>
				</table>

				<?php submit_button(); ?>
			</form>
		</div>

		<script>
		(function() {
			var providerSelect = document.getElementById('bricks_ai_provider');
			var baseUrlInput = document.getElementById('bricks_ai_base_url');
			var modelInput = document.getElementById('bricks_ai_model');
			var modelSuggestions = document.getElementById('bricks_ai_model_suggestions');
			var tempSlider = document.getElementById('bricks_ai_temperature');
			var tempValue = document.getElementById('bricks_ai_temp_value');

			providerSelect.addEventListener('change', function() {
				var opt = this.options[this.selectedIndex];
				var baseUrl = opt.dataset.baseUrl;
				var models = opt.dataset.models;
				var defaultModel = opt.dataset.default;

				if (baseUrl) baseUrlInput.value = baseUrl;
				if (defaultModel && !modelInput.value) modelInput.placeholder = defaultModel;
				if (models) modelSuggestions.textContent = 'Available: ' + models;
			});

			tempSlider.addEventListener('input', function() {
				tempValue.textContent = this.value;
			});

			// Trigger on load.
			providerSelect.dispatchEvent(new Event('change'));
		})();
		</script>
		<?php
	}
}
