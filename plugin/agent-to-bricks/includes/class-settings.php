<?php
/**
 * Admin settings page for Agent to Bricks.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATB_Settings {

	const OPTION_KEY = 'agent_bricks_settings';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'add_menu_page' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
	}

	public static function add_menu_page() {
		add_options_page(
			'Agent to Bricks',
			'Agent to Bricks',
			'manage_options',
			'agent-bricks-settings',
			array( __CLASS__, 'render_page' )
		);
	}

	public static function register_settings() {
		register_setting( 'agent_bricks', self::OPTION_KEY, array(
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
		$providers = ATB_Providers::get_all();
		$has_key   = ! empty( $settings['api_key'] );
		$api_keys  = class_exists( 'ATB_API_Auth' ) ? ATB_API_Auth::get_all_keys() : array();
		?>
		<div class="wrap">
			<h1>Agent to Bricks</h1>

			<!-- CLI / Agent API Keys -->
			<h2>CLI &amp; Agent API Keys</h2>
			<p class="description">Generate API keys for external tools (CLI, AI agents) to access your site. Keys use the <code>X-ATB-Key</code> header, which works on all hosting providers.</p>

			<table class="widefat fixed striped" style="max-width:700px;">
				<thead>
					<tr>
						<th>Label</th>
						<th>Key Prefix</th>
						<th>Created</th>
						<th>Last Used</th>
						<th></th>
					</tr>
				</thead>
				<tbody id="atb-api-keys-list">
					<?php if ( empty( $api_keys ) ) : ?>
						<tr id="atb-no-keys"><td colspan="5">No API keys yet.</td></tr>
					<?php else : ?>
						<?php foreach ( $api_keys as $k ) : ?>
							<tr data-prefix="<?php echo esc_attr( $k['prefix'] ); ?>">
								<td><?php echo esc_html( $k['label'] ); ?></td>
								<td><code><?php echo esc_html( $k['prefix'] ); ?>...</code></td>
								<td><?php echo esc_html( $k['created'] ); ?></td>
								<td><?php echo $k['last_used'] ? esc_html( $k['last_used'] ) : '<em>Never</em>'; ?></td>
								<td><button type="button" class="button button-small atb-revoke-key" data-prefix="<?php echo esc_attr( $k['prefix'] ); ?>">Revoke</button></td>
							</tr>
						<?php endforeach; ?>
					<?php endif; ?>
				</tbody>
			</table>

			<p style="margin-top:10px;">
				<input type="text" id="atb-new-key-label" placeholder="Key label (e.g. My CLI)" style="width:200px;" />
				<button type="button" class="button button-primary" id="atb-generate-key">Generate New Key</button>
			</p>
			<div id="atb-new-key-display" style="display:none; margin:10px 0; padding:12px; background:#f0f6fc; border:1px solid #0073aa; border-radius:4px;">
				<strong>New API key created!</strong> Copy it now — it won't be shown again:<br>
				<code id="atb-new-key-value" style="font-size:14px; user-select:all; display:inline-block; margin:8px 0; padding:4px 8px; background:#fff;"></code>
				<button type="button" class="button button-small" id="atb-copy-key">Copy</button>
			</div>

			<hr />

			<h2>LLM Provider Settings</h2>

			<form method="post" action="options.php">
				<?php settings_fields( 'agent_bricks' ); ?>

				<table class="form-table">
					<tr>
						<th scope="row"><label for="agent_bricks_provider">LLM Provider</label></th>
						<td>
							<select name="<?php echo self::OPTION_KEY; ?>[provider]" id="agent_bricks_provider">
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
						<th scope="row"><label for="agent_bricks_api_key">API Key</label></th>
						<td>
							<input type="password"
								name="<?php echo self::OPTION_KEY; ?>[api_key]"
								id="agent_bricks_api_key"
								value="<?php echo $has_key ? '••••••••' : ''; ?>"
								class="regular-text"
								autocomplete="off" />
							<?php if ( $has_key ) : ?>
								<span class="description" style="color: green;">Key saved</span>
							<?php endif; ?>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="agent_bricks_model">Model</label></th>
						<td>
							<input type="text"
								name="<?php echo self::OPTION_KEY; ?>[model]"
								id="agent_bricks_model"
								value="<?php echo esc_attr( $settings['model'] ); ?>"
								class="regular-text"
								placeholder="Leave empty for provider default" />
							<p class="description" id="agent_bricks_model_suggestions"></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="agent_bricks_base_url">Base URL</label></th>
						<td>
							<input type="url"
								name="<?php echo self::OPTION_KEY; ?>[base_url]"
								id="agent_bricks_base_url"
								value="<?php echo esc_attr( $settings['base_url'] ); ?>"
								class="regular-text"
								placeholder="Auto-filled per provider" />
							<p class="description">Only change for custom providers.</p>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="agent_bricks_temperature">Temperature</label></th>
						<td>
							<input type="range"
								name="<?php echo self::OPTION_KEY; ?>[temperature]"
								id="agent_bricks_temperature"
								min="0" max="1.5" step="0.1"
								value="<?php echo esc_attr( $settings['temperature'] ); ?>" />
							<span id="agent_bricks_temp_value"><?php echo esc_html( $settings['temperature'] ); ?></span>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="agent_bricks_max_tokens">Max Tokens</label></th>
						<td>
							<input type="number"
								name="<?php echo self::OPTION_KEY; ?>[max_tokens]"
								id="agent_bricks_max_tokens"
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
			var providerSelect = document.getElementById('agent_bricks_provider');
			var baseUrlInput = document.getElementById('agent_bricks_base_url');
			var modelInput = document.getElementById('agent_bricks_model');
			var modelSuggestions = document.getElementById('agent_bricks_model_suggestions');
			var tempSlider = document.getElementById('agent_bricks_temperature');
			var tempValue = document.getElementById('agent_bricks_temp_value');

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

		<script>
		(function() {
			var nonce = '<?php echo wp_create_nonce( 'atb_api_key_nonce' ); ?>';
			var ajaxUrl = '<?php echo admin_url( 'admin-ajax.php' ); ?>';

			document.getElementById('atb-generate-key').addEventListener('click', function() {
				var label = document.getElementById('atb-new-key-label').value || 'CLI';
				var data = new FormData();
				data.append('action', 'atb_generate_api_key');
				data.append('nonce', nonce);
				data.append('label', label);

				fetch(ajaxUrl, { method: 'POST', body: data })
					.then(function(r) { return r.json(); })
					.then(function(resp) {
						if (!resp.success) { alert('Error: ' + (resp.data || 'Unknown')); return; }
						document.getElementById('atb-new-key-value').textContent = resp.data.key;
						document.getElementById('atb-new-key-display').style.display = 'block';

						// Add row to table
						var noKeys = document.getElementById('atb-no-keys');
						if (noKeys) noKeys.remove();
						var tbody = document.getElementById('atb-api-keys-list');
						var tr = document.createElement('tr');
						tr.setAttribute('data-prefix', resp.data.prefix);
						tr.innerHTML = '<td>' + label + '</td><td><code>' + resp.data.prefix + '...</code></td><td>Just now</td><td><em>Never</em></td><td><button type="button" class="button button-small atb-revoke-key" data-prefix="' + resp.data.prefix + '">Revoke</button></td>';
						tbody.appendChild(tr);
						bindRevoke(tr.querySelector('.atb-revoke-key'));
						document.getElementById('atb-new-key-label').value = '';
					});
			});

			document.getElementById('atb-copy-key').addEventListener('click', function() {
				var key = document.getElementById('atb-new-key-value').textContent;
				navigator.clipboard.writeText(key).then(function() {
					document.getElementById('atb-copy-key').textContent = 'Copied!';
					setTimeout(function() { document.getElementById('atb-copy-key').textContent = 'Copy'; }, 2000);
				});
			});

			function bindRevoke(btn) {
				btn.addEventListener('click', function() {
					if (!confirm('Revoke this API key?')) return;
					var prefix = this.dataset.prefix;
					var data = new FormData();
					data.append('action', 'atb_revoke_api_key');
					data.append('nonce', nonce);
					data.append('prefix', prefix);

					fetch(ajaxUrl, { method: 'POST', body: data })
						.then(function(r) { return r.json(); })
						.then(function(resp) {
							if (!resp.success) { alert('Error revoking key'); return; }
							var row = document.querySelector('tr[data-prefix="' + prefix + '"]');
							if (row) row.remove();
						});
				});
			}
			document.querySelectorAll('.atb-revoke-key').forEach(bindRevoke);
		})();
		</script>
		<?php
	}
}
