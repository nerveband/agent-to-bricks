<?php
/**
 * LLM Provider registry.
 *
 * Pre-configured providers that all use the OpenAI-compatible chat completions API.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BricksAI_Providers {

	private static $providers = array(
		'cerebras' => array(
			'name'                => 'Cerebras',
			'base_url'            => 'https://api.cerebras.ai/v1',
			'models'              => array( 'llama-3.3-70b', 'llama3.1-8b', 'qwen-3-32b' ),
			'default'             => 'llama-3.3-70b',
			'supports_structured' => true,
		),
		'openrouter' => array(
			'name'                => 'OpenRouter',
			'base_url'            => 'https://openrouter.ai/api/v1',
			'models'              => array( 'anthropic/claude-sonnet-4-5-20250929', 'openai/gpt-4o', 'google/gemini-2.5-flash' ),
			'default'             => 'anthropic/claude-sonnet-4-5-20250929',
			'supports_structured' => true,
		),
		'custom' => array(
			'name'                => 'Custom (OpenAI-compatible)',
			'base_url'            => '',
			'models'              => array(),
			'default'             => '',
			'supports_structured' => true,
		),
	);

	/**
	 * Get all providers.
	 */
	public static function get_all() {
		return self::$providers;
	}

	/**
	 * Get a single provider config by ID.
	 */
	public static function get_provider( $id ) {
		return self::$providers[ $id ] ?? self::$providers['custom'];
	}

	/**
	 * Resolve the effective base URL and model for current settings.
	 */
	public static function resolve( $settings ) {
		$provider = self::get_provider( $settings['provider'] );
		$base_url = ! empty( $settings['base_url'] ) ? $settings['base_url'] : $provider['base_url'];
		$model    = ! empty( $settings['model'] ) ? $settings['model'] : $provider['default'];

		return array(
			'base_url' => rtrim( $base_url, '/' ),
			'model'    => $model,
			'name'     => $provider['name'],
		);
	}
}
