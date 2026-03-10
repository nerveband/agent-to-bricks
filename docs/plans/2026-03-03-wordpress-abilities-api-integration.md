# WordPress Abilities API Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Register all ATB plugin operations as WordPress Abilities (WP 6.9+) so third-party AI agents can discover and execute them. Enhance the CLI, GUI, and plugin admin to discover, display, and inject abilities from any plugin on the site into LLM context.

**Architecture:** Additive approach — keep all existing custom REST endpoints unchanged. Register abilities alongside them, wrapping existing controller logic. CLI gains abilities discovery for LLM context enrichment. GUI injects discovered abilities into session pre-prompts. Plugin admin shows abilities status. Both X-ATB-Key and WP Application Passwords are supported for abilities auth.

**Tech Stack:** PHP 8.0+ (plugin), Go 1.22+ (CLI), Rust/Tauri 2 + React 19/TS (GUI), Astro/Starlight (docs)

**References:**
- [WordPress Abilities API docs](https://developer.wordpress.org/apis/abilities-api/)
- [Abilities REST endpoints](https://developer.wordpress.org/apis/abilities-api/rest-api-endpoints/)
- [PHP reference](https://developer.wordpress.org/apis/abilities-api/php-reference/)
- [wp_register_ability()](https://developer.wordpress.org/reference/functions/wp_register_ability/)
- [Bricks Builder docs](https://academy.bricksbuilder.io/)
- [Abilities API announcement](https://developer.wordpress.org/news/2025/11/introducing-the-wordpress-abilities-api/)

---

## Task 1: Plugin — Abilities Registration File

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-abilities-api.php`
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php:25-44` (add require)
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php:60-76` (add init call)

**Step 1: Write the abilities registration class**

Create `plugin/agent-to-bricks/includes/class-abilities-api.php`:

```php
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
    }

    /**
     * Register all abilities.
     */
    public static function register_abilities() {
        self::register_site_abilities();
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => false, 'destructive' => true, 'idempotent' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => false ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => false, 'idempotent' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => false, 'destructive' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
                    'label'       => array( 'type' => 'string' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_create_snapshot' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'annotations'         => array( 'readonly' => false ),
            'meta'                => array( 'show_in_rest' => true ),
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
                    'success'     => array( 'type' => 'boolean' ),
                    'contentHash' => array( 'type' => 'string' ),
                    'restored'    => array( 'type' => 'string' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_rollback_snapshot' ),
            'permission_callback' => array( __CLASS__, 'check_edit_post_by_input' ),
            'annotations'         => array( 'readonly' => false, 'destructive' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => false ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => false, 'destructive' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
            'annotations'         => array( 'readonly' => false ),
            'meta'                => array( 'show_in_rest' => true ),
        ) );
    }

    // ── Search ──────────────────────────────────────────────────

    private static function register_search_abilities() {
        wp_register_ability( 'agent-bricks/search-elements', array(
            'label'               => __( 'Search Elements', 'agent-to-bricks' ),
            'description'         => __( 'Searches for Bricks elements across all pages. Filter by element type, setting key/value, global class, or post type.', 'agent-to-bricks' ),
            'category'            => 'agent-bricks-pages',
            'input_schema'        => array(
                'type'       => 'object',
                'properties' => array(
                    'element_type'  => array( 'type' => 'string', 'default' => '' ),
                    'setting_key'   => array( 'type' => 'string', 'default' => '' ),
                    'setting_value' => array( 'type' => 'string', 'default' => '' ),
                    'global_class'  => array( 'type' => 'string', 'default' => '' ),
                    'post_type'     => array( 'type' => 'string', 'default' => '' ),
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
                    'totalPages' => array( 'type' => 'integer' ),
                ),
            ),
            'execute_callback'    => array( __CLASS__, 'execute_search_elements' ),
            'permission_callback' => array( __CLASS__, 'check_edit_posts' ),
            'annotations'         => array( 'readonly' => true ),
            'meta'                => array( 'show_in_rest' => true ),
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
        $request->set_body_params( array( 'elements' => $input['elements'] ) );
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
        $request->set_body_params( $body );
        $response = $api->append_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_patch_page_elements( $input ) {
        $api = new ATB_Elements_API();
        $request = new WP_REST_Request( 'PATCH' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        $request->set_header( 'If-Match', $input['content_hash'] );
        $request->set_body_params( array( 'patches' => $input['patches'] ) );
        $response = $api->patch_elements( $request );
        return is_wp_error( $response ) ? $response : $response->get_data();
    }

    public static function execute_delete_page_elements( $input ) {
        $api = new ATB_Elements_API();
        $request = new WP_REST_Request( 'DELETE' );
        $request->set_url_params( array( 'id' => $input['page_id'] ) );
        $request->set_header( 'If-Match', $input['content_hash'] );
        $request->set_body_params( array( 'ids' => $input['ids'] ) );
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
            $request->set_body_params( array( 'label' => $input['label'] ) );
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
        $request->set_body_params( array(
            'name'     => $input['name'],
            'settings' => $input['settings'] ?? array(),
        ) );
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
        foreach ( array( 'element_type', 'setting_key', 'setting_value', 'global_class', 'post_type', 'per_page', 'page' ) as $key ) {
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
```

**Step 2: Require the new file in the main plugin file**

In `plugin/agent-to-bricks/agent-to-bricks.php`, add after line 44 (`class-components-api.php`):

```php
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-abilities-api.php';
```

**Step 3: Initialize in the plugin bootstrap**

In `plugin/agent-to-bricks/agent-to-bricks.php`, add after line 75 (`ATB_Components_API::init();`):

```php
    ATB_Abilities_API::init();
```

**Step 4: PHP lint**

Run: `for f in plugin/agent-to-bricks/includes/class-abilities-api.php plugin/agent-to-bricks/agent-to-bricks.php; do php -l "$f"; done`
Expected: No syntax errors detected

**Step 5: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-abilities-api.php plugin/agent-to-bricks/agent-to-bricks.php
git commit -m "feat(plugin): register all operations as WordPress Abilities (WP 6.9+)

Additive integration — existing custom REST endpoints unchanged.
Conditional on function_exists('wp_register_ability_category').
22 abilities across 4 categories, all with show_in_rest: true.
Execute callbacks delegate to existing API controllers."
```

---

## Task 2: CLI — Abilities Discovery Client Methods

**Files:**
- Modify: `cli/internal/client/client.go` (add types + methods)
- Create: `cli/internal/client/abilities_test.go`

**Step 1: Write the failing test**

Create `cli/internal/client/abilities_test.go`:

```go
package client

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetAbilities(t *testing.T) {
	abilities := []Ability{
		{
			Name:        "agent-bricks/get-site-info",
			Label:       "Get Site Info",
			Description: "Returns Bricks version info",
			Category:    "agent-bricks-site",
			Annotations: AbilityAnnotations{Readonly: true},
			InputSchema: map[string]interface{}{},
			OutputSchema: map[string]interface{}{
				"type": "object",
			},
		},
		{
			Name:        "yoast/get-seo-meta",
			Label:       "Get SEO Meta",
			Description: "Returns SEO metadata for a post",
			Category:    "seo",
			Annotations: AbilityAnnotations{Readonly: true},
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"post_id": map[string]interface{}{"type": "integer"},
				},
			},
			OutputSchema: map[string]interface{}{
				"type": "object",
			},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/wp-abilities/v1/abilities" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("X-ATB-Key") != "test-key" {
			t.Error("missing X-ATB-Key header")
		}
		json.NewEncoder(w).Encode(abilities)
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key")
	result, err := c.GetAbilities("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 abilities, got %d", len(result))
	}
	if result[0].Name != "agent-bricks/get-site-info" {
		t.Errorf("expected agent-bricks/get-site-info, got %s", result[0].Name)
	}
	if !result[0].Annotations.Readonly {
		t.Error("expected readonly annotation")
	}
}

func TestGetAbilitiesWithCategory(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cat := r.URL.Query().Get("category")
		if cat != "agent-bricks-site" {
			t.Errorf("expected category filter, got %q", cat)
		}
		json.NewEncoder(w).Encode([]Ability{})
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key")
	_, err := c.GetAbilities("agent-bricks-site")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGetAbilitiesNotSupported(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
		w.Write([]byte(`{"code":"rest_no_route","message":"No route was found matching the URL"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key")
	result, err := c.GetAbilities("")
	if err != nil {
		t.Fatal("should not error on 404 — just return empty")
	}
	if len(result) != 0 {
		t.Errorf("expected empty result on 404, got %d", len(result))
	}
}

func TestGetAbilityCategories(t *testing.T) {
	cats := []AbilityCategory{
		{Slug: "agent-bricks-pages", Label: "Bricks Page Management", Description: "Read and manage pages"},
		{Slug: "seo", Label: "SEO", Description: "Search engine optimization"},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(cats)
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key")
	result, err := c.GetAbilityCategories()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 categories, got %d", len(result))
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test ./internal/client/ -run TestGetAbilities -v`
Expected: FAIL — types Ability, AbilityAnnotations, AbilityCategory undefined

**Step 3: Add types and methods to client.go**

Add to `cli/internal/client/client.go` at the end of the file (after existing methods):

```go
// Ability represents a WordPress Abilities API entry (WP 6.9+).
type Ability struct {
	Name         string                 `json:"name"`
	Label        string                 `json:"label"`
	Description  string                 `json:"description"`
	Category     string                 `json:"category"`
	Annotations  AbilityAnnotations     `json:"annotations"`
	InputSchema  map[string]interface{} `json:"input_schema"`
	OutputSchema map[string]interface{} `json:"output_schema"`
}

// AbilityAnnotations describes the behavior of an ability.
type AbilityAnnotations struct {
	Readonly    bool `json:"readonly"`
	Destructive bool `json:"destructive"`
	Idempotent  bool `json:"idempotent"`
}

// AbilityCategory groups related abilities.
type AbilityCategory struct {
	Slug        string `json:"slug"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

// GetAbilities fetches abilities from the WordPress Abilities API (WP 6.9+).
// Returns empty slice (not error) if the site doesn't support abilities.
func (c *Client) GetAbilities(category string) ([]Ability, error) {
	path := "/abilities"
	if category != "" {
		path += "?category=" + url.QueryEscape(category)
	}
	abilitiesURL := c.baseURL + "/wp-json/wp-abilities/v1" + path
	req, err := http.NewRequest("GET", abilitiesURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-ATB-Key", c.apiKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// 404 means abilities not supported — return empty, not error.
	if resp.StatusCode == 404 {
		return []Ability{}, nil
	}
	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("abilities API HTTP %d: %s", resp.StatusCode, string(data))
	}

	var abilities []Ability
	if err := json.NewDecoder(resp.Body).Decode(&abilities); err != nil {
		return nil, err
	}
	return abilities, nil
}

// GetAbilityCategories fetches ability categories (WP 6.9+).
func (c *Client) GetAbilityCategories() ([]AbilityCategory, error) {
	abilitiesURL := c.baseURL + "/wp-json/wp-abilities/v1/categories"
	req, err := http.NewRequest("GET", abilitiesURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-ATB-Key", c.apiKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return []AbilityCategory{}, nil
	}
	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("abilities API HTTP %d: %s", resp.StatusCode, string(data))
	}

	var categories []AbilityCategory
	if err := json.NewDecoder(resp.Body).Decode(&categories); err != nil {
		return nil, err
	}
	return categories, nil
}
```

**Step 4: Run tests**

Run: `cd cli && go test ./internal/client/ -run TestGetAbilities -v && go test ./internal/client/ -run TestGetAbilityCategories -v`
Expected: PASS

**Step 5: Run all existing tests to verify no regression**

Run: `cd cli && go test ./...`
Expected: All pass

**Step 6: Commit**

```bash
git add cli/internal/client/client.go cli/internal/client/abilities_test.go
git commit -m "feat(cli): add Abilities API client methods

GetAbilities() and GetAbilityCategories() call /wp-abilities/v1/.
Gracefully return empty on 404 (pre-6.9 sites).
Uses X-ATB-Key auth on abilities endpoints too."
```

---

## Task 3: CLI — Add Abilities to ContextBuilder

**Files:**
- Modify: `cli/internal/agent/context.go:10-35` (add AbilityInfo type, extend ContextBuilder)
- Modify: `cli/internal/agent/context.go:65-78` (add abilities to markdown render)
- Modify: `cli/internal/agent/context.go:81-120` (add abilities to JSON render)
- Modify: `cli/internal/agent/context.go:123-168` (add abilities to prompt render)
- Modify: `cli/internal/agent/context.go:171-186` (add abilities to section render)
- Modify: `cli/internal/agent/context_test.go` (add abilities test cases)

**Step 1: Write the failing test**

Add to `cli/internal/agent/context_test.go`:

```go
func TestContextBuilder_Abilities(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.9.1", "1.7.0")
	b.AddAbilities([]AbilityInfo{
		{
			Name:          "agent-bricks/get-site-info",
			Label:         "Get Site Info",
			Description:   "Returns Bricks version info",
			Category:      "agent-bricks-site",
			CategoryLabel: "Bricks Site Info",
			Readonly:      true,
		},
		{
			Name:          "yoast/get-seo-meta",
			Label:         "Get SEO Meta",
			Description:   "Returns SEO metadata for a post",
			Category:      "seo",
			CategoryLabel: "SEO",
			Readonly:      true,
			InputHint:     `{"post_id": <integer>}`,
		},
	})

	// Markdown should include abilities
	md := b.RenderMarkdown()
	expected := []string{
		"## WordPress Abilities",
		"plugins register \"abilities\"",
		"named actions that any AI agent",
		"agent-bricks/get-site-info",
		"yoast/get-seo-meta",
		"Get SEO Meta",
		"GET ",
		"/wp-json/wp-abilities/v1/",
	}
	for _, s := range expected {
		if !strings.Contains(md, s) {
			t.Errorf("markdown missing %q", s)
		}
	}

	// JSON should include abilities
	jsonStr := b.RenderJSON()
	jsonExpected := []string{
		`"abilities"`,
		`"yoast/get-seo-meta"`,
		`"seo"`,
	}
	for _, s := range jsonExpected {
		if !strings.Contains(jsonStr, s) {
			t.Errorf("JSON missing %q", s)
		}
	}

	// Prompt should include abilities with explanation
	prompt := b.RenderPrompt()
	promptExpected := []string{
		"WordPress Abilities",
		"plugins register \"abilities\"",
		"named actions",
		"Why abilities matter",
		"When to use abilities vs. the ATB REST API",
		"agent-bricks/get-site-info",
		"yoast/get-seo-meta",
		"/wp-abilities/v1/",
	}
	for _, s := range promptExpected {
		if !strings.Contains(prompt, s) {
			t.Errorf("prompt missing %q", s)
		}
	}

	// Section render
	section := b.RenderSection("abilities")
	if !strings.Contains(section, "yoast/get-seo-meta") {
		t.Error("abilities section missing ability name")
	}
}

func TestContextBuilder_NoAbilities(t *testing.T) {
	b := NewContextBuilder()
	b.SetSiteInfo("2.2", "6.4", "1.7.0")
	// No abilities added — should not include section
	md := b.RenderMarkdown()
	if strings.Contains(md, "WordPress Abilities") {
		t.Error("should not include abilities section when none are set")
	}
}
```

**Step 2: Run tests to verify they fail**

Run: `cd cli && go test ./internal/agent/ -run TestContextBuilder_Abilities -v`
Expected: FAIL — AbilityInfo undefined, AddAbilities undefined

**Step 3: Add AbilityInfo and extend ContextBuilder**

In `cli/internal/agent/context.go`, add the AbilityInfo type after TemplateInfo (line 24):

```go
// AbilityInfo represents a WordPress Ability for context output (WP 6.9+).
type AbilityInfo struct {
	Name          string
	Label         string
	Description   string
	Category      string
	CategoryLabel string // Human-readable category name
	Readonly      bool
	InputHint     string // Simplified input schema hint for the LLM
}
```

Add `abilities` field to ContextBuilder struct (after line 34):

```go
	abilities []AbilityInfo
```

Add setter method after SetCompact (after line 62):

```go
func (b *ContextBuilder) AddAbilities(abilities []AbilityInfo) {
	b.abilities = append(b.abilities, abilities...)
}
```

**Step 4: Add abilities rendering**

Add `writeAbilitiesSection` after `writeWorkflowsSection` (after line 283):

```go
func (b *ContextBuilder) writeAbilitiesSection(sb *strings.Builder) {
	if len(b.abilities) == 0 {
		return
	}

	sb.WriteString(fmt.Sprintf("## WordPress Abilities (%d)\n\n", len(b.abilities)))
	sb.WriteString("WordPress 6.9+ lets plugins register \"abilities\" — named actions that any AI agent\n")
	sb.WriteString("can discover and execute through a standard REST API. Each ability has typed inputs,\n")
	sb.WriteString("typed outputs, and built-in permission checks. Think of them as a plugin's menu of\n")
	sb.WriteString("everything it can do, exposed in a machine-readable format.\n\n")
	sb.WriteString("**Why abilities matter:**\n")
	sb.WriteString("- They let you go beyond Bricks page editing. You can set SEO meta, create products,\n")
	sb.WriteString("  manage forms, or do anything else that installed plugins expose — all from one conversation.\n")
	sb.WriteString("- You don't need custom integration code for each plugin. If a plugin registers abilities,\n")
	sb.WriteString("  you can call them immediately.\n")
	sb.WriteString("- Input/output schemas are included, so you know exactly what to send and what you'll get back.\n\n")
	sb.WriteString("**When to use abilities vs. the ATB REST API:**\n")
	sb.WriteString("- For Bricks page operations (reading elements, pushing pages, snapshots, classes), prefer\n")
	sb.WriteString("  the ATB REST API (`/wp-json/agent-bricks/v1/...`) — it supports optimistic locking via\n")
	sb.WriteString("  If-Match headers and has purpose-built endpoints.\n")
	sb.WriteString("- For anything outside Bricks (SEO, e-commerce, forms, custom plugins), use abilities.\n")
	sb.WriteString("- For discovering what the site can do, use abilities — they're the universal discovery mechanism.\n\n")
	sb.WriteString("**How to call them:**\n")
	sb.WriteString("- Readonly abilities: `GET /wp-json/wp-abilities/v1/{name}/run`\n")
	sb.WriteString("- Write abilities: `POST /wp-json/wp-abilities/v1/{name}/run` with `{\"input\": {...}}`\n")
	sb.WriteString("- Auth: `X-ATB-Key` header (same key as the ATB REST API)\n")
	sb.WriteString("- Docs: https://developer.wordpress.org/apis/abilities-api/\n\n")

	// Group by category
	cats := make(map[string][]AbilityInfo)
	catLabels := make(map[string]string)
	for _, a := range b.abilities {
		cats[a.Category] = append(cats[a.Category], a)
		if _, exists := catLabels[a.Category]; !exists {
			catLabels[a.Category] = a.CategoryLabel
		}
	}

	keys := make([]string, 0, len(cats))
	for k := range cats {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, cat := range keys {
		abilities := cats[cat]
		label := catLabels[cat]
		if label == "" {
			label = cat
		}
		sb.WriteString(fmt.Sprintf("### %s (%d)\n", label, len(abilities)))
		for _, a := range abilities {
			method := "POST"
			if a.Readonly {
				method = "GET "
			}
			if b.compact {
				sb.WriteString(fmt.Sprintf("- %s `%s` — %s\n", method, a.Name, a.Label))
			} else {
				sb.WriteString(fmt.Sprintf("- %s **`%s`** — %s\n", method, a.Name, a.Label))
				sb.WriteString(fmt.Sprintf("  %s\n", a.Description))
				if a.InputHint != "" {
					sb.WriteString(fmt.Sprintf("  Input: `%s`\n", a.InputHint))
				}
			}
		}
	}
	sb.WriteString("\n")
}
```

**Step 5: Wire abilities into all render methods**

In `RenderMarkdown()` (line 65-78), add before `return`:
```go
	b.writeAbilitiesSection(&sb)
```

In `RenderJSON()` (line 81-120), add before `jsonBytes`:
```go
	// Abilities
	if len(b.abilities) > 0 {
		abilityData := []map[string]interface{}{}
		for _, a := range b.abilities {
			abilityData = append(abilityData, map[string]interface{}{
				"name":          a.Name,
				"label":         a.Label,
				"description":   a.Description,
				"category":      a.Category,
				"categoryLabel": a.CategoryLabel,
				"readonly":      a.Readonly,
				"inputHint":     a.InputHint,
			})
		}
		data["abilities"] = abilityData
	}
```

In `RenderPrompt()` (line 123-168), add before `return`:
```go
	if len(b.abilities) > 0 {
		b.writeAbilitiesSection(&sb)
	}
```

In `RenderSection()` (line 171-186), add a new case:
```go
	case "abilities":
		b.writeAbilitiesSection(&sb)
```

**Step 6: Run tests**

Run: `cd cli && go test ./internal/agent/ -v`
Expected: All pass (including new abilities tests)

**Step 7: Commit**

```bash
git add cli/internal/agent/context.go cli/internal/agent/context_test.go
git commit -m "feat(cli): add abilities section to LLM context output

ContextBuilder.AddAbilities() includes WordPress Abilities in
markdown, JSON, and prompt output formats. Groups by category.
Shows name, label, description, readonly/write mode, and input hints.
Section renderable standalone via --section abilities."
```

---

## Task 4: CLI — Fetch Abilities in Agent Context Command

**Files:**
- Modify: `cli/cmd/agent.go:48-158` (add abilities fetch to RunE)
- Modify: `cli/cmd/agent.go:200-208` (add --abilities flag)

**Step 1: Add --abilities flag**

In `cli/cmd/agent.go`, add a new var (after line 17):

```go
	agentAbilities bool
```

In `init()` (after line 203), add:

```go
	agentContextCmd.Flags().BoolVar(&agentAbilities, "abilities", false, "include WordPress Abilities from all plugins (WP 6.9+)")
```

Update the `--section` flag help to include `abilities`:

Change line 202 from:
```go
	agentContextCmd.Flags().StringVarP(&agentSection, "section", "s", "", "dump single section: tokens, classes, templates, workflows")
```
to:
```go
	agentContextCmd.Flags().StringVarP(&agentSection, "section", "s", "", "dump single section: tokens, classes, templates, workflows, abilities")
```

**Step 2: Add abilities fetching to RunE**

In `cli/cmd/agent.go`, inside the `if cfg.Site.URL != "" && cfg.Site.APIKey != ""` block (after classes fetching ends at ~line 102), add:

```go
			// Abilities (WP 6.9+)
			if agentAbilities || agentSection == "abilities" {
				abilities, err := c.GetAbilities("")
				if err != nil {
					fmt.Fprintf(os.Stderr, "Warning: could not fetch abilities: %v\n", err)
				} else if len(abilities) > 0 {
					var abilityInfos []agent.AbilityInfo
					for _, a := range abilities {
						inputHint := ""
						if a.InputSchema != nil {
							if props, ok := a.InputSchema["properties"].(map[string]interface{}); ok && len(props) > 0 {
								// Build a simplified input hint
								parts := make([]string, 0, len(props))
								for k, v := range props {
									typ := "any"
									if vm, ok := v.(map[string]interface{}); ok {
										if t, ok := vm["type"].(string); ok {
											typ = t
										}
									}
									parts = append(parts, fmt.Sprintf("%q: <%s>", k, typ))
								}
								sort.Strings(parts)
								inputHint = "{" + strings.Join(parts, ", ") + "}"
							}
						}
						abilityInfos = append(abilityInfos, agent.AbilityInfo{
							Name:        a.Name,
							Label:       a.Label,
							Description: a.Description,
							Category:    a.Category,
							Readonly:    a.Annotations.Readonly,
							InputHint:   inputHint,
						})
					}
					b.AddAbilities(abilityInfos)
					fmt.Fprintf(os.Stderr, "Loaded %d abilities\n", len(abilityInfos))
				} else {
					fmt.Fprintf(os.Stderr, "No abilities found (site may be pre-WP 6.9)\n")
				}
			}
```

Add `"sort"` and `"strings"` imports if not already present (they should already be imported via `agent.go`'s use of `categorizeClass`). Also add `"github.com/nerveband/agent-to-bricks/internal/client"` to imports — actually, the client types are returned by `newSiteClient()` which already returns `*client.Client`, and `GetAbilities` returns `[]client.Ability`. The import `"github.com/nerveband/agent-to-bricks/internal/client"` is not currently imported in agent.go — but since `newSiteClient()` returns the client directly without qualifying the package, it must be done differently. Actually, looking at the code, `newSiteClient()` in root.go returns `*client.Client`, and agent.go calls methods on it. The `c.GetAbilities("")` returns `[]client.Ability`, so we need the `client` import. But wait — agent.go currently doesn't import client because it only calls methods through the returned `*client.Client` interface-like pattern. We need to add the import.

Add to imports in `cli/cmd/agent.go`:
```go
	"sort"

	"github.com/nerveband/agent-to-bricks/internal/client"
```

And change the abilities loop to use `client.Ability` — actually no, Go infers the type from the return value. The `c.GetAbilities("")` returns `([]client.Ability, error)`, and we iterate with range, so Go knows the type. But we do reference `agent.AbilityInfo` which is already imported. We need `sort` and we need `strings` (both may already be there for the `categorizeClass` function).

Check: `agent.go` already imports `"fmt"`, `"os"`, agent, convert, templates, cobra. It does NOT currently import `"sort"` or `"strings"`. Add them.

**Step 3: Run all tests**

Run: `cd cli && go test ./... && go vet ./...`
Expected: All pass

**Step 4: Commit**

```bash
git add cli/cmd/agent.go
git commit -m "feat(cli): fetch WordPress Abilities in agent context command

New --abilities flag discovers capabilities from all plugins via
/wp-abilities/v1/abilities. Builds input hints from JSON schemas.
Falls back gracefully on pre-6.9 sites. Available as --section abilities."
```

---

## Task 5: CLI — New `bricks abilities` Command Group

**Files:**
- Create: `cli/cmd/abilities.go`
- Create: `cli/cmd/abilities_test.go`

**Step 1: Write the test**

Create `cli/cmd/abilities_test.go`:

```go
package cmd

import (
	"testing"
)

func TestAbilitiesCmd_Exists(t *testing.T) {
	cmd := rootCmd
	found := false
	for _, c := range cmd.Commands() {
		if c.Use == "abilities" {
			found = true
			break
		}
	}
	if !found {
		t.Error("abilities command not registered on root")
	}
}

func TestAbilitiesListCmd_Exists(t *testing.T) {
	var abilitiesFound *cobra.Command
	for _, c := range rootCmd.Commands() {
		if c.Use == "abilities" {
			abilitiesFound = c
			break
		}
	}
	if abilitiesFound == nil {
		t.Fatal("abilities command not found")
	}

	found := false
	for _, c := range abilitiesFound.Commands() {
		if c.Use == "list" {
			found = true
		}
	}
	if !found {
		t.Error("abilities list subcommand not found")
	}
}
```

(Add `"github.com/spf13/cobra"` import.)

**Step 2: Write the command**

Create `cli/cmd/abilities.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var abilitiesCmd = &cobra.Command{
	Use:   "abilities",
	Short: "Discover WordPress Abilities on the site (WP 6.9+)",
	Long: `Query the WordPress Abilities API to discover what actions are available
on the connected site. This includes abilities registered by Agent to Bricks
and any other plugin that supports the Abilities API.

Requires WordPress 6.9 or later. Returns empty results on older versions.

Reference: https://developer.wordpress.org/apis/abilities-api/`,
}

var abilitiesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all available abilities",
	Long: `Lists all abilities registered on the site via the WordPress Abilities API.
Abilities from all plugins are included, not just Agent to Bricks.

Examples:
  bricks abilities list                           # All abilities
  bricks abilities list --category agent-bricks-pages  # Filter by category
  bricks abilities list --json                    # JSON output`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		category, _ := cmd.Flags().GetString("category")
		jsonOut, _ := cmd.Flags().GetBool("json")

		abilities, err := c.GetAbilities(category)
		if err != nil {
			return fmt.Errorf("failed to fetch abilities: %w", err)
		}

		if len(abilities) == 0 {
			fmt.Fprintln(os.Stderr, "No abilities found. The site may not support the WordPress Abilities API (requires WP 6.9+).")
			return nil
		}

		if jsonOut {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(abilities)
		}

		// Group by category
		cats := make(map[string][]struct{ Name, Label, Mode string })
		for _, a := range abilities {
			mode := "read/write"
			if a.Annotations.Readonly {
				mode = "readonly"
			}
			if a.Annotations.Destructive {
				mode = "destructive"
			}
			cats[a.Category] = append(cats[a.Category], struct{ Name, Label, Mode string }{
				Name: a.Name, Label: a.Label, Mode: mode,
			})
		}

		keys := make([]string, 0, len(cats))
		for k := range cats {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintf(w, "ABILITY\tLABEL\tMODE\n")
		for _, cat := range keys {
			fmt.Fprintf(w, "\n[%s]\n", cat)
			for _, a := range cats[cat] {
				fmt.Fprintf(w, "%s\t%s\t%s\n", a.Name, a.Label, a.Mode)
			}
		}
		w.Flush()
		fmt.Fprintf(os.Stderr, "\n%d abilities across %d categories\n", len(abilities), len(cats))
		return nil
	},
}

var abilitiesDescribeCmd = &cobra.Command{
	Use:   "describe <ability-name>",
	Short: "Show details and schemas for an ability",
	Long: `Shows the full details of a specific ability including its description,
input/output JSON schemas, annotations, and category.

Examples:
  bricks abilities describe agent-bricks/get-site-info
  bricks abilities describe yoast/get-seo-meta`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()
		name := args[0]

		abilities, err := c.GetAbilities("")
		if err != nil {
			return fmt.Errorf("failed to fetch abilities: %w", err)
		}

		for _, a := range abilities {
			if a.Name == name {
				fmt.Printf("Name:        %s\n", a.Name)
				fmt.Printf("Label:       %s\n", a.Label)
				fmt.Printf("Description: %s\n", a.Description)
				fmt.Printf("Category:    %s\n", a.Category)

				mode := "read/write"
				if a.Annotations.Readonly {
					mode = "readonly"
				}
				if a.Annotations.Destructive {
					mode += ", destructive"
				}
				if a.Annotations.Idempotent {
					mode += ", idempotent"
				}
				fmt.Printf("Mode:        %s\n", mode)

				if a.InputSchema != nil && len(a.InputSchema) > 0 {
					schemaJSON, _ := json.MarshalIndent(a.InputSchema, "", "  ")
					fmt.Printf("\nInput Schema:\n%s\n", string(schemaJSON))
				}
				if a.OutputSchema != nil && len(a.OutputSchema) > 0 {
					schemaJSON, _ := json.MarshalIndent(a.OutputSchema, "", "  ")
					fmt.Printf("\nOutput Schema:\n%s\n", string(schemaJSON))
				}

				fmt.Printf("\nExecute: POST %s/wp-json/wp-abilities/v1/%s/run\n",
					strings.TrimRight(cfg.Site.URL, "/"), name)
				return nil
			}
		}

		return fmt.Errorf("ability %q not found", name)
	},
}

var abilitiesCategoriesCmd = &cobra.Command{
	Use:   "categories",
	Short: "List ability categories",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		cats, err := c.GetAbilityCategories()
		if err != nil {
			return fmt.Errorf("failed to fetch categories: %w", err)
		}

		if len(cats) == 0 {
			fmt.Fprintln(os.Stderr, "No ability categories found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintf(w, "SLUG\tLABEL\tDESCRIPTION\n")
		for _, cat := range cats {
			fmt.Fprintf(w, "%s\t%s\t%s\n", cat.Slug, cat.Label, cat.Description)
		}
		w.Flush()
		return nil
	},
}

func init() {
	abilitiesListCmd.Flags().String("category", "", "filter by category slug")
	abilitiesListCmd.Flags().Bool("json", false, "output as JSON")

	abilitiesCmd.AddCommand(abilitiesListCmd)
	abilitiesCmd.AddCommand(abilitiesDescribeCmd)
	abilitiesCmd.AddCommand(abilitiesCategoriesCmd)
	rootCmd.AddCommand(abilitiesCmd)
}
```

**Step 3: Run tests**

Run: `cd cli && go test ./cmd/ -run TestAbilities -v && go test ./... && go vet ./...`
Expected: All pass

**Step 4: Commit**

```bash
git add cli/cmd/abilities.go cli/cmd/abilities_test.go
git commit -m "feat(cli): add bricks abilities command group

New commands: abilities list, abilities describe, abilities categories.
Discovers capabilities from all plugins via WordPress Abilities API.
Graceful fallback on pre-WP 6.9 sites."
```

---

## Task 6: Website — WordPress Abilities API Guide

**Files:**
- Create: `website/src/content/docs/guides/wordpress-abilities.md`
- Modify: `website/astro.config.mjs:124-131` (add to sidebar)

**Step 1: Write the guide**

Create `website/src/content/docs/guides/wordpress-abilities.md`:

```markdown
---
title: WordPress Abilities API
description: How Agent to Bricks integrates with the WordPress Abilities API to make your site discoverable by any AI agent.
---

Starting with WordPress 6.9, the [Abilities API](https://developer.wordpress.org/apis/abilities-api/) provides a standardized way for plugins to register machine-readable capabilities. Agent to Bricks registers all its operations as abilities, making your Bricks site discoverable by any AI tool that speaks the Abilities protocol.

This means Claude, ChatGPT, Codex, and any custom agent can discover what your site can do — not just through Agent to Bricks, but through every plugin that supports abilities.

## What gets registered

When your site runs WordPress 6.9+ with Agent to Bricks, these abilities become available:

| Category | Abilities | Description |
|----------|-----------|-------------|
| `agent-bricks-site` | `get-site-info`, `get-frameworks`, `list-element-types`, `list-pages` | Site configuration and metadata |
| `agent-bricks-pages` | `get-page-elements`, `replace-page-elements`, `append-page-elements`, `patch-page-elements`, `delete-page-elements`, `search-elements` | Read and write Bricks page content |
| `agent-bricks-pages` | `list-snapshots`, `create-snapshot`, `rollback-snapshot` | Version control for page content |
| `agent-bricks-design` | `list-classes`, `create-class`, `delete-class`, `get-styles`, `get-variables` | Design system access |
| `agent-bricks-content` | `list-templates`, `list-components`, `get-component`, `upload-media` | Content and media management |

Each ability includes JSON schemas for inputs and outputs, behavioral annotations (readonly, destructive, idempotent), and permission checks.

## Discovering abilities from the CLI

List all abilities registered on your site:

```bash
bricks abilities list
```

```
ABILITY                                LABEL                    MODE

[agent-bricks-design]
agent-bricks/list-classes              List Global Classes      readonly
agent-bricks/create-class              Create Global Class      read/write
agent-bricks/get-styles                Get Theme Styles         readonly
agent-bricks/get-variables             Get CSS Variables        readonly

[agent-bricks-pages]
agent-bricks/get-page-elements         Get Page Elements        readonly
agent-bricks/replace-page-elements     Replace Page Elements    destructive
agent-bricks/append-page-elements      Append Page Elements     read/write
...

[seo]
yoast/get-seo-meta                     Get SEO Meta             readonly
yoast/set-seo-meta                     Set SEO Meta             read/write
```

Notice the last category — that's from Yoast SEO, not Agent to Bricks. The CLI discovers abilities from **all** plugins.

Filter by category:

```bash
bricks abilities list --category agent-bricks-pages
```

Get full details and schemas for a specific ability:

```bash
bricks abilities describe agent-bricks/get-page-elements
```

```
Name:        agent-bricks/get-page-elements
Label:       Get Page Elements
Description: Retrieves all Bricks elements for a page.
Category:    agent-bricks-pages
Mode:        readonly

Input Schema:
{
  "type": "object",
  "properties": {
    "page_id": { "type": "integer" }
  },
  "required": ["page_id"]
}

Output Schema:
{
  "type": "object",
  "properties": {
    "elements": { "type": "array" },
    "contentHash": { "type": "string" },
    "count": { "type": "integer" }
  }
}

Execute: POST https://example.com/wp-json/wp-abilities/v1/agent-bricks/get-page-elements/run
```

## Including abilities in LLM context

Add the `--abilities` flag to include discovered abilities in the agent context:

```bash
bricks agent context --format prompt --abilities
```

This adds a "Site Abilities" section to the context output. The LLM sees abilities from all plugins — Agent to Bricks, Yoast, WooCommerce, Gravity Forms, or anything else that registers abilities. It can then mix and match:

- Build a Bricks page using ATB abilities
- Set SEO meta using Yoast abilities
- Create a WooCommerce product using WC abilities

All from the same conversation.

For the JSON format:

```bash
bricks agent context --format json --abilities
```

Or just the abilities section:

```bash
bricks agent context --section abilities
```

## Calling abilities directly (HTTP)

Any tool that can make HTTP requests can execute abilities. The WordPress Abilities REST API lives at `/wp-json/wp-abilities/v1/`.

### Discover available abilities

```bash
curl -H "X-ATB-Key: YOUR_KEY" \
  https://example.com/wp-json/wp-abilities/v1/abilities
```

### Execute a readonly ability

```bash
curl -H "X-ATB-Key: YOUR_KEY" \
  "https://example.com/wp-json/wp-abilities/v1/agent-bricks/get-site-info/run"
```

### Execute a write ability

```bash
curl -X POST \
  -H "X-ATB-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"page_id": 42}}' \
  "https://example.com/wp-json/wp-abilities/v1/agent-bricks/get-page-elements/run"
```

### Execute abilities from other plugins

```bash
curl -X POST \
  -H "X-ATB-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"post_id": 42, "title": "My Page Title", "description": "A great page"}}' \
  "https://example.com/wp-json/wp-abilities/v1/yoast/set-seo-meta/run"
```

## Authentication

The Abilities API supports standard WordPress authentication methods:

- **X-ATB-Key header** — works with Agent to Bricks abilities (same key as the custom REST API)
- **WordPress Application Passwords** — works with all abilities from any plugin
- **Cookie authentication** — for same-origin browser requests

For the best experience across all plugins' abilities, consider setting up a [WordPress Application Password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/) alongside your ATB API key.

## Requirements

- WordPress 6.9 or later
- Agent to Bricks plugin v1.8.0+
- No additional configuration needed — abilities are registered automatically

On WordPress versions before 6.9, the abilities features are simply not available. The plugin's custom REST API (`/wp-json/agent-bricks/v1/`) continues to work on all supported WordPress versions.

## How it works

Agent to Bricks registers abilities using WordPress's [`wp_register_ability()`](https://developer.wordpress.org/reference/functions/wp_register_ability/) function. Each ability wraps an existing REST endpoint handler, so there's zero duplication — the same code handles both the custom REST API and the abilities interface.

The registration is conditional: if `wp_register_ability_category` doesn't exist (pre-6.9), the plugin skips abilities setup entirely.

## Related

- [Bring your own agent](/guides/bring-your-own-agent/) — How to connect any AI tool to your Bricks site
- [REST API reference](/plugin/rest-api/) — The custom ATB REST API (works on all WP versions)
- [Agent commands](/cli/agent-commands/) — The `bricks agent context` command
- [WordPress Abilities API documentation](https://developer.wordpress.org/apis/abilities-api/) — Official WordPress developer docs
- [Abilities REST endpoints](https://developer.wordpress.org/apis/abilities-api/rest-api-endpoints/) — Official REST reference
```

**Step 2: Add to sidebar**

In `website/astro.config.mjs`, in the Guides sidebar section (lines 122-131), add `'guides/wordpress-abilities'` after `'guides/bring-your-own-agent'`:

Change:
```js
          items: [
            'guides/bring-your-own-agent',
            'guides/working-with-templates',
```

To:
```js
          items: [
            'guides/bring-your-own-agent',
            'guides/wordpress-abilities',
            'guides/working-with-templates',
```

**Step 3: Build website to verify**

Run: `cd website && npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add website/src/content/docs/guides/wordpress-abilities.md website/astro.config.mjs
git commit -m "docs(website): add WordPress Abilities API integration guide

Covers ability discovery, CLI commands, LLM context integration,
HTTP examples, and auth. Links to WordPress and Bricks documentation."
```

---

## Task 7: Website — Update Existing Docs

**Files:**
- Modify: `website/src/content/docs/cli/agent-commands.md` (add --abilities flag + abilities section)
- Modify: `website/src/content/docs/guides/bring-your-own-agent.md` (add abilities mention)
- Modify: `website/src/content/docs/plugin/rest-api.md` (add abilities note)

**Step 1: Update agent-commands.md**

Add the `--abilities` flag to the flags table (after `--section` row):

```markdown
| `--abilities` | Include WordPress Abilities from all plugins (WP 6.9+) |
```

Add a new section before "## When to use this":

```markdown
## Including WordPress Abilities

If your WordPress site runs 6.9 or later, you can include abilities from all plugins in the context:

`​``bash
bricks agent context --format prompt --abilities
`​``

This adds a "Site Abilities" section listing every ability on the site — from Agent to Bricks, Yoast, WooCommerce, or any other plugin that supports the [WordPress Abilities API](https://developer.wordpress.org/apis/abilities-api/). Your AI agent can then use these abilities alongside the standard ATB workflows.

See the [WordPress Abilities guide](/guides/wordpress-abilities/) for details.
```

Add to "## Related commands" section:

```markdown
- [`bricks abilities list`](/guides/wordpress-abilities/): discover abilities from all plugins
```

**Step 2: Update bring-your-own-agent.md**

Add a new section before "## Tips for better results" (~line 212):

```markdown
## Discovering abilities from other plugins

If your site runs WordPress 6.9+, you can include abilities from all installed plugins in the context:

`​``bash
bricks agent context --format prompt --abilities
`​``

This lets your AI agent see what Yoast, WooCommerce, Gravity Forms, or any other abilities-enabled plugin can do. The agent can mix and match — build a page with Bricks, set SEO meta with Yoast, and create a product with WooCommerce, all in one session.

See the [WordPress Abilities guide](/guides/wordpress-abilities/) for the full details.
```

**Step 3: Update plugin/rest-api.md**

Add a note at the top of the file (after the description paragraph):

```markdown
:::note[WordPress 6.9+ — Abilities API]
All operations listed below are also registered as [WordPress Abilities](/guides/wordpress-abilities/) on sites running WordPress 6.9+. This makes them discoverable by any AI agent via the standard `/wp-json/wp-abilities/v1/` endpoints. The custom REST API documented here continues to work on all WordPress versions.
:::
```

**Step 4: Build website**

Run: `cd website && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add website/src/content/docs/cli/agent-commands.md \
        website/src/content/docs/guides/bring-your-own-agent.md \
        website/src/content/docs/plugin/rest-api.md
git commit -m "docs(website): update existing docs with Abilities API references

Add --abilities flag to agent commands docs, cross-reference in
bring-your-own-agent guide, add Starlight note to REST API reference."
```

---

## Task 8: CLI — Add `abilities` to Site Info Output

**Files:**
- Modify: `cli/cmd/site.go` (add abilities count to `site info` output)

**Step 1: Update site info command**

In `cli/cmd/site.go`, in the `site info` RunE handler, after printing the current site info, add:

```go
		// Check abilities support
		abilities, err := c.GetAbilities("")
		if err == nil && len(abilities) > 0 {
			// Count ATB vs third-party
			atbCount := 0
			thirdPartyCount := 0
			for _, a := range abilities {
				if strings.HasPrefix(a.Name, "agent-bricks/") {
					atbCount++
				} else {
					thirdPartyCount++
				}
			}
			fmt.Printf("Abilities API:   %d abilities (%d ATB, %d third-party)\n", len(abilities), atbCount, thirdPartyCount)
		}
```

Add `"strings"` import if not already present.

**Step 2: Run tests**

Run: `cd cli && go test ./... && go vet ./...`
Expected: All pass

**Step 3: Commit**

```bash
git add cli/cmd/site.go
git commit -m "feat(cli): show abilities count in site info output

Displays total abilities count with ATB vs third-party breakdown.
Only shown when site supports WordPress Abilities API (6.9+)."
```

---

---

## Task 10: Plugin Admin — Abilities Status Indicator

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-settings.php:359-368` (About section)

**Step 1: Add abilities status to the About section**

In `plugin/agent-to-bricks/includes/class-settings.php`, in the About section (around line 359), add after the version display:

```php
<?php
// AI Discovery status (WordPress Abilities API)
if ( function_exists( 'wp_register_ability_category' ) ) {
    $atb_count = 0;
    if ( function_exists( 'wp_get_abilities' ) ) {
        $all_abilities = wp_get_abilities();
        foreach ( $all_abilities as $ability ) {
            if ( strpos( $ability->get_name(), 'agent-bricks/' ) === 0 ) {
                $atb_count++;
            }
        }
    }
    echo '<p><strong>AI Discovery:</strong> <span style="color: #22c55e;">Active</span></p>';
    echo '<p style="color: #9ca3af; font-size: 0.85em;">';
    echo 'AI tools like ChatGPT, Claude, and Codex can automatically discover what your site can do. ';
    echo esc_html( $atb_count ) . ' Agent to Bricks actions are registered. ';
    echo 'Powered by the <a href="https://developer.wordpress.org/apis/abilities-api/" target="_blank">WordPress Abilities API</a> (6.9+). ';
    echo '<a href="https://agenttobricks.com/guides/wordpress-abilities/" target="_blank">Learn more →</a>';
    echo '</p>';
} else {
    echo '<p><strong>AI Discovery:</strong> <span style="color: #9ca3af;">Not available</span></p>';
    echo '<p style="color: #9ca3af; font-size: 0.85em;">';
    echo 'Upgrade to WordPress 6.9 or later to let AI tools automatically discover your site\'s capabilities. ';
    echo '<a href="https://agenttobricks.com/guides/wordpress-abilities/" target="_blank">Learn more →</a>';
    echo '</p>';
}
?>
```

**Step 2: PHP lint**

Run: `php -l plugin/agent-to-bricks/includes/class-settings.php`
Expected: No syntax errors

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-settings.php
git commit -m "feat(plugin): show Abilities API status on settings page

Displays active/inactive status, ability count, and category count.
Links to documentation. Shows WP version requirement when unavailable."
```

---

## Task 11: GUI — Abilities Discovery Tauri Command

**Files:**
- Modify: `gui/src-tauri/src/lib.rs` (add `get_abilities` command + register it)

**Step 1: Add the Tauri command**

In `gui/src-tauri/src/lib.rs`, add a new `#[tauri::command]` function near the other `get_*` commands (around line 600, before `test_site_connection`):

```rust
#[derive(serde::Deserialize, serde::Serialize)]
struct AbilityAnnotations {
    #[serde(default)]
    readonly: bool,
    #[serde(default)]
    destructive: bool,
    #[serde(default)]
    idempotent: bool,
}

#[derive(serde::Deserialize, serde::Serialize)]
struct AbilityInfo {
    name: String,
    label: String,
    description: String,
    category: String,
    #[serde(default)]
    annotations: Option<AbilityAnnotations>,
    #[serde(default)]
    input_schema: Option<serde_json::Value>,
    #[serde(default)]
    output_schema: Option<serde_json::Value>,
}

#[tauri::command]
async fn get_abilities(
    http: tauri::State<'_, HttpClient>,
    site_url: String,
    api_key: String,
    category: Option<String>,
) -> Result<Vec<AbilityInfo>, String> {
    let base = site_url.trim_end_matches('/');
    let path = match &category {
        Some(cat) => format!("/wp-json/wp-abilities/v1/abilities?category={}", cat),
        None => "/wp-json/wp-abilities/v1/abilities".to_string(),
    };
    let url = format!("{}{}", base, path);

    match http.0.get(&url).header("X-ATB-Key", &api_key).send().await {
        Ok(resp) => {
            if resp.status().as_u16() == 404 {
                // WP < 6.9 — abilities not supported, return empty
                return Ok(vec![]);
            }
            if !resp.status().is_success() {
                return Err(format!("Abilities API returned status {}", resp.status()));
            }
            resp.json::<Vec<AbilityInfo>>().await
                .map_err(|e| format!("Failed to parse abilities: {}", e))
        }
        Err(e) => {
            // Network error — don't block, just return empty
            eprintln!("Could not fetch abilities: {}", e);
            Ok(vec![])
        }
    }
}
```

**Step 2: Register the command**

In the `invoke_handler` builder (around line 700), add `get_abilities` to the handler list:

Change:
```rust
    .invoke_handler(tauri::generate_handler![
        detect_environment,
        detect_tool,
        get_shell_env,
        get_platform_shell,
        search_pages,
        test_site_connection,
        get_page_elements,
        search_elements,
        get_global_classes,
        get_site_styles,
        get_site_variables,
        get_components,
        get_templates,
        get_media,
        config::read_config,
        config::write_config,
        config::config_exists
    ])
```

To:
```rust
    .invoke_handler(tauri::generate_handler![
        detect_environment,
        detect_tool,
        get_shell_env,
        get_platform_shell,
        search_pages,
        test_site_connection,
        get_page_elements,
        search_elements,
        get_global_classes,
        get_site_styles,
        get_site_variables,
        get_components,
        get_templates,
        get_media,
        get_abilities,
        config::read_config,
        config::write_config,
        config::config_exists
    ])
```

**Step 3: Verify build**

Run: `cd gui && npm run build`
Expected: TypeScript + Rust build succeeds

**Step 4: Commit**

```bash
git add gui/src-tauri/src/lib.rs
git commit -m "feat(gui): add get_abilities Tauri command

Discovers WordPress Abilities from all plugins via /wp-abilities/v1/.
Returns empty on pre-6.9 sites or network errors (non-blocking).
Supports optional category filter."
```

---

## Task 12: GUI — Inject Abilities Into Session Pre-Prompt

**Files:**
- Modify: `gui/src/atoms/app.ts:48-56` (extend pre-prompt template)
- Create: `gui/src/hooks/useAbilities.ts` (abilities fetch hook)
- Modify: `gui/src/components/context/ToolReference.tsx` (add abilities commands)

**Step 1: Create the abilities hook**

Create `gui/src/hooks/useAbilities.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAtomValue } from 'jotai';
import { activeSiteAtom } from '../atoms/app';

interface AbilityAnnotations {
  readonly: boolean;
  destructive: boolean;
  idempotent: boolean;
}

export interface AbilityInfo {
  name: string;
  label: string;
  description: string;
  category: string;
  annotations?: AbilityAnnotations;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

export function useAbilities() {
  const site = useAtomValue(activeSiteAtom);
  const [abilities, setAbilities] = useState<AbilityInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAbilities = useCallback(async () => {
    if (!site?.url || !site?.apiKey) {
      setAbilities([]);
      return;
    }
    setLoading(true);
    try {
      const result = await invoke<AbilityInfo[]>('get_abilities', {
        siteUrl: site.url,
        apiKey: site.apiKey,
      });
      setAbilities(result);
    } catch {
      setAbilities([]);
    } finally {
      setLoading(false);
    }
  }, [site?.url, site?.apiKey]);

  useEffect(() => {
    fetchAbilities();
  }, [fetchAbilities]);

  const atbAbilities = abilities.filter(a => a.name.startsWith('agent-bricks/'));
  const thirdPartyAbilities = abilities.filter(a => !a.name.startsWith('agent-bricks/'));

  return {
    abilities,
    atbAbilities,
    thirdPartyAbilities,
    loading,
    hasAbilities: abilities.length > 0,
    refresh: fetchAbilities,
  };
}
```

**Step 2: Update session pre-prompt**

In `gui/src/atoms/app.ts`, update the pre-prompt template (lines 48-56):

Change:
```typescript
export const sessionPrePromptAtom = atom(
  `You are a web developer working with a Bricks Builder WordPress site ({environment}).
Site: {site_url}
API Key: {api_key}
The bricks CLI is available. Use \`bricks\` commands to pull, push, generate, and modify page elements.
Use the API key with the X-ATB-Key header when making API calls to the site.`
);
```

To:
```typescript
export const sessionPrePromptAtom = atom(
  `You are a web developer working with a Bricks Builder WordPress site ({environment}).
Site: {site_url}
API Key: {api_key}
The bricks CLI is available. Use \`bricks\` commands to pull, push, generate, and modify page elements.
Use the API key with the X-ATB-Key header when making API calls to the site.
{abilities_block}`
);
```

Then, wherever the pre-prompt is resolved (the component that substitutes `{site_url}`, `{api_key}`, etc.), add abilities block substitution. The `{abilities_block}` placeholder gets replaced with either an empty string (no abilities) or a formatted abilities list.

The abilities block format when populated:

```typescript
function formatAbilitiesBlock(abilities: AbilityInfo[]): string {
  if (abilities.length === 0) return '';

  const grouped = abilities.reduce<Record<string, AbilityInfo[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const atbCount = abilities.filter(a => a.name.startsWith('agent-bricks/')).length;
  const thirdPartyCount = abilities.length - atbCount;

  let block = `

## WordPress Abilities (${abilities.length} total)

WordPress 6.9+ lets plugins register "abilities" — named actions you can discover and
execute via a standard REST API. Each has typed inputs/outputs and permission checks.

Why this matters: beyond the bricks CLI commands, you can also call abilities from other
plugins installed on this site (SEO, e-commerce, forms, etc.) without any extra setup.

When to use abilities vs. the bricks CLI:
- For Bricks page editing (elements, snapshots, classes): use \`bricks\` CLI commands —
  they handle optimistic locking and are purpose-built.
- For anything outside Bricks (SEO, products, forms): use abilities — they're the only way.
- To discover what the site can do: \`bricks abilities list\`

How to call: POST /wp-json/wp-abilities/v1/{name}/run with {"input": {...}}
Read-only abilities also accept GET. Auth: X-ATB-Key header.
`;

  for (const [cat, items] of Object.entries(grouped).sort()) {
    block += `\n[${cat}]\n`;
    for (const a of items) {
      const method = a.annotations?.readonly ? 'GET ' : 'POST';
      block += `  ${method} ${a.name} — ${a.label}\n`;
      if (a.description) {
        block += `       ${a.description}\n`;
      }
    }
  }
  return block;
}
```

**Step 3: Add abilities commands to ToolReference**

In `gui/src/components/context/ToolReference.tsx`, find the `claude-code` entry in `TOOL_REFERENCES` and add to its `commands` array:

```typescript
{ cmd: 'bricks abilities list', desc: 'Discover all abilities on the site (WP 6.9+)' },
{ cmd: 'bricks abilities describe <name>', desc: 'Show ability details and JSON schemas' },
```

Also add to the `tips` array:

```typescript
'Use `bricks agent context --abilities` to include abilities from all plugins in the LLM context.',
```

Do the same for `codex` and `opencode` entries.

**Step 4: Verify build**

Run: `cd gui && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add gui/src/hooks/useAbilities.ts gui/src/atoms/app.ts gui/src/components/context/ToolReference.tsx
git commit -m "feat(gui): inject discovered abilities into session pre-prompts

New useAbilities hook fetches from Tauri backend.
Session pre-prompt includes abilities block when site is WP 6.9+.
ToolReference shows bricks abilities commands."
```

---

## Task 13: Website — Update GUI Docs

**Files:**
- Modify: `website/src/content/docs/gui/prompt-composer.md` (mention abilities in pre-prompt)
- Modify: `website/src/content/docs/gui/managing-tools.md` (mention abilities commands in tool reference)

**Step 1: Update prompt-composer.md**

Add a section about abilities integration (after the session pre-prompt documentation):

```markdown
### Abilities discovery

If your WordPress site runs version 6.9 or later, the session pre-prompt automatically includes abilities from all installed plugins. This means when you launch Claude Code or Codex through the GUI, the AI already knows what Yoast, WooCommerce, Gravity Forms, or any other abilities-enabled plugin can do.

The abilities are discovered from the WordPress [Abilities API](https://developer.wordpress.org/apis/abilities-api/) and formatted as a list of available actions with their HTTP methods and names.

See the [WordPress Abilities guide](/guides/wordpress-abilities/) for more details.
```

**Step 2: Update managing-tools.md**

Add a note about the abilities commands in the tool command reference section:

```markdown
The tool reference panel also includes `bricks abilities` commands when the site supports WordPress 6.9+:

- `bricks abilities list` — Discover all abilities on the site
- `bricks abilities describe <name>` — Show ability details and JSON schemas
```

**Step 3: Build website**

Run: `cd website && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add website/src/content/docs/gui/prompt-composer.md website/src/content/docs/gui/managing-tools.md
git commit -m "docs(website): update GUI docs with abilities integration

Document auto-discovery in session pre-prompts and abilities commands
in tool reference panel."
```

---

## Task 14: Verification & Integration Testing (Updated)

**Step 1: Run full CLI test suite**

Run: `cd cli && go test ./... -v`
Expected: All tests pass, including new abilities tests

**Step 2: Run go vet**

Run: `cd cli && go vet ./...`
Expected: No issues

**Step 3: PHP lint the plugin**

Run: `for f in plugin/agent-to-bricks/**/*.php; do php -l "$f"; done`
Expected: No syntax errors

**Step 4: Build the GUI**

Run: `cd gui && npm run build`
Expected: TypeScript + Rust build succeeds

**Step 5: Build the website**

Run: `cd website && npm run build`
Expected: Build succeeds

**Step 6: Check version consistency**

Run: `make check-version`
Expected: All versions match

**Step 7: Commit any fixes from verification**

Only if needed.

---

## Summary of All Changes

### Plugin (PHP)
| File | Action | Description |
|------|--------|-------------|
| `plugin/agent-to-bricks/includes/class-abilities-api.php` | Create | 22 abilities across 4 categories, execute callbacks delegate to existing controllers |
| `plugin/agent-to-bricks/agent-to-bricks.php` | Modify | Add require + init call |
| `plugin/agent-to-bricks/includes/class-settings.php` | Modify | Add Abilities API status indicator to About section |

### CLI (Go)
| File | Action | Description |
|------|--------|-------------|
| `cli/internal/client/client.go` | Modify | Add Ability/AbilityCategory types, GetAbilities(), GetAbilityCategories() |
| `cli/internal/client/abilities_test.go` | Create | Test abilities client methods |
| `cli/internal/agent/context.go` | Modify | Add AbilityInfo type, AddAbilities(), writeAbilitiesSection() |
| `cli/internal/agent/context_test.go` | Modify | Add abilities test cases |
| `cli/cmd/agent.go` | Modify | Add --abilities flag, fetch abilities in context |
| `cli/cmd/abilities.go` | Create | New `bricks abilities list/describe/categories` commands |
| `cli/cmd/abilities_test.go` | Create | Test abilities commands exist |
| `cli/cmd/site.go` | Modify | Show abilities count in site info |

### GUI (Rust + React/TS)
| File | Action | Description |
|------|--------|-------------|
| `gui/src-tauri/src/lib.rs` | Modify | Add `get_abilities` Tauri command + AbilityInfo struct, register in handler |
| `gui/src/hooks/useAbilities.ts` | Create | React hook for abilities discovery via Tauri IPC |
| `gui/src/atoms/app.ts` | Modify | Add `{abilities_block}` placeholder to session pre-prompt |
| `gui/src/components/context/ToolReference.tsx` | Modify | Add `bricks abilities` commands to tool reference |

### Website (Docs)
| File | Action | Description |
|------|--------|-------------|
| `website/src/content/docs/guides/wordpress-abilities.md` | Create | Full guide: discovery, CLI, HTTP, auth, references |
| `website/astro.config.mjs` | Modify | Add to sidebar |
| `website/src/content/docs/cli/agent-commands.md` | Modify | Add --abilities flag docs |
| `website/src/content/docs/guides/bring-your-own-agent.md` | Modify | Add abilities cross-reference |
| `website/src/content/docs/plugin/rest-api.md` | Modify | Add Abilities API note |
| `website/src/content/docs/gui/prompt-composer.md` | Modify | Document abilities auto-discovery in pre-prompts |
| `website/src/content/docs/gui/managing-tools.md` | Modify | Document abilities commands in tool reference |

### External References Included
- [WordPress Abilities API](https://developer.wordpress.org/apis/abilities-api/)
- [Abilities REST Endpoints](https://developer.wordpress.org/apis/abilities-api/rest-api-endpoints/)
- [wp_register_ability()](https://developer.wordpress.org/reference/functions/wp_register_ability/)
- [PHP Reference](https://developer.wordpress.org/apis/abilities-api/php-reference/)
- [WordPress Application Passwords](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)
- [Bricks Builder](https://academy.bricksbuilder.io/)
