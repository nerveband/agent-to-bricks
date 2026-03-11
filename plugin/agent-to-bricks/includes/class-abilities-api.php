<?php
/**
 * WordPress Abilities API integration (WP 6.9+).
 *
 * Registers all ATB operations as discoverable abilities so third-party
 * AI agents can find and execute them via the standard Abilities REST API.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ATB_Abilities_API {

    /**
     * Initialize abilities registration if WP supports it.
     */
    public static function init() {
        // Only register if the Abilities API exists (WP 6.9+).
        if ( ! function_exists( 'wp_register_ability_category' ) ) {
            return;
        }

        add_action( 'wp_abilities_api_categories_init', array( __CLASS__, 'register_categories' ) );
        add_action( 'wp_abilities_api_init', array( __CLASS__, 'register_abilities' ) );
    }

    /**
     * Register ability categories.
     */
    public static function register_categories() {
        wp_register_ability_category( 'agent-bricks-pages', array(
            'label'       => __( 'Bricks Page Management', 'agent-to-bricks' ),
            'description' => __( 'Read, write, and manage Bricks Builder page elements.', 'agent-to-bricks' ),
        ) );

        wp_register_ability_category( 'agent-bricks-design', array(
            'label'       => __( 'Bricks Design System', 'agent-to-bricks' ),
            'description' => __( 'Access global classes, styles, design tokens, and CSS variables.', 'agent-to-bricks' ),
        ) );

        wp_register_ability_category( 'agent-bricks-content', array(
            'label'       => __( 'Bricks Content', 'agent-to-bricks' ),
            'description' => __( 'Manage templates, components, and media assets.', 'agent-to-bricks' ),
        ) );

        wp_register_ability_category( 'agent-bricks-site', array(
            'label'       => __( 'Bricks Site Info', 'agent-to-bricks' ),
            'description' => __( 'Site configuration, versions, frameworks, and element types.', 'agent-to-bricks' ),
        ) );

        wp_register_ability_category( 'agent-bricks-commerce', array(
            'label'       => __( 'Bricks Commerce', 'agent-to-bricks' ),
            'description' => __( 'WooCommerce discovery, query-aware content, and commerce metadata.', 'agent-to-bricks' ),
        ) );
    }

    /**
     * Register all abilities.
     */
    public static function register_abilities() {
        self::register_site_abilities();
        self::register_commerce_abilities();
        self::register_page_abilities();
        self::register_snapshot_abilities();
        self::register_class_abilities();
        self::register_style_abilities();
        self::register_content_abilities();
        self::register_search_abilities();
    }

    // ── Site Info ────────────────────────────────────────────────

    private static function register_site_abilities() {
        wp_register_ability( 'agent-bricks/get-site-info', array(
            'label'               => __( 'Get Site Info', 'agent-to-bricks' ),
            'description'         => __( 'Returns Bricks Builder version, WordPress version, plugin version, PHP version, available element types, and breakpoints.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-site',
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'bricksVersion'  => array( 'type' => 'string' ),
                    'wpVersion'      => array( 'type' => 'string' ),
                    'pluginVersion'  => array( 'type' => 'string' ),
                    'phpVersion'     => array( 'type' => 'string' ),
                    'contentMetaKey' => array( 'type' => 'string' ),
                    'elementTypes'   => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_get_site_info' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/get-frameworks', array(
            'label'               => __( 'Get CSS Frameworks', 'agent-to-bricks' ),
            'description'         => __( 'Detects installed CSS frameworks (Automatic.css, etc.) and returns their settings, design tokens, color palettes, spacing scales, and typography.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-site',
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'frameworks' => array( 'type' => 'object' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_get_frameworks' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/list-element-types', array(
            'label'               => __( 'List Element Types', 'agent-to-bricks' ),
            'description'         => __( 'Lists all available Bricks Builder element types with their labels, categories, icons, and optionally their control schemas.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-site',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'include_controls' => array( 'type' => 'boolean', 'default' => false ),
                    'category'         => array( 'type' => 'string', 'default' => '' ),
                ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'elementTypes' => array( 'type' => 'array' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_element_types' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/list-pages', array(
            'label'               => __( 'List Pages', 'agent-to-bricks' ),
            'description'         => __( 'Lists WordPress pages accessible to the current user, with optional search filtering. Returns page ID, title, slug, status, and modified date.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-site',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'search'   => array( 'type' => 'string', 'default' => '' ),
                    'per_page' => array( 'type' => 'integer', 'default' => 20, 'maximum' => 50 ),
                ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'pages' => array( 'type' => 'array' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_pages' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/get-site-features', array(
            'label'               => __( 'Get Site Features', 'agent-to-bricks' ),
            'description'         => __( 'Returns machine-discoverable site capabilities including Bricks availability, frameworks, query-capable elements, Abilities support, and WooCommerce summary data.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-site',
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'bricks'            => array( 'type' => 'object' ),
                    'wordpress'         => array( 'type' => 'object' ),
                    'plugin'            => array( 'type' => 'object' ),
                    'abilities'         => array( 'type' => 'object' ),
                    'frameworks'        => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
                    'queryElements'     => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
                    'queryElementCount' => array( 'type' => 'integer' ),
                    'woocommerce'       => array( 'type' => 'object' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_get_site_features' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/list-query-element-types', array(
            'label'               => __( 'List Query Element Types', 'agent-to-bricks' ),
            'description'         => __( 'Lists Bricks element types that expose a query control, with optional control schemas for agent-friendly discovery.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-site',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'include_controls' => array( 'type' => 'boolean', 'default' => false ),
                ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'queryElements' => array( 'type' => 'array' ),
                    'count'         => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_query_element_types' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );
    }

    // ── Commerce & Query Discovery ─────────────────────────────

    private static function register_commerce_abilities() {
        wp_register_ability( 'agent-bricks/get-woocommerce-status', array(
            'label'               => __( 'Get WooCommerce Status', 'agent-to-bricks' ),
            'description'         => __( 'Returns WooCommerce availability, version, HPOS status, taxonomy support, Woo-specific Bricks element types, and whether Abilities support is available.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-commerce',
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'active'             => array( 'type' => 'boolean' ),
                    'version'            => array( 'type' => 'string' ),
                    'hpos'               => array( 'type' => 'boolean' ),
                    'productPostType'    => array( 'type' => 'boolean' ),
                    'productCategories'  => array( 'type' => 'boolean' ),
                    'productTags'        => array( 'type' => 'boolean' ),
                    'elementTypes'       => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
                    'elementTypeCount'   => array( 'type' => 'integer' ),
                    'abilitiesAvailable' => array( 'type' => 'boolean' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_get_woocommerce_status' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/list-products', array(
            'label'               => __( 'List WooCommerce Products', 'agent-to-bricks' ),
            'description'         => __( 'Lists WooCommerce products for agent discovery, autocomplete, and query planning. Returns basic catalog metadata including SKU, price, categories, and tags.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-commerce',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'search'   => array( 'type' => 'string', 'default' => '' ),
                    'per_page' => array( 'type' => 'integer', 'default' => 20, 'maximum' => 50 ),
                    'page'     => array( 'type' => 'integer', 'default' => 1 ),
                ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'products'          => array( 'type' => 'array' ),
                    'count'             => array( 'type' => 'integer' ),
                    'total'             => array( 'type' => 'integer' ),
                    'page'              => array( 'type' => 'integer' ),
                    'perPage'           => array( 'type' => 'integer' ),
                    'totalPages'        => array( 'type' => 'integer' ),
                    'woocommerceActive' => array( 'type' => 'boolean' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_products' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/list-product-categories', array(
            'label'               => __( 'List WooCommerce Product Categories', 'agent-to-bricks' ),
            'description'         => __( 'Lists WooCommerce product categories for discovery, filtering, and agent mentions.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-commerce',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'search'   => array( 'type' => 'string', 'default' => '' ),
                    'per_page' => array( 'type' => 'integer', 'default' => 20, 'maximum' => 50 ),
                ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'categories'        => array( 'type' => 'array' ),
                    'count'             => array( 'type' => 'integer' ),
                    'woocommerceActive' => array( 'type' => 'boolean' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_product_categories' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/list-product-tags', array(
            'label'               => __( 'List WooCommerce Product Tags', 'agent-to-bricks' ),
            'description'         => __( 'Lists WooCommerce product tags for discovery, filtering, and agent mentions.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-commerce',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'search'   => array( 'type' => 'string', 'default' => '' ),
                    'per_page' => array( 'type' => 'integer', 'default' => 20, 'maximum' => 50 ),
                ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'tags'               => array( 'type' => 'array' ),
                    'count'              => array( 'type' => 'integer' ),
                    'woocommerceActive'  => array( 'type' => 'boolean' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_product_tags' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );
    }

    // ── Page Elements ───────────────────────────────────────────

    private static function register_page_abilities() {
        wp_register_ability( 'agent-bricks/get-page-elements', array(
            'label'               => __( 'Get Page Elements', 'agent-to-bricks' ),
            'description'         => __( 'Retrieves all Bricks elements for a page. Returns the element tree, content hash (for optimistic locking), and element count.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'page_id' => array( 'type' => 'integer' ),
                ),
                'required'   => array( 'page_id' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'elements'    => array( 'type' => 'array' ),
                    'contentHash' => array( 'type' => 'string' ),
                    'count'       => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_get_page_elements' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/replace-page-elements', array(
            'label'               => __( 'Replace Page Elements', 'agent-to-bricks' ),
            'description'         => __( 'Full replace of all Bricks elements on a page. Requires content_hash for optimistic locking (prevents concurrent edit conflicts). Auto-creates a snapshot before writing.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'page_id'      => array( 'type' => 'integer' ),
                    'elements'     => array( 'type' => 'array' ),
                    'content_hash' => array( 'type' => 'string' ),
                ),
                'required'   => array( 'page_id', 'elements', 'content_hash' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'success'     => array( 'type' => 'boolean' ),
                    'contentHash' => array( 'type' => 'string' ),
                    'count'       => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_replace_page_elements' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false, 'destructive' => true, 'idempotent' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/append-page-elements', array(
            'label'               => __( 'Append Page Elements', 'agent-to-bricks' ),
            'description'         => __( 'Appends new Bricks elements to an existing page. Optionally specify a parent element ID and insert-after position. Requires content_hash for concurrency.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'page_id'      => array( 'type' => 'integer' ),
                    'elements'     => array( 'type' => 'array' ),
                    'content_hash' => array( 'type' => 'string' ),
                    'parent_id'    => array( 'type' => 'string', 'default' => '' ),
                    'insert_after' => array( 'type' => 'string', 'default' => '' ),
                ),
                'required'   => array( 'page_id', 'elements', 'content_hash' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'success'     => array( 'type' => 'boolean' ),
                    'contentHash' => array( 'type' => 'string' ),
                    'count'       => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_append_page_elements' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false ) ),
        ) );

        wp_register_ability( 'agent-bricks/patch-page-elements', array(
            'label'               => __( 'Patch Page Elements', 'agent-to-bricks' ),
            'description'         => __( 'Partially updates specific Bricks elements by ID. Send an array of patches, each with the element ID and the settings to update. Requires content_hash for concurrency.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'page_id'      => array( 'type' => 'integer' ),
                    'patches'      => array( 'type' => 'array' ),
                    'content_hash' => array( 'type' => 'string' ),
                ),
                'required'   => array( 'page_id', 'patches', 'content_hash' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'success'     => array( 'type' => 'boolean' ),
                    'contentHash' => array( 'type' => 'string' ),
                    'count'       => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_patch_page_elements' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false, 'idempotent' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/delete-page-elements', array(
            'label'               => __( 'Delete Page Elements', 'agent-to-bricks' ),
            'description'         => __( 'Removes specific Bricks elements from a page by their IDs. Requires content_hash for concurrency.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'page_id'      => array( 'type' => 'integer' ),
                    'ids'          => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
                    'content_hash' => array( 'type' => 'string' ),
                ),
                'required'   => array( 'page_id', 'ids', 'content_hash' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'success'     => array( 'type' => 'boolean' ),
                    'contentHash' => array( 'type' => 'string' ),
                    'count'       => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_delete_page_elements' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false, 'destructive' => true ) ),
        ) );
    }

    // ── Snapshots ───────────────────────────────────────────────

    private static function register_snapshot_abilities() {
        wp_register_ability( 'agent-bricks/list-snapshots', array(
            'label'               => __( 'List Snapshots', 'agent-to-bricks' ),
            'description'         => __( 'Lists all snapshots for a page. Each snapshot is a point-in-time backup of the page elements that can be restored.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array( 'page_id' => array( 'type' => 'integer' ) ),
                'required'   => array( 'page_id' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'snapshots' => array( 'type' => 'array' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_snapshots' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/create-snapshot', array(
            'label'               => __( 'Create Snapshot', 'agent-to-bricks' ),
            'description'         => __( 'Creates a point-in-time snapshot of a page\'s elements. Use before making changes so you can roll back. Maximum 10 snapshots per page (FIFO).', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'page_id' => array( 'type' => 'integer' ),
                    'label'   => array( 'type' => 'string', 'default' => '' ),
                ),
                'required'   => array( 'page_id' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'snapshotId'  => array( 'type' => 'string' ),
                    'contentHash' => array( 'type' => 'string' ),
                    'elementCount'=> array( 'type' => 'integer' ),
                    'timestamp'   => array( 'type' => 'string' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_create_snapshot' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false ) ),
        ) );

        wp_register_ability( 'agent-bricks/rollback-snapshot', array(
            'label'               => __( 'Rollback to Snapshot', 'agent-to-bricks' ),
            'description'         => __( 'Restores a page\'s elements to a previously saved snapshot. The current state is lost unless you created a snapshot first.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'page_id'     => array( 'type' => 'integer' ),
                    'snapshot_id' => array( 'type' => 'string' ),
                ),
                'required'   => array( 'page_id', 'snapshot_id' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'contentHash' => array( 'type' => 'string' ),
                    'count'       => array( 'type' => 'integer' ),
                    'restoredFrom'=> array( 'type' => 'string' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_rollback_snapshot' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false, 'destructive' => true ) ),
        ) );
    }

    // ── Global Classes ──────────────────────────────────────────

    private static function register_class_abilities() {
        wp_register_ability( 'agent-bricks/list-classes', array(
            'label'               => __( 'List Global Classes', 'agent-to-bricks' ),
            'description'         => __( 'Lists all Bricks global CSS classes, including ACSS utilities and Frames components. Optionally filter by framework.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-design',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'framework' => array( 'type' => 'string', 'default' => '' ),
                ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'classes' => array( 'type' => 'array' ),
                    'count'   => array( 'type' => 'integer' ),
                    'total'   => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_classes' ),
            'permission_callback' => array( __CLASS__, 'check_manage_options' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/create-class', array(
            'label'               => __( 'Create Global Class', 'agent-to-bricks' ),
            'description'         => __( 'Creates a new Bricks global CSS class with the given name and settings.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-design',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'name'     => array( 'type' => 'string' ),
                    'settings' => array( 'type' => 'object', 'default' => array() ),
                ),
                'required'   => array( 'name' ),
            ),
            'output_schema'       => array( 'type' => 'object' ),
            'execute_callback'    => array( __CLASS__, 'execute_create_class' ),
            'permission_callback' => array( __CLASS__, 'check_manage_options' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false ) ),
        ) );

        wp_register_ability( 'agent-bricks/delete-class', array(
            'label'               => __( 'Delete Global Class', 'agent-to-bricks' ),
            'description'         => __( 'Removes a Bricks global CSS class by its ID.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-design',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'class_id' => array( 'type' => 'string' ),
                ),
                'required'   => array( 'class_id' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'success' => array( 'type' => 'boolean' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_delete_class' ),
            'permission_callback' => array( __CLASS__, 'check_manage_options' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false, 'destructive' => true ) ),
        ) );
    }

    // ── Styles & Variables ──────────────────────────────────────

    private static function register_style_abilities() {
        wp_register_ability( 'agent-bricks/get-styles', array(
            'label'               => __( 'Get Theme Styles', 'agent-to-bricks' ),
            'description'         => __( 'Returns the Bricks theme styles, color palette, and global settings.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-design',
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'themeStyles'    => array( 'type' => 'array' ),
                    'colorPalette'   => array( 'type' => 'array' ),
                    'globalSettings' => array( 'type' => 'object' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_get_styles' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/get-variables', array(
            'label'               => __( 'Get CSS Variables', 'agent-to-bricks' ),
            'description'         => __( 'Returns CSS custom properties (variables) registered on the site, including those extracted from active stylesheets.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-design',
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'variables'        => array( 'type' => 'array' ),
                    'extractedFromCSS' => array( 'type' => 'array' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_get_variables' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );
    }

    // ── Content (Templates, Components, Media) ──────────────────

    private static function register_content_abilities() {
        wp_register_ability( 'agent-bricks/list-templates', array(
            'label'               => __( 'List Templates', 'agent-to-bricks' ),
            'description'         => __( 'Lists all Bricks templates (headers, footers, sections, pages) with their metadata.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-content',
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'templates' => array( 'type' => 'array' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_templates' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/list-components', array(
            'label'               => __( 'List Components', 'agent-to-bricks' ),
            'description'         => __( 'Lists all reusable Bricks components with their IDs, titles, element counts, and last modified dates.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-content',
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'components' => array( 'type' => 'array' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_list_components' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/get-component', array(
            'label'               => __( 'Get Component', 'agent-to-bricks' ),
            'description'         => __( 'Retrieves a single reusable Bricks component with its full element tree.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-content',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'component_id' => array( 'type' => 'integer' ),
                ),
                'required'   => array( 'component_id' ),
            ),
            'output_schema'       => array( 'type' => 'object' ),
            'execute_callback'    => array( __CLASS__, 'execute_get_component' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );

        wp_register_ability( 'agent-bricks/upload-media', array(
            'label'               => __( 'Upload Media', 'agent-to-bricks' ),
            'description'         => __( 'Uploads a file to the WordPress media library. Accepts base64-encoded file content with filename and MIME type.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-content',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'filename'     => array( 'type' => 'string' ),
                    'content_b64'  => array( 'type' => 'string' ),
                    'mime_type'    => array( 'type' => 'string', 'default' => 'image/png' ),
                ),
                'required'   => array( 'filename', 'content_b64' ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'id'       => array( 'type' => 'integer' ),
                    'url'      => array( 'type' => 'string' ),
                    'title'    => array( 'type' => 'string' ),
                    'mimeType' => array( 'type' => 'string' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_upload_media' ),
            'permission_callback' => array( __CLASS__, 'check_upload_files' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => false ) ),
        ) );
    }

    // ── Search ──────────────────────────────────────────────────

    private static function register_search_abilities() {
        wp_register_ability( 'agent-bricks/search-elements', array(
            'label'               => __( 'Search Elements', 'agent-to-bricks' ),
            'description'         => __( 'Searches for Bricks elements across all pages. Filter by element type, setting key/value, global class, post type, and Bricks query metadata such as queried post type or taxonomy.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'element_type'  => array( 'type' => 'string', 'default' => '' ),
                    'setting_key'   => array( 'type' => 'string', 'default' => '' ),
                    'setting_value' => array( 'type' => 'string', 'default' => '' ),
                    'global_class'  => array( 'type' => 'string', 'default' => '' ),
                    'post_type'     => array( 'type' => 'string', 'default' => '' ),
                    'has_query'     => array( 'type' => 'boolean', 'default' => false ),
                    'query_object_type' => array( 'type' => 'string', 'default' => '' ),
                    'query_post_type'   => array( 'type' => 'string', 'default' => '' ),
                    'query_taxonomy'    => array( 'type' => 'string', 'default' => '' ),
                    'per_page'      => array( 'type' => 'integer', 'default' => 20 ),
                    'page'          => array( 'type' => 'integer', 'default' => 1 ),
                ),
            ),
            'output_schema'       => array(
                'type'       => 'object',
                'properties' => array(
                    'results'    => array( 'type' => 'array' ),
                    'total'      => array( 'type' => 'integer' ),
                    'page'       => array( 'type' => 'integer' ),
                    'perPage'    => array( 'type' => 'integer' ),
                    'totalPages' => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_search_elements' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'meta'                => array( 'show_in_rest' => true, 'annotations' => array( 'readonly' => true ) ),
        ) );
    }

    // ═══════════════════════════════════════════════════════════
    // Execute Callbacks — delegate to existing API controllers
    // ═══════════════════════════════════════════════════════════

    public static function execute_get_site_info() {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        $response = $api->get_info( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_get_frameworks() {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        $response = $api->get_frameworks( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_get_site_features() {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        $response = $api->get_features( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_element_types( $input ) {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        if ( ! empty( $input['include_controls'] ) ) {
            $request->set_param( 'include_controls', true );
        }
        if ( ! empty( $input['category'] ) ) {
            $request->set_param( 'category', $input['category'] );
        }
        $response = $api->get_element_types( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_query_element_types( $input ) {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        if ( ! empty( $input['include_controls'] ) ) {
            $request->set_param( 'include_controls', true );
        }
        $response = $api->get_query_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_pages( $input ) {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        if ( ! empty( $input['search'] ) ) {
            $request->set_param( 'search', $input['search'] );
        }
        if ( ! empty( $input['per_page'] ) ) {
            $request->set_param( 'per_page', $input['per_page'] );
        }
        $response = $api->get_pages( $request );
        if ( is_wp_error( $response ) ) {
            return $response;
        }
        return array(
            'pages' => $response->get_data(),
        );
    }

    public static function execute_get_woocommerce_status() {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        $response = $api->get_woocommerce_status( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_products( $input ) {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        foreach ( array( 'search', 'per_page', 'page' ) as $key ) {
            if ( isset( $input[ $key ] ) && '' !== $input[ $key ] ) {
                $request->set_param( $key, $input[ $key ] );
            }
        }
        $response = $api->get_woocommerce_products( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_product_categories( $input ) {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        foreach ( array( 'search', 'per_page' ) as $key ) {
            if ( isset( $input[ $key ] ) && '' !== $input[ $key ] ) {
                $request->set_param( $key, $input[ $key ] );
            }
        }
        $response = $api->get_woocommerce_product_categories( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_product_tags( $input ) {
        $api = new ATB_Site_API();
        $request = new WP_REST_Request( 'GET' );
        foreach ( array( 'search', 'per_page' ) as $key ) {
            if ( isset( $input[ $key ] ) && '' !== $input[ $key ] ) {
                $request->set_param( $key, $input[ $key ] );
            }
        }
        $response = $api->get_woocommerce_product_tags( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_get_page_elements( $input ) {
        $api = new ATB_Elements_API();
        $request = new WP_REST_Request( 'GET' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        $response = $api->get_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_replace_page_elements( $input ) {
        $api = new ATB_Elements_API();
        $request = new WP_REST_Request( 'PUT' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        $request->set_header( 'If-Match', $input['content_hash'] );
        $request->set_header( 'Content-Type', 'application/json' );
        $request->set_body( wp_json_encode( array( 'elements' => $input['elements'] ) ) );
        $response = $api->replace_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_append_page_elements( $input ) {
        $api = new ATB_Elements_API();
        $request = new WP_REST_Request( 'POST' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        $request->set_header( 'If-Match', $input['content_hash'] );
        $body = array( 'elements' => $input['elements'] );
        if ( ! empty( $input['parent_id'] ) ) {
            $body['parentId'] = $input['parent_id'];
        }
        if ( ! empty( $input['insert_after'] ) ) {
            $body['insertAfter'] = $input['insert_after'];
        }
        $request->set_header( 'Content-Type', 'application/json' );
        $request->set_body( wp_json_encode( $body ) );
        $response = $api->append_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_patch_page_elements( $input ) {
        $api = new ATB_Elements_API();
        $request = new WP_REST_Request( 'PATCH' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        $request->set_header( 'If-Match', $input['content_hash'] );
        $request->set_header( 'Content-Type', 'application/json' );
        $request->set_body( wp_json_encode( array( 'patches' => $input['patches'] ) ) );
        $response = $api->patch_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_delete_page_elements( $input ) {
        $api = new ATB_Elements_API();
        $request = new WP_REST_Request( 'DELETE' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        $request->set_header( 'If-Match', $input['content_hash'] );
        $request->set_header( 'Content-Type', 'application/json' );
        $request->set_body( wp_json_encode( array( 'ids' => $input['ids'] ) ) );
        $response = $api->delete_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_snapshots( $input ) {
        $api = new ATB_Snapshots_API();
        $request = new WP_REST_Request( 'GET' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        $response = $api->list_snapshots( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_create_snapshot( $input ) {
        $api = new ATB_Snapshots_API();
        $request = new WP_REST_Request( 'POST' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        if ( ! empty( $input['label'] ) ) {
            $request->set_header( 'Content-Type', 'application/json' );
            $request->set_body( wp_json_encode( array( 'label' => $input['label'] ) ) );
        }
        $response = $api->create_snapshot( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_rollback_snapshot( $input ) {
        $api = new ATB_Snapshots_API();
        $request = new WP_REST_Request( 'POST' );
        $request->set_url_params( array(
            'id'          => $input['page_id'],
            'snapshot_id' => $input['snapshot_id'],
        ) );
        $response = $api->rollback_snapshot( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_classes( $input ) {
        $api = new ATB_Classes_API();
        $request = new WP_REST_Request( 'GET' );
        if ( ! empty( $input['framework'] ) ) {
            $request->set_param( 'framework', $input['framework'] );
        }
        $response = $api->list_classes( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_create_class( $input ) {
        $api = new ATB_Classes_API();
        $request = new WP_REST_Request( 'POST' );
        $request->set_header( 'Content-Type', 'application/json' );
        $request->set_body( wp_json_encode( array(
            'name'     => $input['name'],
            'settings' => $input['settings'] ?? array(),
        ) ) );
        $response = $api->create_class( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_delete_class( $input ) {
        $api = new ATB_Classes_API();
        $request = new WP_REST_Request( 'DELETE' );
        $request->set_url_params( array( 'id' => $input['class_id'] ) );
        $response = $api->delete_class( $request );
        return is_wp_error( $response ) ? $response : ( $response === true ? array( 'success' => true ) : $response->get_data() );
    }

    public static function execute_get_styles() {
        $api = new ATB_Styles_API();
        $request = new WP_REST_Request( 'GET' );
        $response = $api->get_styles( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_get_variables() {
        $api = new ATB_Styles_API();
        $request = new WP_REST_Request( 'GET' );
        $response = $api->get_variables( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_templates() {
        $api = new ATB_Templates_API();
        $request = new WP_REST_Request( 'GET' );
        $response = $api->list_templates( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_list_components() {
        $api = new ATB_Components_API();
        $request = new WP_REST_Request( 'GET' );
        $response = $api->list_components( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_get_component( $input ) {
        $api = new ATB_Components_API();
        $request = new WP_REST_Request( 'GET' );
        $request->set_url_params( array( 'id' => $input['component_id'] ) );
        $response = $api->get_component( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_upload_media( $input ) {
        // Decode base64 content to a temp file, then delegate to media API.
        $decoded = base64_decode( $input['content_b64'], true );
        if ( false === $decoded ) {
            return new WP_Error( 'invalid_base64', 'Could not decode base64 content.', array( 'status' => 400 ) );
        }
        $tmp_file = wp_tempnam( $input['filename'] );
        file_put_contents( $tmp_file, $decoded );

        // Simulate a file upload array for wp_handle_sideload.
        $file_array = array(
            'name'     => sanitize_file_name( $input['filename'] ),
            'tmp_name' => $tmp_file,
            'type'     => $input['mime_type'] ?? 'image/png',
            'size'     => strlen( $decoded ),
            'error'    => UPLOAD_ERR_OK,
        );

        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $overrides = array( 'test_form' => false );
        $uploaded  = wp_handle_sideload( $file_array, $overrides );

        if ( ! empty( $uploaded['error'] ) ) {
            return new WP_Error( 'upload_failed', $uploaded['error'], array( 'status' => 500 ) );
        }

        $attachment = array(
            'post_mime_type' => $uploaded['type'],
            'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $uploaded['file'] ) ),
            'post_status'    => 'inherit',
        );
        $attach_id = wp_insert_attachment( $attachment, $uploaded['file'] );
        $attach_data = wp_generate_attachment_metadata( $attach_id, $uploaded['file'] );
        wp_update_attachment_metadata( $attach_id, $attach_data );

        return array(
            'id'       => $attach_id,
            'url'      => wp_get_attachment_url( $attach_id ),
            'title'    => get_the_title( $attach_id ),
            'mimeType' => $uploaded['type'],
        );
    }

    public static function execute_search_elements( $input ) {
        $api = new ATB_Search_API();
        $request = new WP_REST_Request( 'GET' );
        foreach ( array( 'element_type', 'setting_key', 'setting_value', 'global_class', 'post_type', 'has_query', 'query_object_type', 'query_post_type', 'query_taxonomy', 'per_page', 'page' ) as $key ) {
            if ( isset( $input[ $key ] ) && '' !== $input[ $key ] ) {
                $request->set_param( $key, $input[ $key ] );
            }
        }
        $response = $api->search_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    // ═══════════════════════════════════════════════════════════
    // Permission Callbacks
    // ═══════════════════════════════════════════════════════════

    /**
     * Check if user can edit posts (read-only site info, classes, etc.).
     */
    public static function check_edit_posts() {
        return current_user_can( 'edit_posts' );
    }

    /**
     * Check if user can manage options (class CRUD, admin operations).
     */
    public static function check_manage_options() {
        return current_user_can( 'manage_options' );
    }

    /**
     * Check if user can upload files.
     */
    public static function check_upload_files() {
        return current_user_can( 'upload_files' );
    }

    /**
     * Check if user can edit the specific post referenced in input.
     * Falls back to edit_posts if no page_id provided.
     */
    public static function check_edit_post_by_input( $input ) {
        if ( ! empty( $input['page_id'] ) ) {
            $can = current_user_can( 'edit_post', $input['page_id'] );
            if ( ! $can ) {
                return new WP_Error(
                    'rest_forbidden',
                    __( 'You do not have permission to edit this page.', 'agent-to-bricks' ),
                    array( 'status' => 403 )
                );
            }
            // Also check ATB access control rules.
            return ATB_Access_Control::can_access_post( $input['page_id'] );
        }
        return current_user_can( 'edit_posts' );
    }
}
