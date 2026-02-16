<?php
/**
 * Plugin Name: Bricks AI Savior
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

define( 'BRICKS_AI_VERSION', '1.0.0' );
define( 'BRICKS_AI_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'BRICKS_AI_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Load classes.
require_once BRICKS_AI_PLUGIN_DIR . 'includes/class-llm-providers.php';
require_once BRICKS_AI_PLUGIN_DIR . 'includes/class-llm-client.php';
require_once BRICKS_AI_PLUGIN_DIR . 'includes/class-element-validator.php';
require_once BRICKS_AI_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once BRICKS_AI_PLUGIN_DIR . 'includes/class-settings.php';

/**
 * Initialize the plugin.
 */
function bricks_ai_init() {
	BricksAI_Settings::init();
	BricksAI_REST_API::init();
}
add_action( 'init', 'bricks_ai_init' );

/**
 * Enqueue panel assets only inside the Bricks editor.
 */
function bricks_ai_enqueue_editor_assets() {
	// Only load when Bricks editor is active (bricks=run in URL).
	if ( ! isset( $_GET['bricks'] ) || $_GET['bricks'] !== 'run' ) {
		return;
	}

	// Verify Bricks is actually active.
	if ( ! defined( 'BRICKS_VERSION' ) ) {
		return;
	}

	$settings   = BricksAI_Settings::get_all();
	$provider   = BricksAI_Providers::get_provider( $settings['provider'] );
	$model      = $settings['model'] ?: ( $provider['default'] ?? '' );

	wp_enqueue_style(
		'bricks-ai-panel',
		BRICKS_AI_PLUGIN_URL . 'assets/css/bricks-ai-panel.css',
		array(),
		BRICKS_AI_VERSION
	);

	wp_enqueue_script(
		'bricks-ai-bridge',
		BRICKS_AI_PLUGIN_URL . 'assets/js/bricks-ai-bridge.js',
		array(),
		BRICKS_AI_VERSION,
		true
	);

	wp_enqueue_script(
		'bricks-ai-panel',
		BRICKS_AI_PLUGIN_URL . 'assets/js/bricks-ai-panel.js',
		array( 'bricks-ai-bridge' ),
		BRICKS_AI_VERSION,
		true
	);

	wp_localize_script( 'bricks-ai-panel', 'bricksAIConfig', array(
		'restUrl'    => rest_url( 'bricks-ai/v1/' ),
		'nonce'      => wp_create_nonce( 'wp_rest' ),
		'provider'   => $settings['provider'],
		'model'      => $model,
		'providerName' => $provider['name'] ?? $settings['provider'],
		'temperature'  => (float) $settings['temperature'],
		'maxTokens'    => (int) $settings['max_tokens'],
	) );
}
add_action( 'wp_enqueue_scripts', 'bricks_ai_enqueue_editor_assets' );

/**
 * Activation hook — set default options.
 */
function bricks_ai_activate() {
	$defaults = array(
		'provider'    => 'cerebras',
		'api_key'     => '',
		'model'       => '',
		'base_url'    => '',
		'temperature' => 0.7,
		'max_tokens'  => 4000,
	);

	if ( ! get_option( 'bricks_ai_settings' ) ) {
		add_option( 'bricks_ai_settings', $defaults );
	}
}
register_activation_hook( __FILE__, 'bricks_ai_activate' );
