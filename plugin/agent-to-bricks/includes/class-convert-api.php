<?php
/**
 * HTML-to-Bricks conversion REST API endpoint.
 *
 * POST /agent-bricks/v1/convert  — Convert HTML/CSS to Bricks elements
 *
 * Accepts raw HTML (and optional CSS) and returns validated Bricks elements
 * ready for insertion into a page. Optionally pushes directly to a page.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATB_Convert_API {

	/**
	 * HTML tag to Bricks element type mapping.
	 * Matches the Go CLI converter in cli/internal/convert/html.go.
	 */
	private static $tag_map = array(
		'section'    => 'section',
		'div'        => 'div',
		'header'     => 'section',
		'footer'     => 'section',
		'main'       => 'section',
		'article'    => 'section',
		'aside'      => 'div',
		'nav'        => 'div',
		'h1'         => 'heading',
		'h2'         => 'heading',
		'h3'         => 'heading',
		'h4'         => 'heading',
		'h5'         => 'heading',
		'h6'         => 'heading',
		'p'          => 'text-basic',
		'span'       => 'text-basic',
		'a'          => 'text-link',
		'button'     => 'button',
		'img'        => 'image',
		'video'      => 'video',
		'ul'         => 'list',
		'ol'         => 'list',
		'form'       => 'form',
		'code'       => 'code',
		'pre'        => 'code',
		'blockquote' => 'text-basic',
		'figure'     => 'div',
		'figcaption' => 'text-basic',
		'hr'         => 'divider',
		'li'         => 'div',
		'table'      => 'code',
		'svg'        => 'code',
	);

	/**
	 * CSS property to Bricks setting mapping.
	 * Matches the Go CLI converter in cli/internal/convert/styles.go.
	 */
	private static $css_map = array(
		'color'                  => array( '_typography', 'color' ),
		'font-size'              => array( '_typography', 'font-size' ),
		'font-weight'            => array( '_typography', 'font-weight' ),
		'font-family'            => array( '_typography', 'font-family' ),
		'text-align'             => array( '_typography', 'text-align' ),
		'line-height'            => array( '_typography', 'line-height' ),
		'letter-spacing'         => array( '_typography', 'letter-spacing' ),
		'font-style'             => array( '_typography', 'font-style' ),
		'text-transform'         => array( '_typography', 'text-transform' ),
		'text-decoration'        => array( '_typography', 'text-decoration' ),
		'background-color'       => '_background_color',
		'background'             => '_background_color',
		'display'                => '_display',
		'flex-direction'         => '_direction',
		'justify-content'        => '_justifyContent',
		'align-items'            => '_alignItems',
		'flex-wrap'              => '_flexWrap',
		'gap'                    => '_gap',
		'row-gap'                => '_rowGap',
		'column-gap'             => '_columnGap',
		'grid-template-columns'  => '_gridTemplateColumns',
		'grid-template-rows'     => '_gridTemplateRows',
		'width'                  => '_width',
		'max-width'              => '_maxWidth',
		'min-width'              => '_minWidth',
		'height'                 => '_height',
		'max-height'             => '_maxHeight',
		'min-height'             => '_minHeight',
		'border-radius'          => '_borderRadius',
		'overflow'               => '_overflow',
		'position'               => '_position',
		'z-index'                => '_zIndex',
		'opacity'                => '_opacity',
		'top'                    => '_top',
		'right'                  => '_right',
		'bottom'                 => '_bottom',
		'left'                   => '_left',
	);

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		register_rest_route( 'agent-bricks/v1', '/convert', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'handle_convert' ),
			'permission_callback' => array( __CLASS__, 'check_permissions' ),
			'args'                => array(
				'html' => array(
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => function( $value ) {
						// Allow HTML through — we parse it, not render it.
						return $value;
					},
				),
				'css' => array(
					'type'    => 'string',
					'default' => '',
				),
				'postId' => array(
					'type' => 'integer',
				),
				'mode' => array(
					'type'    => 'string',
					'default' => 'return',
					'enum'    => array( 'return', 'append', 'replace' ),
				),
				'createGlobalClasses' => array(
					'type'    => 'boolean',
					'default' => false,
				),
			),
		) );
	}

	public static function check_permissions( $request ) {
		$post_id = $request->get_param( 'postId' );
		if ( $post_id ) {
			if ( ! current_user_can( 'edit_post', $post_id ) ) {
				return false;
			}
			if ( class_exists( 'ATB_Access_Control' ) ) {
				$access = ATB_Access_Control::can_access_post( (int) $post_id );
				if ( is_wp_error( $access ) ) {
					return $access;
				}
			}
			return true;
		}
		return current_user_can( 'edit_posts' );
	}

	/**
	 * POST /convert — Convert HTML/CSS to Bricks elements.
	 */
	public static function handle_convert( $request ) {
		$html_input = $request->get_param( 'html' );
		$css_input  = $request->get_param( 'css' ) ?: '';
		$post_id    = $request->get_param( 'postId' );
		$mode       = $request->get_param( 'mode' );

		// Parse HTML to Bricks elements.
		$result = self::convert_html( $html_input, $css_input );

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response( array(
				'success' => false,
				'error'   => $result->get_error_message(),
			), 400 );
		}

		$elements = $result['elements'];
		$stats    = $result['stats'];
		$warnings = $result['warnings'];

		// Resolve class names against global classes registry.
		$elements = self::resolve_classes( $elements );

		// Push to page if requested.
		if ( $post_id && $mode !== 'return' ) {
			if ( ! get_post( $post_id ) ) {
				return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
			}

			if ( $mode === 'replace' ) {
				// Snapshot before replace.
				if ( class_exists( 'ATB_Snapshots_API' ) ) {
					ATB_Snapshots_API::take_snapshot( $post_id, 'Auto: before HTML convert replace' );
				}
				$write_result = ATB_Bricks_Lifecycle::write_elements( $post_id, $elements );
			} else {
				// Append mode.
				$current = ATB_Bricks_Lifecycle::read_elements( $post_id );
				$merged  = array_merge( $current['elements'], $elements );
				$write_result = ATB_Bricks_Lifecycle::write_elements( $post_id, $merged, $current['contentHash'] );
			}

			if ( is_wp_error( $write_result ) ) {
				return new WP_REST_Response( array(
					'success'  => false,
					'error'    => $write_result->get_error_message(),
					'elements' => $elements,
				), 409 );
			}

			$stats['pushed']      = true;
			$stats['postId']      = $post_id;
			$stats['mode']        = $mode;
			$stats['contentHash'] = $write_result;
		}

		return new WP_REST_Response( array(
			'success'  => true,
			'elements' => $elements,
			'stats'    => $stats,
			'warnings' => $warnings,
		), 200 );
	}

	/**
	 * Convert HTML string to flat Bricks element array.
	 *
	 * @param string $html Raw HTML.
	 * @param string $css  Optional CSS string (for future use).
	 * @return array|WP_Error { elements: array, stats: array, warnings: array }
	 */
	public static function convert_html( $html, $css = '' ) {
		$html = trim( $html );
		if ( empty( $html ) ) {
			return new WP_Error( 'empty_html', 'No HTML input provided.' );
		}

		// Suppress DOMDocument warnings for malformed HTML.
		$prev = libxml_use_internal_errors( true );

		$doc = new DOMDocument( '1.0', 'UTF-8' );
		// Wrap in UTF-8 meta to handle encoding correctly.
		$wrapped = '<html><head><meta charset="UTF-8"></head><body>' . $html . '</body></html>';
		$doc->loadHTML( $wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR );

		libxml_clear_errors();
		libxml_use_internal_errors( $prev );

		// Find body.
		$body = $doc->getElementsByTagName( 'body' )->item( 0 );
		if ( ! $body ) {
			return new WP_Error( 'parse_failed', 'Could not parse HTML body.' );
		}

		$elements  = array();
		$warnings  = array();
		$used_ids  = array();
		$stats     = array(
			'htmlTags'       => 0,
			'bricksElements' => 0,
			'skippedTags'    => 0,
			'stylesExtracted' => 0,
		);

		self::process_node( $body, '0', $elements, $used_ids, $warnings, $stats );

		// Rebuild children arrays from parent references.
		$id_to_children = array();
		foreach ( $elements as $el ) {
			$parent = $el['parent'] ?? '0';
			$id     = $el['id'] ?? '';
			if ( $id ) {
				$id_to_children[ $parent ][] = $id;
			}
		}
		foreach ( $elements as &$el ) {
			$id = $el['id'] ?? '';
			$el['children'] = $id_to_children[ $id ] ?? array();
		}
		unset( $el );

		$stats['bricksElements'] = count( $elements );

		return array(
			'elements' => $elements,
			'stats'    => $stats,
			'warnings' => $warnings,
		);
	}

	/**
	 * Recursively process a DOM node into Bricks elements.
	 */
	private static function process_node( $node, $parent_id, &$elements, &$used_ids, &$warnings, &$stats ) {
		foreach ( $node->childNodes as $child ) {
			if ( $child->nodeType !== XML_ELEMENT_NODE ) {
				continue;
			}

			$tag = strtolower( $child->tagName );

			// Skip script/style/meta/link tags.
			if ( in_array( $tag, array( 'script', 'style', 'meta', 'link', 'head', 'html', 'body', 'br' ), true ) ) {
				continue;
			}

			$stats['htmlTags']++;

			$bricks_name = self::$tag_map[ $tag ] ?? null;
			if ( ! $bricks_name ) {
				$stats['skippedTags']++;
				$warnings[] = "Skipped unknown tag: <{$tag}>";
				// Process children anyway.
				self::process_node( $child, $parent_id, $elements, $used_ids, $warnings, $stats );
				continue;
			}

			$id = self::generate_id( $used_ids );

			$el = array(
				'id'       => $id,
				'name'     => $bricks_name,
				'parent'   => $parent_id,
				'children' => array(), // rebuilt later
				'settings' => array(),
			);

			// Add label.
			$el['label'] = self::generate_label( $tag, $bricks_name, $child );

			// Extract settings.
			$settings = self::extract_settings( $child, $bricks_name, $tag );
			if ( ! empty( $settings ) ) {
				$el['settings'] = $settings;
			}

			$elements[] = $el;

			// Recurse into children.
			self::process_node( $child, $id, $elements, $used_ids, $warnings, $stats );
		}
	}

	/**
	 * Extract Bricks settings from a DOM element.
	 */
	private static function extract_settings( $node, $bricks_name, $tag ) {
		$settings = array();

		// Text content for text elements.
		if ( in_array( $bricks_name, array( 'heading', 'text-basic', 'button', 'text-link' ), true ) ) {
			$text = self::extract_text( $node );
			if ( $text !== '' ) {
				$settings['text'] = $text;
			}
		}

		// Preserve heading tag.
		if ( $bricks_name === 'heading' ) {
			$settings['tag'] = $tag;
		}

		// Process attributes.
		if ( $node->hasAttributes() ) {
			foreach ( $node->attributes as $attr ) {
				$key = $attr->name;
				$val = $attr->value;

				switch ( $key ) {
					case 'class':
						$classes = preg_split( '/\s+/', trim( $val ), -1, PREG_SPLIT_NO_EMPTY );
						if ( ! empty( $classes ) ) {
							$settings['_cssClasses'] = implode( ' ', $classes );
						}
						break;

					case 'id':
						$settings['_cssId'] = sanitize_text_field( $val );
						break;

					case 'href':
						if ( in_array( $bricks_name, array( 'text-link', 'button' ), true ) ) {
							$settings['link'] = array(
								'type'   => 'external',
								'url'    => esc_url_raw( $val ),
								'newTab' => false,
							);
						}
						break;

					case 'src':
						if ( $bricks_name === 'image' ) {
							$settings['image'] = array( 'url' => esc_url_raw( $val ) );
						} elseif ( $bricks_name === 'video' ) {
							$settings['videoUrl'] = esc_url_raw( $val );
						}
						break;

					case 'alt':
						if ( $bricks_name === 'image' && isset( $settings['image'] ) ) {
							$settings['image']['alt'] = sanitize_text_field( $val );
						}
						break;

					case 'style':
						$style_settings = self::parse_inline_styles( $val );
						$settings = array_merge( $settings, $style_settings );
						break;

					default:
						// Capture data-* attributes.
						if ( strpos( $key, 'data-' ) === 0 ) {
							if ( ! isset( $settings['_attributes'] ) ) {
								$settings['_attributes'] = array();
							}
							$settings['_attributes'][] = array(
								'name'  => sanitize_text_field( $key ),
								'value' => sanitize_text_field( $val ),
							);
						}
						break;
				}
			}
		}

		return $settings;
	}

	/**
	 * Parse inline CSS style string to Bricks settings.
	 * Mirrors the Go implementation in cli/internal/convert/styles.go.
	 */
	private static function parse_inline_styles( $style ) {
		$settings = array();
		$pairs = self::split_css_declarations( $style );

		foreach ( $pairs as $pair ) {
			$parts = explode( ':', $pair, 2 );
			if ( count( $parts ) !== 2 ) continue;

			$prop = trim( $parts[0] );
			$val  = trim( $parts[1] );

			// Typography properties.
			if ( isset( self::$css_map[ $prop ] ) ) {
				$mapping = self::$css_map[ $prop ];

				if ( is_array( $mapping ) ) {
					// Nested property: e.g. ['_typography', 'font-size']
					$parent_key = $mapping[0];
					$child_key  = $mapping[1];
					if ( ! isset( $settings[ $parent_key ] ) ) {
						$settings[ $parent_key ] = array();
					}
					if ( $child_key === 'color' ) {
						$settings[ $parent_key ][ $child_key ] = array( 'raw' => $val );
					} else {
						$settings[ $parent_key ][ $child_key ] = $val;
					}
				} elseif ( $mapping === '_background_color' ) {
					$settings['_background'] = array(
						'color' => array( 'raw' => $val ),
					);
				} else {
					$settings[ $mapping ] = $val;
				}
			} elseif ( $prop === 'padding' ) {
				$settings['_padding'] = self::expand_box_shorthand( $val );
			} elseif ( strpos( $prop, 'padding-' ) === 0 ) {
				$side = str_replace( 'padding-', '', $prop );
				if ( ! isset( $settings['_padding'] ) ) {
					$settings['_padding'] = array();
				}
				$settings['_padding'][ $side ] = $val;
			} elseif ( $prop === 'margin' ) {
				$settings['_margin'] = self::expand_box_shorthand( $val );
			} elseif ( strpos( $prop, 'margin-' ) === 0 ) {
				$side = str_replace( 'margin-', '', $prop );
				if ( ! isset( $settings['_margin'] ) ) {
					$settings['_margin'] = array();
				}
				$settings['_margin'][ $side ] = $val;
			} elseif ( strpos( $prop, 'border-' ) === 0 && $prop !== 'border-radius' ) {
				$sub = str_replace( 'border-', '', $prop );
				if ( ! isset( $settings['_border'] ) ) {
					$settings['_border'] = array();
				}
				if ( $sub === 'color' ) {
					$settings['_border'][ $sub ] = array( 'raw' => $val );
				} else {
					$settings['_border'][ $sub ] = $val;
				}
			}
		}

		return $settings;
	}

	/**
	 * Split CSS declarations handling parentheses and quotes.
	 */
	private static function split_css_declarations( $style ) {
		$declarations = array();
		$current      = '';
		$paren_depth  = 0;
		$quote        = '';
		$escape       = false;

		for ( $i = 0; $i < strlen( $style ); $i++ ) {
			$ch = $style[ $i ];

			if ( $quote !== '' ) {
				$current .= $ch;
				if ( $escape ) {
					$escape = false;
					continue;
				}
				if ( $ch === '\\' ) {
					$escape = true;
					continue;
				}
				if ( $ch === $quote ) {
					$quote = '';
				}
				continue;
			}

			if ( $ch === '\'' || $ch === '"' ) {
				$quote = $ch;
				$current .= $ch;
			} elseif ( $ch === '(' ) {
				$paren_depth++;
				$current .= $ch;
			} elseif ( $ch === ')' && $paren_depth > 0 ) {
				$paren_depth--;
				$current .= $ch;
			} elseif ( $ch === ';' && $paren_depth === 0 ) {
				$decl = trim( $current );
				if ( $decl !== '' ) {
					$declarations[] = $decl;
				}
				$current = '';
			} else {
				$current .= $ch;
			}
		}

		$decl = trim( $current );
		if ( $decl !== '' ) {
			$declarations[] = $decl;
		}

		return $declarations;
	}

	/**
	 * Expand CSS box shorthand (margin, padding) to top/right/bottom/left.
	 */
	private static function expand_box_shorthand( $val ) {
		$parts = preg_split( '/\s+/', trim( $val ) );
		switch ( count( $parts ) ) {
			case 1:
				return array( 'top' => $parts[0], 'right' => $parts[0], 'bottom' => $parts[0], 'left' => $parts[0] );
			case 2:
				return array( 'top' => $parts[0], 'right' => $parts[1], 'bottom' => $parts[0], 'left' => $parts[1] );
			case 3:
				return array( 'top' => $parts[0], 'right' => $parts[1], 'bottom' => $parts[2], 'left' => $parts[1] );
			case 4:
				return array( 'top' => $parts[0], 'right' => $parts[1], 'bottom' => $parts[2], 'left' => $parts[3] );
			default:
				return array( 'top' => $val, 'right' => $val, 'bottom' => $val, 'left' => $val );
		}
	}

	/**
	 * Extract direct text content from a node (not children's text).
	 */
	private static function extract_text( $node ) {
		$text = '';
		foreach ( $node->childNodes as $child ) {
			if ( $child->nodeType === XML_TEXT_NODE ) {
				$text .= $child->textContent;
			}
		}
		return trim( $text );
	}

	/**
	 * Generate a meaningful label for the Bricks structure panel.
	 */
	private static function generate_label( $tag, $bricks_name, $node ) {
		// Try to use class name for label.
		$class = $node->getAttribute( 'class' );
		if ( $class ) {
			$first_class = explode( ' ', trim( $class ) )[0];
			if ( $first_class ) {
				return ucfirst( str_replace( array( '-', '_' ), ' ', $first_class ) );
			}
		}

		// Try to use ID.
		$id = $node->getAttribute( 'id' );
		if ( $id ) {
			return ucfirst( str_replace( array( '-', '_' ), ' ', $id ) );
		}

		// Fall back to tag name.
		return ucfirst( $tag );
	}

	/**
	 * Generate a unique 6-character hex ID.
	 */
	private static function generate_id( &$used ) {
		do {
			$id = bin2hex( random_bytes( 3 ) );
		} while ( isset( $used[ $id ] ) );
		$used[ $id ] = true;
		return $id;
	}

	/**
	 * Resolve CSS class names against Bricks global classes.
	 * Moves matched classes from _cssClasses to _cssGlobalClasses.
	 */
	private static function resolve_classes( $elements ) {
		if ( ! class_exists( 'ATB_Classes_API' ) ) {
			return $elements;
		}

		// Build a name→id map of all global classes.
		$global_classes = get_option( 'bricks_global_classes', array() );
		if ( ! is_array( $global_classes ) || empty( $global_classes ) ) {
			return $elements;
		}

		$class_map = array();
		foreach ( $global_classes as $gc ) {
			$name = $gc['name'] ?? '';
			$id   = $gc['id'] ?? '';
			if ( $name && $id ) {
				$class_map[ $name ] = $id;
			}
		}

		if ( empty( $class_map ) ) {
			return $elements;
		}

		// Resolve classes in each element.
		foreach ( $elements as &$el ) {
			$css_classes = $el['settings']['_cssClasses'] ?? '';
			if ( empty( $css_classes ) ) {
				continue;
			}

			$classes    = preg_split( '/\s+/', trim( $css_classes ), -1, PREG_SPLIT_NO_EMPTY );
			$global_ids = array();
			$remaining  = array();

			foreach ( $classes as $cls ) {
				if ( isset( $class_map[ $cls ] ) ) {
					$global_ids[] = $class_map[ $cls ];
				} else {
					$remaining[] = $cls;
				}
			}

			if ( ! empty( $global_ids ) ) {
				$el['settings']['_cssGlobalClasses'] = $global_ids;
			}

			if ( ! empty( $remaining ) ) {
				$el['settings']['_cssClasses'] = implode( ' ', $remaining );
			} else {
				unset( $el['settings']['_cssClasses'] );
			}
		}
		unset( $el );

		return $elements;
	}
}
