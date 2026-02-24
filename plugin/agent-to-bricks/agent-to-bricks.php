<?php
/**
 * Plugin Name: Agent to Bricks
 * Description: AI-powered element generation for Bricks Builder with multi-provider LLM support.
 * Version: 1.0.0
 * Author: WaveDepth
 * Requires at least: 6.0
 * Requires PHP: 8.0
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
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-api-auth.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-bricks-lifecycle.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-elements-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-snapshots-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-classes-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-styles-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-site-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-templates-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-media-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-update-api.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-update-checker.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-search-api.php';

/**
 * Add X-ATB-Version header to all plugin REST responses.
 */
function agent_bricks_add_version_header( $response, $server, $request ) {
	$route = $request->get_route();
	if ( strpos( $route, '/agent-bricks/' ) === 0 ) {
		$response->header( 'X-ATB-Version', AGENT_BRICKS_VERSION );
	}
	return $response;
}

/**
 * Initialize the plugin.
 */
function agent_bricks_init() {
	add_filter( 'rest_post_dispatch', 'agent_bricks_add_version_header', 10, 3 );
	ATB_API_Auth::init();
	ATB_Settings::init();
	ATB_REST_API::init();
	ATB_Elements_API::init();
	ATB_Snapshots_API::init();
	ATB_Classes_API::init();
	ATB_Styles_API::init();
	ATB_Site_API::init();
	ATB_Templates_API::init();
	ATB_Media_API::init();
	ATB_Update_API::init();
	ATB_Update_Checker::init();
	ATB_Search_API::init();
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

	// Check if editor panel is enabled (disabled by default — experimental).
	$settings_check = ATB_Settings::get_all();
	if ( empty( $settings_check['enable_editor_panel'] ) ) {
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
		'provider'            => 'cerebras',
		'api_key'             => '',
		'model'               => '',
		'base_url'            => '',
		'temperature'         => 0.7,
		'max_tokens'          => 4000,
		'enable_editor_panel' => 0,
	);

	if ( ! get_option( 'agent_bricks_settings' ) ) {
		add_option( 'agent_bricks_settings', $defaults );
	}
}
register_activation_hook( __FILE__, 'agent_bricks_activate' );
