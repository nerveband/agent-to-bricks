<?php
/**
 * Plugin Name: Agent to Bricks
 * Description: AI-powered element generation for Bricks Builder with multi-provider LLM support.
 * Version: 1.0.0
 * Author: WaveDepth
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AGENT_BRICKS_VERSION', '1.3.0' );
define( 'AGENT_BRICKS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'AGENT_BRICKS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Load classes.
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-llm-providers.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-llm-client.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-element-validator.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-settings.php';

/**
 * Initialize the plugin.
 */
function agent_bricks_init() {
	ATB_Settings::init();
	ATB_REST_API::init();
}
add_action( 'init', 'agent_bricks_init' );

/**
 * Enqueue panel assets only inside the Bricks editor.
 */
function agent_bricks_enqueue_editor_assets() {
	// Only load when Bricks editor is active (bricks=run in URL).
	if ( ! isset( $_GET['bricks'] ) || $_GET['bricks'] !== 'run' ) {
		return;
	}

	// Verify Bricks is actually active.
	if ( ! defined( 'BRICKS_VERSION' ) ) {
		return;
	}

	$settings   = ATB_Settings::get_all();
	$provider   = ATB_Providers::get_provider( $settings['provider'] );
	$model      = $settings['model'] ?: ( $provider['default'] ?? '' );

	wp_enqueue_style(
		'atb-panel',
		AGENT_BRICKS_PLUGIN_URL . 'assets/css/atb-panel.css',
		array(),
		AGENT_BRICKS_VERSION
	);

	wp_enqueue_script(
		'atb-bridge',
		AGENT_BRICKS_PLUGIN_URL . 'assets/js/atb-bridge.js',
		array(),
		AGENT_BRICKS_VERSION,
		true
	);

	wp_enqueue_script(
		'atb-panel',
		AGENT_BRICKS_PLUGIN_URL . 'assets/js/atb-panel.js',
		array( 'atb-bridge' ),
		AGENT_BRICKS_VERSION,
		true
	);

	// Build providers map for inline switching (exclude API keys).
	$all_providers = ATB_Providers::get_all();
	$providers_safe = array();
	foreach ( $all_providers as $id => $p ) {
		$providers_safe[ $id ] = array(
			'name'   => $p['name'],
			'models' => $p['models'] ?? array(),
		);
	}

	wp_localize_script( 'atb-panel', 'atbConfig', array(
		'restUrl'         => rest_url( 'agent-bricks/v1/' ),
		'nonce'           => wp_create_nonce( 'wp_rest' ),
		'provider'        => $settings['provider'],
		'model'           => $model,
		'providerName'    => $provider['name'] ?? $settings['provider'],
		'temperature'     => (float) $settings['temperature'],
		'maxTokens'       => (int) $settings['max_tokens'],
		'availableModels' => $provider['models'] ?? array(),
		'providers'       => $providers_safe,
	) );
}
add_action( 'wp_enqueue_scripts', 'agent_bricks_enqueue_editor_assets' );

/**
 * Activation hook — set default options.
 */
function agent_bricks_activate() {
	$defaults = array(
		'provider'    => 'cerebras',
		'api_key'     => '',
		'model'       => '',
		'base_url'    => '',
		'temperature' => 0.7,
		'max_tokens'  => 4000,
	);

	if ( ! get_option( 'agent_bricks_settings' ) ) {
		add_option( 'agent_bricks_settings', $defaults );
	}
}
register_activation_hook( __FILE__, 'agent_bricks_activate' );
