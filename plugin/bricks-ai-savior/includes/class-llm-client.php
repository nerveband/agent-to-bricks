<?php
/**
 * Generic OpenAI-compatible LLM client.
 *
 * Works with Cerebras, OpenRouter, and any other OpenAI-compatible endpoint.
 * All providers accept the same payload format.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BricksAI_LLM_Client {

	private $base_url;
	private $api_key;
	private $model;

	public function __construct( $base_url, $api_key, $model ) {
		$this->base_url = rtrim( $base_url, '/' );
		$this->api_key  = $api_key;
		$this->model    = $model;
	}

	/**
	 * Create from current plugin settings.
	 */
	public static function from_settings() {
		$settings = BricksAI_Settings::get_all();
		$resolved = BricksAI_Providers::resolve( $settings );
		$api_key  = BricksAI_Settings::decrypt_key( $settings['api_key'] );

		if ( empty( $api_key ) ) {
			return new WP_Error( 'bricks_ai_no_key', 'No API key configured. Go to Settings > Bricks AI.' );
		}

		if ( empty( $resolved['base_url'] ) ) {
			return new WP_Error( 'bricks_ai_no_url', 'No base URL configured for the selected provider.' );
		}

		return new self( $resolved['base_url'], $api_key, $resolved['model'] );
	}

	/**
	 * Send a chat completion request.
	 *
	 * @param array $messages Array of { role, content } messages.
	 * @param array $options  Optional overrides: temperature, max_tokens, response_format.
	 * @return array|WP_Error Parsed response or error.
	 */
	public function chat_completion( $messages, $options = array() ) {
		$settings = BricksAI_Settings::get_all();

		$body = array(
			'model'       => $this->model,
			'messages'    => $messages,
			'temperature' => $options['temperature'] ?? (float) $settings['temperature'],
			'max_tokens'  => $options['max_tokens'] ?? (int) $settings['max_tokens'],
		);

		// Request structured JSON output.
		if ( isset( $options['response_format'] ) ) {
			$body['response_format'] = $options['response_format'];
		} else {
			$body['response_format'] = array( 'type' => 'json_object' );
		}

		$response = wp_remote_post( $this->base_url . '/chat/completions', array(
			'timeout' => 60,
			'headers' => array(
				'Content-Type'  => 'application/json',
				'Authorization' => 'Bearer ' . $this->api_key,
			),
			'body' => wp_json_encode( $body ),
		) );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code !== 200 ) {
			$error_msg = $data['error']['message'] ?? "HTTP $code from LLM provider";
			return new WP_Error( 'bricks_ai_llm_error', $error_msg, array( 'status' => $code ) );
		}

		if ( empty( $data['choices'][0]['message']['content'] ) ) {
			return new WP_Error( 'bricks_ai_empty_response', 'LLM returned an empty response.' );
		}

		$content = $data['choices'][0]['message']['content'];
		$parsed  = json_decode( $content, true );

		if ( json_last_error() !== JSON_ERROR_NONE ) {
			return new WP_Error( 'bricks_ai_json_parse', 'LLM response was not valid JSON: ' . json_last_error_msg() );
		}

		return array(
			'data'   => $parsed,
			'usage'  => $data['usage'] ?? array(),
			'model'  => $data['model'] ?? $this->model,
		);
	}
}
