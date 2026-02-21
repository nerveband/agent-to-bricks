<?php
/**
 * REST API endpoints for Agent to Bricks.
 *
 * POST /agent-bricks/v1/generate  — Generate new elements
 * POST /agent-bricks/v1/modify    — Modify existing elements
 * GET  /agent-bricks/v1/providers  — List available providers
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once AGENT_BRICKS_PLUGIN_DIR . 'templates/system-prompt.php';

class ATB_REST_API {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		register_rest_route( 'agent-bricks/v1', '/generate', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'handle_generate' ),
			'permission_callback' => array( __CLASS__, 'check_permissions' ),
			'args'                => array(
				'prompt' => array(
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
				),
				'postId' => array(
					'required' => true,
					'type'     => 'integer',
				),
				'mode' => array(
					'type'    => 'string',
					'default' => 'section',
					'enum'    => array( 'section', 'page' ),
				),
				'context' => array(
					'type'    => 'object',
					'default' => array(),
				),
				'model' => array(
					'type'    => 'string',
					'default' => '',
				),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/modify', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'handle_modify' ),
			'permission_callback' => array( __CLASS__, 'check_permissions' ),
			'args'                => array(
				'prompt' => array(
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
				),
				'postId' => array(
					'required' => true,
					'type'     => 'integer',
				),
				'currentElement' => array(
					'required' => true,
					'type'     => 'object',
				),
				'model' => array(
					'type'    => 'string',
					'default' => '',
				),
			),
		) );

		register_rest_route( 'agent-bricks/v1', '/providers', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'handle_providers' ),
			'permission_callback' => array( __CLASS__, 'check_permissions' ),
		) );
	}

	/**
	 * Permission check: user must be able to edit the post.
	 */
	public static function check_permissions( $request ) {
		$post_id = $request->get_param( 'postId' );
		if ( $post_id ) {
			return current_user_can( 'edit_post', $post_id );
		}
		return current_user_can( 'edit_posts' );
	}

	/**
	 * POST /generate — Generate new elements from prompt.
	 */
	public static function handle_generate( $request ) {
		$prompt  = $request->get_param( 'prompt' );
		$mode    = $request->get_param( 'mode' );
		$context = $request->get_param( 'context' ) ?: array();

		// Build client.
		$client = ATB_LLM_Client::from_settings();
		if ( is_wp_error( $client ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $client->get_error_message(),
			), 400 );
		}

		// Build system prompt.
		$system_prompt = ATB_System_Prompt::build( $mode, $context );

		// Call LLM.
		$messages = array(
			array( 'role' => 'system', 'content' => $system_prompt ),
			array( 'role' => 'user', 'content' => $prompt ),
		);

		$settings       = ATB_Settings::get_all();
		$max_tokens     = $mode === 'page' ? max( (int) $settings['max_tokens'], 8000 ) : (int) $settings['max_tokens'];
		$model_override = $request->get_param( 'model' );

		$result = $client->chat_completion( $messages, array(
			'max_tokens' => $max_tokens,
			'model'      => $model_override,
		) );

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $result->get_error_message(),
			), 502 );
		}

		// Validate response.
		$validation = ATB_Element_Validator::validate( $result['data'] );

		if ( ! $validation['valid'] ) {
			return new WP_REST_Response( array(
				'success'  => false,
				'error'    => 'Generated elements failed validation.',
				'details'  => $validation['errors'],
				'warnings' => $validation['warnings'],
				'raw'      => $result['data'],
			), 422 );
		}

		$resolved = ATB_Providers::resolve( $settings );

		return new WP_REST_Response( array(
			'success'     => true,
			'elements'    => $validation['elements'],
			'explanation' => $result['data']['explanation'] ?? '',
			'warnings'    => $validation['warnings'],
			'provider'    => $resolved['name'],
			'model'       => $result['model'],
			'tokens_used' => $result['usage'],
		), 200 );
	}

	/**
	 * POST /modify — Modify existing element(s) based on prompt.
	 */
	public static function handle_modify( $request ) {
		$prompt         = $request->get_param( 'prompt' );
		$current        = $request->get_param( 'currentElement' );
		$context        = $request->get_param( 'context' ) ?: array();

		// Build client.
		$client = ATB_LLM_Client::from_settings();
		if ( is_wp_error( $client ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $client->get_error_message(),
			), 400 );
		}

		// Build system prompt for modify mode.
		$context['currentElement'] = $current;
		$system_prompt = ATB_System_Prompt::build( 'modify', $context );

		$messages = array(
			array( 'role' => 'system', 'content' => $system_prompt ),
			array( 'role' => 'user', 'content' => $prompt ),
		);

		$model_override = $request->get_param( 'model' );

		$result = $client->chat_completion( $messages, array(
			'model' => $model_override,
		) );

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $result->get_error_message(),
			), 502 );
		}

		// Validate.
		$validation = ATB_Element_Validator::validate( $result['data'] );

		if ( ! $validation['valid'] ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => 'Modified elements failed validation.',
				'details' => $validation['errors'],
				'raw'     => $result['data'],
			), 422 );
		}

		$settings = ATB_Settings::get_all();
		$resolved = ATB_Providers::resolve( $settings );

		return new WP_REST_Response( array(
			'success'     => true,
			'elements'    => $validation['elements'],
			'explanation' => $result['data']['explanation'] ?? '',
			'warnings'    => $validation['warnings'],
			'provider'    => $resolved['name'],
			'model'       => $result['model'],
			'tokens_used' => $result['usage'],
		), 200 );
	}

	/**
	 * GET /providers — List available providers (no keys exposed).
	 */
	public static function handle_providers( $request ) {
		$providers = ATB_Providers::get_all();
		$settings  = ATB_Settings::get_all();

		$safe = array();
		foreach ( $providers as $id => $provider ) {
			$safe[ $id ] = array(
				'name'     => $provider['name'],
				'models'   => $provider['models'],
				'default'  => $provider['default'],
				'active'   => $id === $settings['provider'],
				'has_key'  => $id === $settings['provider'] && ! empty( $settings['api_key'] ),
			);
		}

		return new WP_REST_Response( array(
			'providers'      => $safe,
			'activeProvider' => $settings['provider'],
			'activeModel'    => $settings['model'] ?: ( $providers[ $settings['provider'] ]['default'] ?? '' ),
		), 200 );
	}
}
