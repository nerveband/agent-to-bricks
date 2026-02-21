<?php
/**
 * Global Classes CRUD REST API endpoints.
 *
 * Reads/writes Bricks global classes from wp_options (bricks_global_classes).
 * Tags ACSS-imported classes with framework='acss'.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Classes_API {

	const OPTION_KEY = 'bricks_global_classes';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		// GET + POST /classes
		register_rest_route( 'agent-bricks/v1', '/classes', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'list_classes' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_class' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
		) );

		// GET + PATCH + DELETE /classes/{id}
		register_rest_route( 'agent-bricks/v1', '/classes/(?P<id>[a-zA-Z0-9_-]+)', array(
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_class' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => 'PATCH',
				'callback'            => array( __CLASS__, 'update_class' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => 'DELETE',
				'callback'            => array( __CLASS__, 'delete_class' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
		) );
	}

	public static function check_permission() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * List all global classes with framework tagging.
	 */
	public static function list_classes( $request ) {
		$classes  = self::get_all_classes();
		$framework_filter = $request->get_param( 'framework' );

		$result = array();
		foreach ( $classes as $class ) {
			$tagged = self::tag_class( $class );
			if ( $framework_filter && $tagged['framework'] !== $framework_filter ) {
				continue;
			}
			$result[] = $tagged;
		}

		return new WP_REST_Response( array(
			'classes' => $result,
			'count'   => count( $result ),
			'total'   => count( $classes ),
		), 200 );
	}

	/**
	 * Get a single class by ID.
	 */
	public static function get_class( $request ) {
		$class_id = sanitize_text_field( $request->get_param( 'id' ) );
		$classes  = self::get_all_classes();

		foreach ( $classes as $class ) {
			if ( $class['id'] === $class_id ) {
				return new WP_REST_Response( self::tag_class( $class ), 200 );
			}
		}

		return new WP_REST_Response( array( 'error' => 'Class not found.' ), 404 );
	}

	/**
	 * Create a new global class.
	 */
	public static function create_class( $request ) {
		$body = $request->get_json_params();
		$name = sanitize_text_field( $body['name'] ?? '' );

		if ( empty( $name ) ) {
			return new WP_REST_Response( array( 'error' => 'Class name required.' ), 400 );
		}

		$classes = self::get_all_classes();

		// Check for duplicate name
		foreach ( $classes as $c ) {
			if ( $c['name'] === $name ) {
				return new WP_REST_Response( array(
					'error' => "Class '$name' already exists.",
					'existingId' => $c['id'],
				), 409 );
			}
		}

		$new_class = array(
			'id'       => self::generate_id(),
			'name'     => $name,
			'settings' => $body['settings'] ?? array(),
			'modified' => time(),
			'user_id'  => get_current_user_id(),
		);

		if ( ! empty( $body['label'] ) ) {
			$new_class['label'] = sanitize_text_field( $body['label'] );
		}

		$classes[] = $new_class;
		update_option( self::OPTION_KEY, $classes, false );

		return new WP_REST_Response( self::tag_class( $new_class ), 201 );
	}

	/**
	 * Update an existing global class.
	 */
	public static function update_class( $request ) {
		$class_id = sanitize_text_field( $request->get_param( 'id' ) );
		$body     = $request->get_json_params();
		$classes  = self::get_all_classes();
		$found    = false;

		foreach ( $classes as &$class ) {
			if ( $class['id'] === $class_id ) {
				// Don't allow modifying ACSS-imported classes
				if ( self::is_acss_class( $class ) ) {
					return new WP_REST_Response( array(
						'error' => 'Cannot modify ACSS-imported class.',
					), 403 );
				}

				if ( isset( $body['name'] ) ) {
					$class['name'] = sanitize_text_field( $body['name'] );
				}
				if ( isset( $body['settings'] ) ) {
					$class['settings'] = $body['settings'];
				}
				if ( isset( $body['label'] ) ) {
					$class['label'] = sanitize_text_field( $body['label'] );
				}
				$class['modified'] = time();
				$class['user_id']  = get_current_user_id();
				$found = true;
				break;
			}
		}
		unset( $class );

		if ( ! $found ) {
			return new WP_REST_Response( array( 'error' => 'Class not found.' ), 404 );
		}

		update_option( self::OPTION_KEY, $classes, false );

		foreach ( $classes as $c ) {
			if ( $c['id'] === $class_id ) {
				return new WP_REST_Response( self::tag_class( $c ), 200 );
			}
		}
	}

	/**
	 * Delete a global class.
	 */
	public static function delete_class( $request ) {
		$class_id = sanitize_text_field( $request->get_param( 'id' ) );
		$classes  = self::get_all_classes();

		// Find the class first to check if it's ACSS
		foreach ( $classes as $c ) {
			if ( $c['id'] === $class_id && self::is_acss_class( $c ) ) {
				return new WP_REST_Response( array(
					'error' => 'Cannot delete ACSS-imported class.',
				), 403 );
			}
		}

		$new_classes = array_values( array_filter( $classes, function( $c ) use ( $class_id ) {
			return $c['id'] !== $class_id;
		} ) );

		if ( count( $new_classes ) === count( $classes ) ) {
			return new WP_REST_Response( array( 'error' => 'Class not found.' ), 404 );
		}

		update_option( self::OPTION_KEY, $new_classes, false );

		return new WP_REST_Response( array(
			'success' => true,
			'deleted' => $class_id,
		), 200 );
	}

	/**
	 * Tag a class with framework metadata.
	 */
	private static function tag_class( $class ) {
		$class['framework'] = self::is_acss_class( $class ) ? 'acss' : 'custom';
		return $class;
	}

	/**
	 * Check if a class is ACSS-imported.
	 */
	private static function is_acss_class( $class ) {
		return strpos( $class['id'] ?? '', 'acss_import_' ) === 0;
	}

	/**
	 * Get all global classes.
	 */
	private static function get_all_classes() {
		$classes = get_option( self::OPTION_KEY, array() );
		return is_array( $classes ) ? $classes : array();
	}

	/**
	 * Generate a unique 6-char ID (Bricks format).
	 */
	private static function generate_id() {
		$chars = 'abcdefghijklmnopqrstuvwxyz';
		$id = '';
		for ( $i = 0; $i < 6; $i++ ) {
			$id .= $chars[ wp_rand( 0, strlen( $chars ) - 1 ) ];
		}
		return $id;
	}
}
