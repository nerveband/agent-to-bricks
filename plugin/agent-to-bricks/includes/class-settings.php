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
		// Add under Bricks menu if available, otherwise fall back to Settings.
		if ( defined( 'BRICKS_VERSION' ) ) {
			add_submenu_page(
				'bricks',
				'Agent to Bricks',
				'Agent to Bricks',
				'manage_options',
				'agent-bricks-settings',
				array( __CLASS__, 'render_page' )
			);
		} else {
			add_options_page(
				'Agent to Bricks',
				'Agent to Bricks',
				'manage_options',
				'agent-bricks-settings',
				array( __CLASS__, 'render_page' )
			);
		}
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
			'provider'            => 'cerebras',
			'api_key'             => '',
			'model'               => '',
			'base_url'            => '',
			'temperature'         => 0.7,
			'max_tokens'          => 4000,
			'enable_editor_panel' => 0,
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

		$clean['enable_editor_panel'] = ! empty( $input['enable_editor_panel'] ) ? 1 : 0;

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

	private static function encrypt_key( $key ) {
		if ( empty( $key ) ) {
			return '';
		}
		$iv = random_bytes( 16 );
		$encrypted = openssl_encrypt(
			$key,
			'aes-256-cbc',
			wp_salt( 'auth' ),
			OPENSSL_RAW_DATA,
			$iv
		);
		// Prepend IV to ciphertext
		return base64_encode( $iv . $encrypted );
	}

	public static function decrypt_key( $encrypted ) {
		if ( empty( $encrypted ) ) {
			return '';
		}
		$raw = base64_decode( $encrypted );
		if ( strlen( $raw ) <= 16 ) {
			return self::decrypt_legacy( $encrypted );
		}
		$iv         = substr( $raw, 0, 16 );
		$ciphertext = substr( $raw, 16 );
		$decrypted  = openssl_decrypt(
			$ciphertext,
			'aes-256-cbc',
			wp_salt( 'auth' ),
			OPENSSL_RAW_DATA,
			$iv
		);
		if ( $decrypted === false ) {
			// Fallback to legacy decryption for keys encrypted before this update
			return self::decrypt_legacy( $encrypted );
		}
		return $decrypted;
	}

	/**
	 * Legacy decryption using static IV (backward compatibility).
	 */
	private static function decrypt_legacy( $encrypted ) {
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
						<th>Key</th>
						<th>Created</th>
						<th>Last Used</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody id="atb-api-keys-list">
					<?php if ( empty( $api_keys ) ) : ?>
						<tr id="atb-no-keys"><td colspan="5">No API keys yet.</td></tr>
					<?php else : ?>
						<?php foreach ( $api_keys as $k ) : ?>
							<tr data-prefix="<?php echo esc_attr( $k['prefix'] ); ?>">
								<td><?php echo esc_html( $k['label'] ); ?></td>
								<td><code class="atb-key-display"><?php echo esc_html( $k['prefix'] ); ?>...</code></td>
								<td><?php echo esc_html( $k['created'] ); ?></td>
								<td><?php echo $k['last_used'] ? esc_html( $k['last_used'] ) : '<em>Never</em>'; ?></td>
								<td>
									<button type="button" class="button button-small atb-show-key" data-prefix="<?php echo esc_attr( $k['prefix'] ); ?>">Show</button>
									<button type="button" class="button button-small atb-copy-existing-key" data-prefix="<?php echo esc_attr( $k['prefix'] ); ?>" style="display:none;">Copy</button>
									<button type="button" class="button button-small atb-revoke-key" data-prefix="<?php echo esc_attr( $k['prefix'] ); ?>">Revoke</button>
									<button type="button" class="button button-small atb-access-rules" data-prefix="<?php echo esc_attr( $k['prefix'] ); ?>">Access</button>
								</td>
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
				<strong>New API key created!</strong> Copy it now, or use the Show button later to reveal it:<br>
				<code id="atb-new-key-value" style="font-size:14px; user-select:all; display:inline-block; margin:8px 0; padding:4px 8px; background:#fff;"></code>
				<button type="button" class="button button-small" id="atb-copy-key">Copy</button>
			</div>

			<!-- Access Control Rules -->
			<div id="atb-access-control" style="display:none; margin-top:20px; padding:16px; background:#fff; border:1px solid #c3c4c7; border-radius:4px;">
				<h3 style="margin-top:0;">Access Rules for <code id="atb-ac-prefix"></code></h3>
				<table class="form-table">
					<tr>
						<th scope="row">Access Mode</th>
						<td>
							<select id="atb-ac-mode">
								<option value="unrestricted">Unrestricted (full access)</option>
								<option value="allow">Allow List (only specified pages)</option>
								<option value="deny">Deny List (block specified pages)</option>
							</select>
							<p class="description">Controls which pages this API key can read and modify.</p>
						</td>
					</tr>
					<tr id="atb-ac-ids-row" style="display:none;">
						<th scope="row">Page/Post IDs</th>
						<td>
							<input type="text" id="atb-ac-post-ids" class="regular-text" placeholder="e.g. 42, 99, 1338" />
							<p class="description">Comma-separated post/page IDs.</p>
						</td>
					</tr>
					<tr id="atb-ac-types-row" style="display:none;">
						<th scope="row">Post Types</th>
						<td>
							<label><input type="checkbox" class="atb-ac-type" value="page" /> Pages</label>
							<label><input type="checkbox" class="atb-ac-type" value="post" /> Posts</label>
							<label><input type="checkbox" class="atb-ac-type" value="bricks_template" /> Templates</label>
						</td>
					</tr>
				</table>
				<button type="button" class="button button-primary" id="atb-ac-save">Save Access Rules</button>
				<button type="button" class="button" id="atb-ac-cancel">Cancel</button>
			</div>

			<?php if ( defined( 'ATB_ENABLE_LLM_SETTINGS' ) && ATB_ENABLE_LLM_SETTINGS ) : ?>
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

				<h2 class="title" style="margin-top:2em;">Experimental Features</h2>
				<p class="description">These features are in development and may change. Enable at your own discretion.</p>

				<table class="form-table">
					<tr>
						<th scope="row">Bricks Editor Panel</th>
						<td>
							<label>
								<input type="checkbox"
									name="<?php echo self::OPTION_KEY; ?>[enable_editor_panel]"
									value="1"
									<?php checked( $settings['enable_editor_panel'], 1 ); ?> />
								Enable the AI generation panel inside the Bricks editor
							</label>
							<p class="description">
								When enabled, adds a Generate/Modify panel directly in the Bricks visual editor.
								This is an experimental feature — the recommended workflow is using the <code>bricks</code> CLI instead.
							</p>
						</td>
					</tr>
				</table>

				<?php submit_button(); ?>
			</form>
			<?php endif; ?>

			<hr />

			<h2>About</h2>
			<p>
				<strong>Agent to Bricks</strong> v<?php echo esc_html( AGENT_BRICKS_VERSION ); ?><br>
				Created by <a href="https://ashrafali.net" target="_blank">Ashraf Ali</a>
			</p>
			<p>
				This plugin is designed to be paired with the Agent to Bricks CLI for AI-powered Bricks Builder workflows.<br>
				Learn more and get the CLI at <a href="https://github.com/nerveband/agent-to-bricks" target="_blank">github.com/nerveband/agent-to-bricks</a>.
			</p>
		</div>

		<?php if ( defined( 'ATB_ENABLE_LLM_SETTINGS' ) && ATB_ENABLE_LLM_SETTINGS ) : ?>
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
		<?php endif; ?>

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

						var tdLabel = document.createElement('td');
						tdLabel.textContent = label;
						tr.appendChild(tdLabel);

						var tdKey = document.createElement('td');
						var codeEl = document.createElement('code');
						codeEl.className = 'atb-key-display';
						codeEl.textContent = resp.data.prefix + '...';
						tdKey.appendChild(codeEl);
						tr.appendChild(tdKey);

						var tdCreated = document.createElement('td');
						tdCreated.textContent = 'Just now';
						tr.appendChild(tdCreated);

						var tdUsed = document.createElement('td');
						tdUsed.innerHTML = '<em>Never</em>';
						tr.appendChild(tdUsed);

						var tdActions = document.createElement('td');
						var showBtn = document.createElement('button');
						showBtn.type = 'button';
						showBtn.className = 'button button-small atb-show-key';
						showBtn.setAttribute('data-prefix', resp.data.prefix);
						showBtn.textContent = 'Show';
						tdActions.appendChild(showBtn);
						tdActions.appendChild(document.createTextNode(' '));

						var cpBtn = document.createElement('button');
						cpBtn.type = 'button';
						cpBtn.className = 'button button-small atb-copy-existing-key';
						cpBtn.setAttribute('data-prefix', resp.data.prefix);
						cpBtn.style.display = 'none';
						cpBtn.textContent = 'Copy';
						tdActions.appendChild(cpBtn);
						tdActions.appendChild(document.createTextNode(' '));

						var rvBtn = document.createElement('button');
						rvBtn.type = 'button';
						rvBtn.className = 'button button-small atb-revoke-key';
						rvBtn.setAttribute('data-prefix', resp.data.prefix);
						rvBtn.textContent = 'Revoke';
						tdActions.appendChild(rvBtn);
						tdActions.appendChild(document.createTextNode(' '));

						var acBtn = document.createElement('button');
						acBtn.type = 'button';
						acBtn.className = 'button button-small atb-access-rules';
						acBtn.setAttribute('data-prefix', resp.data.prefix);
						acBtn.textContent = 'Access';
						tdActions.appendChild(acBtn);
						tr.appendChild(tdActions);

						tbody.appendChild(tr);
						bindRevoke(tr.querySelector('.atb-revoke-key'));
						bindShow(tr.querySelector('.atb-show-key'));
						bindCopy(tr.querySelector('.atb-copy-existing-key'));
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

			function bindShow(btn) {
				btn.addEventListener('click', function() {
					var prefix = this.dataset.prefix;
					var row = document.querySelector('tr[data-prefix="' + prefix + '"]');
					var codeEl = row.querySelector('.atb-key-display');
					var copyBtn = row.querySelector('.atb-copy-existing-key');
					var showBtn = this;

					if (showBtn.textContent === 'Hide') {
						codeEl.textContent = prefix + '...';
						codeEl.removeAttribute('data-full-key');
						codeEl.style.userSelect = '';
						showBtn.textContent = 'Show';
						copyBtn.style.display = 'none';
						return;
					}

					showBtn.textContent = 'Loading...';
					var data = new FormData();
					data.append('action', 'atb_reveal_api_key');
					data.append('nonce', nonce);
					data.append('prefix', prefix);

					fetch(ajaxUrl, { method: 'POST', body: data })
						.then(function(r) { return r.json(); })
						.then(function(resp) {
							if (!resp.success) {
								alert(resp.data || 'Cannot retrieve key. Revoke and generate a new one.');
								showBtn.textContent = 'Show';
								return;
							}
							codeEl.textContent = resp.data.key;
							codeEl.setAttribute('data-full-key', resp.data.key);
							codeEl.style.userSelect = 'all';
							showBtn.textContent = 'Hide';
							copyBtn.style.display = '';
						});
				});
			}
			document.querySelectorAll('.atb-show-key').forEach(bindShow);

			function bindCopy(btn) {
				btn.addEventListener('click', function() {
					var prefix = this.dataset.prefix;
					var row = document.querySelector('tr[data-prefix="' + prefix + '"]');
					var codeEl = row.querySelector('.atb-key-display');
					var key = codeEl.getAttribute('data-full-key');
					var copyBtn = this;

					if (key) {
						navigator.clipboard.writeText(key).then(function() {
							copyBtn.textContent = 'Copied!';
							setTimeout(function() { copyBtn.textContent = 'Copy'; }, 2000);
						});
					}
				});
			}
			document.querySelectorAll('.atb-copy-existing-key').forEach(bindCopy);

			// Access Control UI
			var acPanel = document.getElementById('atb-access-control');
			var acPrefix = null;

			document.addEventListener('click', function(e) {
				if (e.target.classList.contains('atb-access-rules')) {
					acPrefix = e.target.dataset.prefix;
					document.getElementById('atb-ac-prefix').textContent = acPrefix + '...';
					acPanel.style.display = 'block';

					// Load existing rules
					fetch(ajaxUrl + '?action=atb_get_access_rules&nonce=' + nonce + '&prefix=' + acPrefix)
						.then(function(r) { return r.json(); })
						.then(function(resp) {
							if (!resp.success) return;
							var rules = resp.data;
							document.getElementById('atb-ac-mode').value = rules.mode || 'unrestricted';
							document.getElementById('atb-ac-post-ids').value = (rules.post_ids || []).join(', ');
							document.querySelectorAll('.atb-ac-type').forEach(function(cb) {
								cb.checked = (rules.post_types || []).indexOf(cb.value) >= 0;
							});
							toggleAcFields();
						});
				}
			});

			document.getElementById('atb-ac-mode').addEventListener('change', toggleAcFields);

			function toggleAcFields() {
				var mode = document.getElementById('atb-ac-mode').value;
				var show = mode !== 'unrestricted';
				document.getElementById('atb-ac-ids-row').style.display = show ? '' : 'none';
				document.getElementById('atb-ac-types-row').style.display = show ? '' : 'none';
			}

			document.getElementById('atb-ac-save').addEventListener('click', function() {
				var types = [];
				document.querySelectorAll('.atb-ac-type:checked').forEach(function(cb) { types.push(cb.value); });

				var data = new FormData();
				data.append('action', 'atb_save_access_rules');
				data.append('nonce', nonce);
				data.append('prefix', acPrefix);
				data.append('mode', document.getElementById('atb-ac-mode').value);
				data.append('post_ids', document.getElementById('atb-ac-post-ids').value);
				data.append('post_types', types.join(','));

				fetch(ajaxUrl, { method: 'POST', body: data })
					.then(function(r) { return r.json(); })
					.then(function(resp) {
						if (resp.success) {
							acPanel.style.display = 'none';
							alert('Access rules saved.');
						} else {
							alert('Error: ' + (resp.data || 'Unknown'));
						}
					});
			});

			document.getElementById('atb-ac-cancel').addEventListener('click', function() {
				acPanel.style.display = 'none';
			});
		})();
		</script>
		<?php
	}
}
