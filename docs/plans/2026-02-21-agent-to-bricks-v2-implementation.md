# Agent to Bricks v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an open-source system (WordPress plugin + Go CLI) for programmatically building Bricks Builder pages via AI agents, with ACSS-aware generation, delta patching, and WP-CLI integration.

**Architecture:** Thin WordPress plugin (lifecycle-aware REST API gateway to Bricks) + Smart Go CLI (single binary handling LLM orchestration, template management, CSS framework awareness). Plugin handles Bricks CRUD + lifecycle. CLI handles intelligence.

**Tech Stack:** PHP 7.4+ (plugin), Go 1.22+ (CLI), SQLite (embedded vector DB + learning), JSON Schema (validation), WordPress REST API + Application Passwords (auth)

**Staging Site:** `https://ts-staging.wavedepth.com` (Bricks 2.2, ACSS installed, post ID 1297 for testing)

**Testing Strategy:** Full TDD. PHP tests via WP-CLI `wp eval` and direct REST API calls (curl). Go tests via `go test`. Integration tests via Chrome DevTools MCP against live site. Every feature gets a test BEFORE implementation.

---

## Phase 1: Plugin Core — Element CRUD + Lifecycle Engine

The foundation everything else builds on. Refactor existing plugin from LLM-centric endpoints to Bricks CRUD primitives with lifecycle awareness.

### Task 1: Scaffold Plugin v2 Structure

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-elements-api.php`
- Create: `plugin/agent-to-bricks/includes/class-bricks-lifecycle.php`
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php`
- Create: `tests/plugin/test-elements-api.sh` (curl-based integration tests)

**Step 1: Write the integration test script**

```bash
#!/usr/bin/env bash
# tests/plugin/test-elements-api.sh
# Integration tests for elements API against live staging site
# Usage: ./tests/plugin/test-elements-api.sh

set -euo pipefail

BASE_URL="${WP_STAGING_URL:-https://ts-staging.wavedepth.com}"
AUTH="${WP_STAGING_USER}:${WP_STAGING_PASS}"
API="$BASE_URL/wp-json/agent-bricks/v1"
TEST_PAGE=1297

echo "=== Agent to Bricks: Elements API Tests ==="
echo "Target: $BASE_URL"

# Test 1: GET /pages/{id}/elements returns elements + contentHash
echo -n "TEST 1: GET elements... "
RESPONSE=$(curl -s -w "\n%{http_code}" -u "$AUTH" "$API/pages/$TEST_PAGE/elements")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
    echo "FAIL (HTTP $HTTP_CODE)"
    echo "$BODY" | head -5
    exit 1
fi

# Check response has elements array and contentHash
HAS_ELEMENTS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'elements' in d and isinstance(d['elements'], list) else 'no')")
HAS_HASH=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'contentHash' in d and len(d.get('contentHash',''))>0 else 'no')")

if [ "$HAS_ELEMENTS" = "yes" ] && [ "$HAS_HASH" = "yes" ]; then
    ELEMENT_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['elements']))")
    HASH=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['contentHash'])")
    echo "PASS ($ELEMENT_COUNT elements, hash=$HASH)"
else
    echo "FAIL (missing elements or contentHash)"
    exit 1
fi

echo ""
echo "All tests passed!"
```

**Step 2: Run test to verify it fails**

```bash
chmod +x tests/plugin/test-elements-api.sh
source .env && ./tests/plugin/test-elements-api.sh
```

Expected: FAIL with HTTP 404 (endpoint doesn't exist yet)

**Step 3: Create Bricks lifecycle helper class**

```php
<?php
// plugin/agent-to-bricks/includes/class-bricks-lifecycle.php
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Bricks_Lifecycle {

    /**
     * Get the correct post meta key for Bricks content.
     */
    public static function content_meta_key() {
        if ( defined( 'BRICKS_VERSION' ) && version_compare( BRICKS_VERSION, '1.7.3', '>=' ) ) {
            return '_bricks_page_content_2';
        }
        return '_bricks_page_content';
    }

    /**
     * Read page elements from post meta.
     * Returns [ 'elements' => array, 'contentHash' => string ]
     */
    public static function read_elements( $post_id ) {
        $meta_key = self::content_meta_key();
        $elements = get_post_meta( $post_id, $meta_key, true );
        if ( ! is_array( $elements ) ) {
            $elements = array();
        }
        $hash = md5( maybe_serialize( $elements ) );
        return array(
            'elements'    => $elements,
            'contentHash' => $hash,
        );
    }

    /**
     * Write page elements to post meta + trigger Bricks lifecycle.
     * Returns new contentHash on success, WP_Error on failure.
     */
    public static function write_elements( $post_id, $elements, $expected_hash = null ) {
        // Optimistic locking: verify content hasn't changed since client read it
        if ( $expected_hash !== null ) {
            $current = self::read_elements( $post_id );
            if ( $current['contentHash'] !== $expected_hash ) {
                return new WP_Error(
                    'content_conflict',
                    'Content has been modified since you last read it. Re-fetch and try again.',
                    array(
                        'status'      => 409,
                        'currentHash' => $current['contentHash'],
                    )
                );
            }
        }

        $meta_key = self::content_meta_key();
        update_post_meta( $post_id, $meta_key, $elements );

        // Trigger Bricks CSS regeneration
        self::regenerate_css( $post_id );

        // Clear Bricks caches
        self::clear_cache( $post_id );

        // Fire action for other plugins
        do_action( 'agent_bricks_content_updated', $post_id, $elements );

        $new_hash = md5( maybe_serialize( $elements ) );
        return $new_hash;
    }

    /**
     * Regenerate Bricks CSS file for a post.
     */
    public static function regenerate_css( $post_id ) {
        if ( class_exists( '\Bricks\Assets' ) ) {
            if ( method_exists( '\Bricks\Assets', 'generate_css_file' ) ) {
                \Bricks\Assets::generate_css_file( $post_id );
            }
        }
    }

    /**
     * Clear Bricks-related caches for a post.
     */
    public static function clear_cache( $post_id ) {
        // Delete Bricks transients
        delete_transient( 'bricks_' . $post_id );

        // Clear object cache for this post
        wp_cache_delete( $post_id, 'post_meta' );
        clean_post_cache( $post_id );
    }
}
```

**Step 4: Create Elements API class with GET endpoint**

```php
<?php
// plugin/agent-to-bricks/includes/class-elements-api.php
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Elements_API {

    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    public static function register_routes() {
        // GET /pages/{id}/elements
        register_rest_route( 'agent-bricks/v1', '/pages/(?P<id>\d+)/elements', array(
            array(
                'methods'             => 'GET',
                'callback'            => array( __CLASS__, 'get_elements' ),
                'permission_callback' => array( __CLASS__, 'check_read_permission' ),
            ),
        ) );
    }

    public static function check_read_permission( $request ) {
        $post_id = (int) $request->get_param( 'id' );
        return current_user_can( 'edit_post', $post_id );
    }

    public static function get_elements( $request ) {
        $post_id = (int) $request->get_param( 'id' );

        if ( ! get_post( $post_id ) ) {
            return new WP_REST_Response( array(
                'error' => 'Post not found.',
            ), 404 );
        }

        $data = ATB_Bricks_Lifecycle::read_elements( $post_id );

        return new WP_REST_Response( array(
            'elements'    => $data['elements'],
            'contentHash' => $data['contentHash'],
            'count'       => count( $data['elements'] ),
            'metaKey'     => ATB_Bricks_Lifecycle::content_meta_key(),
        ), 200 );
    }
}
```

**Step 5: Wire up new classes in main plugin file**

Add to `agent-to-bricks.php` after existing requires:
```php
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-bricks-lifecycle.php';
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-elements-api.php';
```

Add to `agent_bricks_init()`:
```php
ATB_Elements_API::init();
```

**Step 6: Deploy to staging and run test**

```bash
# Zip and upload plugin to staging
cd plugin && zip -r agent-to-bricks.zip agent-to-bricks/ && cd ..
# Upload via WP admin or WP-CLI
source .env && ./tests/plugin/test-elements-api.sh
```

Expected: PASS (elements returned with contentHash)

**Step 7: Verify via Chrome DevTools**

Navigate to `https://ts-staging.wavedepth.com/?p=1297&bricks=run` in Chrome.
Use Chrome DevTools MCP to take a snapshot and verify the page loads correctly.

**Step 8: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-bricks-lifecycle.php \
        plugin/agent-to-bricks/includes/class-elements-api.php \
        plugin/agent-to-bricks/agent-to-bricks.php \
        tests/plugin/test-elements-api.sh
git commit -m "feat(plugin): add elements GET endpoint with content hash and lifecycle engine"
```

---

### Task 2: Delta Patching with Optimistic Locking

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-elements-api.php`
- Modify: `tests/plugin/test-elements-api.sh`

**Step 1: Add delta patch tests to test script**

Append to `tests/plugin/test-elements-api.sh`:
```bash
# Test 2: PATCH /pages/{id}/elements - delta patch with valid hash
echo -n "TEST 2: PATCH delta (valid hash)... "

# First, GET current state to get hash and first element ID
GET_RESP=$(curl -s -u "$AUTH" "$API/pages/$TEST_PAGE/elements")
HASH=$(echo "$GET_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['contentHash'])")
FIRST_ID=$(echo "$GET_RESP" | python3 -c "import sys,json; els=json.load(sys.stdin)['elements']; print(els[0]['id'] if els else 'none')")

if [ "$FIRST_ID" = "none" ]; then
    echo "SKIP (no elements on page)"
else
    # Read the original text so we can restore it
    ORIG_TEXT=$(echo "$GET_RESP" | python3 -c "
import sys,json
els=json.load(sys.stdin)['elements']
el=[e for e in els if e['id']=='$FIRST_ID'][0]
print(el.get('settings',{}).get('text','') if isinstance(el.get('settings'),dict) else '')
")

    # Patch: change first element's label
    PATCH_RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
        -u "$AUTH" \
        -H "Content-Type: application/json" \
        -H "If-Match: $HASH" \
        -d "{\"patches\":[{\"id\":\"$FIRST_ID\",\"label\":\"ATB Test Label\"}]}" \
        "$API/pages/$TEST_PAGE/elements")
    PATCH_CODE=$(echo "$PATCH_RESP" | tail -1)
    PATCH_BODY=$(echo "$PATCH_RESP" | sed '$d')

    if [ "$PATCH_CODE" = "200" ]; then
        NEW_HASH=$(echo "$PATCH_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('contentHash',''))")
        echo "PASS (new hash=$NEW_HASH)"

        # Restore: patch back the original label
        curl -s -X PATCH -u "$AUTH" \
            -H "Content-Type: application/json" \
            -H "If-Match: $NEW_HASH" \
            -d "{\"patches\":[{\"id\":\"$FIRST_ID\",\"label\":null}]}" \
            "$API/pages/$TEST_PAGE/elements" > /dev/null
    else
        echo "FAIL (HTTP $PATCH_CODE)"
        echo "$PATCH_BODY" | head -5
        exit 1
    fi
fi

# Test 3: PATCH with stale hash should return 409
echo -n "TEST 3: PATCH delta (stale hash -> 409)... "
STALE_RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
    -u "$AUTH" \
    -H "Content-Type: application/json" \
    -H "If-Match: stale_hash_value" \
    -d "{\"patches\":[{\"id\":\"$FIRST_ID\",\"label\":\"Should Fail\"}]}" \
    "$API/pages/$TEST_PAGE/elements")
STALE_CODE=$(echo "$STALE_RESP" | tail -1)

if [ "$STALE_CODE" = "409" ]; then
    echo "PASS (correctly rejected stale hash)"
else
    echo "FAIL (expected 409, got $STALE_CODE)"
    exit 1
fi

# Test 4: PATCH without If-Match header should return 428
echo -n "TEST 4: PATCH without If-Match -> 428... "
NO_MATCH_RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
    -u "$AUTH" \
    -H "Content-Type: application/json" \
    -d "{\"patches\":[{\"id\":\"$FIRST_ID\",\"label\":\"No Match\"}]}" \
    "$API/pages/$TEST_PAGE/elements")
NO_MATCH_CODE=$(echo "$NO_MATCH_RESP" | tail -1)

if [ "$NO_MATCH_CODE" = "428" ]; then
    echo "PASS (correctly requires If-Match)"
else
    echo "FAIL (expected 428, got $NO_MATCH_CODE)"
    exit 1
fi
```

**Step 2: Run tests to verify they fail**

```bash
source .env && ./tests/plugin/test-elements-api.sh
```

Expected: Tests 2-4 FAIL (PATCH endpoint doesn't exist)

**Step 3: Implement PATCH endpoint**

Add to `register_routes()` in `class-elements-api.php`:
```php
// PATCH /pages/{id}/elements — delta patch
register_rest_route( 'agent-bricks/v1', '/pages/(?P<id>\d+)/elements', array(
    array(
        'methods'             => 'GET',
        'callback'            => array( __CLASS__, 'get_elements' ),
        'permission_callback' => array( __CLASS__, 'check_read_permission' ),
    ),
    array(
        'methods'             => 'PATCH',
        'callback'            => array( __CLASS__, 'patch_elements' ),
        'permission_callback' => array( __CLASS__, 'check_write_permission' ),
    ),
) );
```

Add methods:
```php
public static function check_write_permission( $request ) {
    $post_id = (int) $request->get_param( 'id' );
    return current_user_can( 'edit_post', $post_id );
}

public static function patch_elements( $request ) {
    $post_id = (int) $request->get_param( 'id' );

    if ( ! get_post( $post_id ) ) {
        return new WP_REST_Response( array( 'error' => 'Post not found.' ), 404 );
    }

    // Require If-Match header for optimistic locking
    $if_match = $request->get_header( 'if_match' );
    if ( empty( $if_match ) ) {
        return new WP_REST_Response( array(
            'error' => 'If-Match header required. GET the elements first to obtain contentHash.',
        ), 428 );
    }

    $body    = $request->get_json_params();
    $patches = $body['patches'] ?? array();

    if ( empty( $patches ) ) {
        return new WP_REST_Response( array( 'error' => 'No patches provided.' ), 400 );
    }

    // Read current elements
    $current  = ATB_Bricks_Lifecycle::read_elements( $post_id );
    $elements = $current['elements'];

    // Build index by ID
    $index = array();
    foreach ( $elements as $i => $el ) {
        if ( isset( $el['id'] ) ) {
            $index[ $el['id'] ] = $i;
        }
    }

    // Apply patches
    $patched_ids = array();
    foreach ( $patches as $patch ) {
        $el_id = $patch['id'] ?? null;
        if ( ! $el_id || ! isset( $index[ $el_id ] ) ) {
            return new WP_REST_Response( array(
                'error' => "Element '$el_id' not found on page.",
            ), 404 );
        }

        $idx = $index[ $el_id ];

        // Merge patch fields into element (shallow merge for top-level, deep for settings)
        foreach ( $patch as $key => $value ) {
            if ( $key === 'id' ) continue;

            if ( $key === 'settings' && is_array( $value ) ) {
                // Deep merge settings
                if ( ! isset( $elements[ $idx ]['settings'] ) || ! is_array( $elements[ $idx ]['settings'] ) ) {
                    $elements[ $idx ]['settings'] = array();
                }
                foreach ( $value as $skey => $sval ) {
                    if ( $sval === null ) {
                        unset( $elements[ $idx ]['settings'][ $skey ] );
                    } else {
                        $elements[ $idx ]['settings'][ $skey ] = $sval;
                    }
                }
            } else {
                if ( $value === null ) {
                    unset( $elements[ $idx ][ $key ] );
                } else {
                    $elements[ $idx ][ $key ] = $value;
                }
            }
        }

        $patched_ids[] = $el_id;
    }

    // Write with optimistic locking
    $result = ATB_Bricks_Lifecycle::write_elements( $post_id, $elements, $if_match );

    if ( is_wp_error( $result ) ) {
        $data = $result->get_error_data();
        return new WP_REST_Response( array(
            'error'       => $result->get_error_message(),
            'currentHash' => $data['currentHash'] ?? '',
        ), $data['status'] ?? 409 );
    }

    return new WP_REST_Response( array(
        'success'     => true,
        'contentHash' => $result,
        'patched'     => $patched_ids,
        'count'       => count( $patched_ids ),
    ), 200 );
}
```

**Step 4: Deploy and run tests**

```bash
cd plugin && zip -r agent-to-bricks.zip agent-to-bricks/ && cd ..
source .env && ./tests/plugin/test-elements-api.sh
```

Expected: All 4 tests PASS

**Step 5: Verify CSS regeneration via Chrome DevTools**

After patching, check that `/uploads/bricks/css/post-1297.css` was regenerated:
1. Open Chrome DevTools on the staging site frontend (not editor)
2. Check Network tab for `post-1297.css` — should have fresh timestamp
3. Visually verify the patched element reflects the change

**Step 6: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-elements-api.php tests/plugin/
git commit -m "feat(plugin): add delta patching with optimistic locking (If-Match/409)"
```

---

### Task 3: Element Append, Delete, Full Replace, and Batch

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-elements-api.php`
- Modify: `tests/plugin/test-elements-api.sh`

**Step 1: Write tests for POST (append), DELETE, PUT (replace), and batch**

Add to test script:
```bash
# Test 5: POST /pages/{id}/elements — append elements
echo -n "TEST 5: POST append element... "
GET_RESP=$(curl -s -u "$AUTH" "$API/pages/$TEST_PAGE/elements")
HASH=$(echo "$GET_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['contentHash'])")
COUNT_BEFORE=$(echo "$GET_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['count'])")

POST_RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -u "$AUTH" \
    -H "Content-Type: application/json" \
    -H "If-Match: $HASH" \
    -d '{
        "elements": [{
            "id": "atbtest",
            "name": "heading",
            "parent": 0,
            "children": [],
            "settings": {"text": "ATB Test Heading", "tag": "h2"}
        }]
    }' \
    "$API/pages/$TEST_PAGE/elements")
POST_CODE=$(echo "$POST_RESP" | tail -1)

if [ "$POST_CODE" = "200" ] || [ "$POST_CODE" = "201" ]; then
    NEW_HASH=$(echo "$POST_RESP" | sed '$d' | python3 -c "import sys,json; print(json.load(sys.stdin)['contentHash'])")
    echo "PASS (appended, new hash=$NEW_HASH)"

    # Test 6: DELETE the element we just added
    echo -n "TEST 6: DELETE element... "
    DEL_RESP=$(curl -s -w "\n%{http_code}" -X DELETE \
        -u "$AUTH" \
        -H "Content-Type: application/json" \
        -H "If-Match: $NEW_HASH" \
        -d '{"ids": ["atbtest"]}' \
        "$API/pages/$TEST_PAGE/elements")
    DEL_CODE=$(echo "$DEL_RESP" | tail -1)

    if [ "$DEL_CODE" = "200" ]; then
        echo "PASS (deleted)"
    else
        echo "FAIL (HTTP $DEL_CODE)"
        exit 1
    fi
else
    echo "FAIL (HTTP $POST_CODE)"
    exit 1
fi
```

**Step 2: Run to verify fail, then implement POST/DELETE/PUT/batch endpoints**

POST appends elements to the content array (with optional `parentId` and `insertAfter` targeting).
DELETE removes elements by ID array (and removes from parent's children array).
PUT replaces entire content (full replace, still requires If-Match).
Batch: `POST /pages/{id}/elements/batch` accepts `{ "operations": [{ "op": "append|patch|delete", ... }] }`.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat(plugin): add element append, delete, full replace, and batch operations"
```

---

### Task 4: Snapshot and Rollback

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-snapshots-api.php`
- Create: `tests/plugin/test-snapshots.sh`

**Step 1: Write snapshot tests**

```bash
# Test: Create snapshot, modify page, rollback, verify restored
echo -n "TEST: Snapshot -> modify -> rollback... "

# Create snapshot
SNAP_RESP=$(curl -s -w "\n%{http_code}" -X POST -u "$AUTH" \
    -H "Content-Type: application/json" \
    "$API/pages/$TEST_PAGE/snapshot")
# ... modify page ...
# Rollback
ROLL_RESP=$(curl -s -w "\n%{http_code}" -X POST -u "$AUTH" \
    -H "Content-Type: application/json" \
    "$API/pages/$TEST_PAGE/rollback")
# Verify elements match pre-modification state
```

**Step 2: Implement**

Snapshots stored in `_agent_bricks_snapshots` post meta as array of `{ timestamp, contentHash, elements }`. Max 10 snapshots per page (FIFO).

**Step 3: Test, commit**

```bash
git commit -m "feat(plugin): add snapshot/rollback with auto-cleanup"
```

---

### Task 5: Global Classes CRUD

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-classes-api.php`
- Create: `tests/plugin/test-classes.sh`

**Step 1: Write tests**

```bash
# GET /classes — list all, verify ACSS classes have framework flag
# POST /classes — create a test class
# PATCH /classes/{id} — update settings
# DELETE /classes/{id} — delete the test class
```

**Step 2: Implement**

Read/write `bricks_global_classes` from `wp_options`. Each class returned with a `framework` field (`acss` if starts with `acss_import_`, `custom` otherwise, `locked` if immutable).

**Step 3: Test, commit**

```bash
git commit -m "feat(plugin): add global classes CRUD with framework flags"
```

---

### Task 6: Theme Styles, CSS Variables, and Site Info

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-styles-api.php`
- Create: `plugin/agent-to-bricks/includes/class-site-api.php`
- Create: `tests/plugin/test-styles.sh`
- Create: `tests/plugin/test-site-info.sh`

**Step 1: Write tests**

```bash
# GET /styles — returns theme styles + color palette
# PUT /styles — update (test with restore)
# GET /variables — CSS custom properties
# GET /site/info — Bricks version, meta key, element types
# GET /site/frameworks — detect ACSS, return class inventory
```

**Step 2: Implement**

`/site/info` returns:
```json
{
    "bricksVersion": "2.2",
    "contentMetaKey": "_bricks_page_content_2",
    "elementTypes": ["section", "container", "heading", ...],
    "breakpoints": { "desktop": 1920, "laptop": 1366, ... },
    "pluginVersion": "2.0.0"
}
```

`/site/frameworks` detects ACSS:
```php
// Check if ACSS is active
$frameworks = array();
if ( is_plugin_active( 'flavor-of-acss/automaticcss-plugin.php' ) ||
     is_plugin_active( 'flavor-of-acss-pro/automaticcss-plugin.php' ) ) {
    // Read ACSS options (discover keys from plugin inspection)
    $acss_options = get_option( 'automaticcss_options', array() );
    $frameworks['acss'] = array(
        'name'      => 'Automatic.css',
        'active'    => true,
        'options'   => $acss_options,  // Full options for CLI to parse
        'classes'   => self::get_acss_classes(),  // Filtered from global classes
    );
}
```

NOTE: The exact ACSS option key needs to be discovered by inspecting the ACSS plugin on the staging server. Use `wp option list --search='*acss*' --format=json` or `wp option list --search='*automatic*' --format=json` via WP-CLI to find them.

**Step 3: Test against live site, verify ACSS detected**

**Step 4: Commit**

```bash
git commit -m "feat(plugin): add styles, variables, site info, and framework detection endpoints"
```

---

### Task 7: Templates CRUD

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-templates-api.php`
- Create: `tests/plugin/test-templates.sh`

**Step 1: Write tests**

```bash
# GET /templates — list bricks_template posts
# POST /templates — create template from element JSON
# GET /templates/{id} — get template content
```

**Step 2: Implement**

Uses `bricks_template` custom post type. Create via `wp_insert_post` + meta.

**Step 3: Test, commit**

```bash
git commit -m "feat(plugin): add templates CRUD endpoint"
```

---

## Phase 2: ACSS Discovery (Server Inspection)

### Task 8: Inspect ACSS Plugin on Staging Server

**Files:**
- Create: `docs/acss-internals.md`

**Step 1: Use WP-CLI or REST API to discover ACSS options**

```bash
# Via WP-CLI if available, or via a temporary REST endpoint
# Find all ACSS-related options
wp option list --search='*acss*' --format=json --ssh=user@ts-staging.wavedepth.com
wp option list --search='*automatic*' --format=json --ssh=user@ts-staging.wavedepth.com
wp option list --search='*jetonaut*' --format=json --ssh=user@ts-staging.wavedepth.com
```

**Step 2: If WP-CLI not available, create temporary discovery endpoint**

Add temporary endpoint to plugin:
```php
register_rest_route( 'agent-bricks/v1', '/debug/acss', array(
    'methods'  => 'GET',
    'callback' => function() {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT option_name, LENGTH(option_value) as val_len
             FROM {$wpdb->options}
             WHERE option_name LIKE '%acss%'
                OR option_name LIKE '%automatic%'
                OR option_name LIKE '%jetonaut%'
             ORDER BY option_name"
        );
        return new WP_REST_Response( $rows );
    },
    'permission_callback' => function() { return current_user_can('manage_options'); },
) );
```

**Step 3: Document findings in `docs/acss-internals.md`**

Record: option keys, data structures, variable names, class categories.

**Step 4: Update framework detection endpoint with real option keys**

**Step 5: Remove temporary debug endpoint, commit**

```bash
git commit -m "docs: document ACSS wp_options structure and update framework detection"
```

---

## Phase 3: Go CLI Foundation

### Task 9: Go Module Setup + Config + HTTP Client

**Files:**
- Create: `cli/go.mod`
- Create: `cli/go.sum`
- Create: `cli/main.go`
- Create: `cli/cmd/root.go`
- Create: `cli/cmd/config.go`
- Create: `cli/internal/client/client.go`
- Create: `cli/internal/client/client_test.go`
- Create: `cli/internal/config/config.go`
- Create: `cli/internal/config/config_test.go`

**Step 1: Initialize Go module**

```bash
mkdir -p cli && cd cli
go mod init github.com/nerveband/agent-to-bricks
```

**Step 2: Write failing test for config**

```go
// cli/internal/config/config_test.go
package config_test

import (
    "os"
    "path/filepath"
    "testing"

    "github.com/nerveband/agent-to-bricks/internal/config"
)

func TestLoadConfig(t *testing.T) {
    tmpDir := t.TempDir()
    cfgPath := filepath.Join(tmpDir, "config.yaml")

    // Write minimal config
    os.WriteFile(cfgPath, []byte(`
site:
  url: https://example.com
  username: admin
  app_password: xxxx
`), 0644)

    cfg, err := config.Load(cfgPath)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if cfg.Site.URL != "https://example.com" {
        t.Errorf("expected URL https://example.com, got %s", cfg.Site.URL)
    }
}
```

**Step 3: Run to verify fail**

```bash
cd cli && go test ./internal/config/ -v
```

Expected: FAIL (package doesn't exist)

**Step 4: Implement config package**

```go
// cli/internal/config/config.go
package config

import (
    "os"
    "path/filepath"

    "gopkg.in/yaml.v3"
)

type Config struct {
    Site  SiteConfig  `yaml:"site"`
    WPCLI WPCLIConfig `yaml:"wpcli"`
    LLM   LLMConfig   `yaml:"llm"`
}

type SiteConfig struct {
    URL         string `yaml:"url"`
    Username    string `yaml:"username"`
    AppPassword string `yaml:"app_password"`
}

type WPCLIConfig struct {
    Mode string `yaml:"mode"` // "local", "ssh", "disabled"
    SSH  string `yaml:"ssh"`
    Path string `yaml:"path"`
}

type LLMConfig struct {
    Provider string  `yaml:"provider"`
    APIKey   string  `yaml:"api_key"`
    Model    string  `yaml:"model"`
    BaseURL  string  `yaml:"base_url"`
    Temp     float64 `yaml:"temperature"`
}

func DefaultPath() string {
    home, _ := os.UserHomeDir()
    return filepath.Join(home, ".agent-to-bricks", "config.yaml")
}

func Load(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    var cfg Config
    if err := yaml.Unmarshal(data, &cfg); err != nil {
        return nil, err
    }
    return &cfg, nil
}

func (c *Config) Save(path string) error {
    data, err := yaml.Marshal(c)
    if err != nil {
        return err
    }
    os.MkdirAll(filepath.Dir(path), 0755)
    return os.WriteFile(path, data, 0644)
}
```

**Step 5: Run test, verify pass**

```bash
cd cli && go test ./internal/config/ -v
```

**Step 6: Write failing test for HTTP client**

```go
// cli/internal/client/client_test.go
package client_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/nerveband/agent-to-bricks/internal/client"
)

func TestGetElements(t *testing.T) {
    // Mock server
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/wp-json/agent-bricks/v1/pages/1297/elements" {
            t.Errorf("unexpected path: %s", r.URL.Path)
        }
        if r.Method != "GET" {
            t.Errorf("unexpected method: %s", r.Method)
        }
        // Check auth header
        user, pass, ok := r.BasicAuth()
        if !ok || user != "admin" || pass != "secret" {
            w.WriteHeader(401)
            return
        }
        json.NewEncoder(w).Encode(map[string]interface{}{
            "elements":    []interface{}{},
            "contentHash": "abc123",
            "count":       0,
        })
    }))
    defer srv.Close()

    c := client.New(srv.URL, "admin", "secret")
    resp, err := c.GetElements(1297)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if resp.ContentHash != "abc123" {
        t.Errorf("expected hash abc123, got %s", resp.ContentHash)
    }
}
```

**Step 7: Implement client, run test, verify pass**

**Step 8: Wire up CLI with cobra, implement `bricks config init/set/get/list` and `bricks site info`**

**Step 9: Commit**

```bash
git commit -m "feat(cli): Go CLI foundation - config, HTTP client, site info command"
```

---

### Task 10: Site Commands (pull, push, patch, snapshot, rollback)

**Files:**
- Create: `cli/cmd/site.go`
- Create: `cli/internal/client/elements.go`
- Create: `cli/internal/client/elements_test.go`

**Step 1: Write tests for client methods (GetElements, PatchElements, AppendElements, DeleteElements, ReplaceElements)**

**Step 2: Implement client methods**

**Step 3: Wire up CLI commands**

```
bricks site pull 1297 -o page.json          # GET → save to file
bricks site push 1297 page.json             # PUT (full replace)
bricks site patch 1297 --element abc123 --set text="Hello"  # PATCH
bricks site patch 1297 -f patches.json      # PATCH from file
bricks site snapshot 1297                    # Create snapshot
bricks site rollback 1297                   # Rollback
```

**Step 4: Integration test against staging site**

```bash
cd cli && go build -o bricks .
./bricks config set site.url https://ts-staging.wavedepth.com
./bricks config set site.username "Tayseer Administrator"
./bricks config set site.app_password "..."
./bricks site info
./bricks site pull 1297 -o /tmp/test-page.json
# Verify JSON file has elements
```

**Step 5: Commit**

```bash
git commit -m "feat(cli): site commands - pull, push, patch, snapshot, rollback"
```

---

### Task 11: Validation Engine (Go port + extensions)

**Files:**
- Create: `cli/internal/validator/validator.go`
- Create: `cli/internal/validator/validator_test.go`
- Create: `cli/cmd/validate.go`

**Step 1: Write comprehensive validation tests**

Test cases:
- Valid minimal element (just `name`)
- Missing `name` field → error
- Invalid element type → error
- Section inside container → nesting violation
- Orphaned parent reference → error
- Mismatched parent/children → error
- Dynamic data tags (`{post_title}`) → valid
- `_cssGlobalClasses` with valid IDs → valid
- Media with attachment ID → valid
- Media with bare URL → warning

**Step 2: Implement validator**

Port logic from PHP `class-element-validator.php` + add:
- Strict nesting hierarchy (Section > Container > Block/Div > content)
- Dynamic data tag whitelist
- Media reference validation
- Bidirectional parent/children check

**Step 3: Wire up `bricks validate page.json` command**

**Step 4: Test against real template JSON from test-data/**

```bash
./bricks validate test-data/templates/hero-section/hero-section-alpha.json
```

**Step 5: Commit**

```bash
git commit -m "feat(cli): validation engine with nesting, dynamic data, and media checks"
```

---

## Phase 4: CSS Framework Registry + ACSS

### Task 12: Framework Registry Implementation

**Files:**
- Create: `cli/internal/framework/registry.go`
- Create: `cli/internal/framework/registry_test.go`
- Create: `cli/internal/framework/acss.json`
- Create: `cli/cmd/frameworks.go`

**Step 1: Write tests**

```go
func TestLoadACSS(t *testing.T) {
    reg, err := framework.LoadRegistry("testdata/frameworks")
    if err != nil { t.Fatal(err) }

    acss := reg.Get("acss")
    if acss == nil { t.Fatal("ACSS not found") }
    if acss.SpacingVariable("m") != "--space-m" { t.Error("wrong spacing var") }
    if acss.ButtonClass("primary") != "btn--primary" { t.Error("wrong button class") }
    if acss.BricksClassID("btn--primary") != "acss_import_btn--primary" { t.Error("wrong bricks ID") }
}
```

**Step 2: Implement registry**

- Loads JSON config files from `~/.agent-to-bricks/frameworks/`
- Methods: `SpacingVariable(size)`, `ButtonClass(variant)`, `BricksClassID(name)`, `AllUtilityClasses()`, `AllVariables()`
- `SyncFromSite(client)` — calls `/site/frameworks` and merges server-side data

**Step 3: Ship ACSS config as embedded default**

Embed `acss.json` in the Go binary using `//go:embed`. Users can override with local file.

**Step 4: Wire up `bricks site frameworks` command**

```bash
./bricks site frameworks
# Output:
# Automatic.css (acss) — active
#   58 utility classes, 6 spacing variables, 5 color families
#   Spacing: --space-xs, --space-s, --space-m, --space-l, --space-xl, --space-xxl
#   Colors: --primary, --secondary, --accent, --base, --neutral
```

**Step 5: Commit**

```bash
git commit -m "feat(cli): CSS framework registry with embedded ACSS config"
```

---

## Phase 5: Template Engine + Vector Search

### Task 13: Template BYOT Engine

**Files:**
- Create: `cli/internal/templates/catalog.go`
- Create: `cli/internal/templates/catalog_test.go`
- Create: `cli/internal/templates/composer.go`
- Create: `cli/internal/templates/composer_test.go`
- Create: `cli/cmd/templates.go`
- Create: `cli/cmd/compose.go`

**Step 1: Write tests for catalog (load, list, search)**

Port logic from Python `catalog.py`.

**Step 2: Write tests for composer (merge, ID remap, class dedup)**

Port logic from Python `composer.py`. Key: deterministic ID remapping to avoid collisions.

**Step 3: Implement and wire up commands**

```
bricks templates list
bricks templates show hero-alpha
bricks templates import ./my-templates/
bricks templates learn 1297          # Pull page, split into sections, save as templates
bricks compose hero-alpha feature-grid-bravo footer-charlie -o page.json
```

**Step 4: Test with real template JSON from test-data/**

**Step 5: Commit**

```bash
git commit -m "feat(cli): template BYOT engine with catalog, composer, and learn-from-page"
```

---

### Task 14: Vector Search (Embedded SQLite)

**Files:**
- Create: `cli/internal/embeddings/indexer.go`
- Create: `cli/internal/embeddings/searcher.go`
- Create: `cli/internal/embeddings/indexer_test.go`
- Create: `cli/cmd/index.go`

**Step 1: Write tests for indexing and search**

**Step 2: Implement using SQLite + Go vector library**

Evaluate: `github.com/asg017/sqlite-vec` (SQLite vector extension) or custom HNSW in Go.

**Step 3: Wire up commands**

```
bricks templates index              # Build/rebuild index
bricks templates search "dark hero with CTA"
```

**Step 4: Commit**

```bash
git commit -m "feat(cli): embedded vector search for templates (SQLite-backed)"
```

---

## Phase 6: LLM Orchestration + Generation

### Task 15: LLM Client

**Files:**
- Create: `cli/internal/llm/client.go`
- Create: `cli/internal/llm/client_test.go`
- Create: `cli/internal/llm/prompt.go`
- Create: `cli/internal/llm/prompt_test.go`

**Step 1: Write tests for prompt builder**

Test that system prompt includes:
- Element schema reference
- Active framework classes/variables
- Style profile preferences
- RAG template examples
- Available media

**Step 2: Implement OpenAI-compatible client + prompt builder**

**Step 3: Commit**

```bash
git commit -m "feat(cli): LLM client with framework-aware prompt builder"
```

---

### Task 16: Generate Commands

**Files:**
- Create: `cli/cmd/generate.go`
- Create: `cli/internal/generate/section.go`
- Create: `cli/internal/generate/page.go`
- Create: `cli/internal/generate/modify.go`

**Step 1: Implement generate section/page/modify commands**

```
bricks generate section "dark hero with centered text and two CTA buttons" --page 1297 --framework acss
bricks generate page "SaaS landing page" --page 1297 --framework acss --dry-run
bricks generate modify "make the heading larger and change color to primary" --page 1297 --element abc123
```

Flow: build context → call LLM → validate output → push (or dry-run)

**Step 2: Integration test against staging site**

Generate a test section, push to page 1297, verify via Chrome DevTools that it appears correctly with ACSS classes.

**Step 3: Commit**

```bash
git commit -m "feat(cli): generate section/page/modify with ACSS-aware prompts"
```

---

## Phase 7: WP-CLI Integration + Media

### Task 17: WP-CLI Orchestration

**Files:**
- Create: `cli/internal/wpcli/wpcli.go`
- Create: `cli/internal/wpcli/wpcli_test.go`
- Create: `cli/cmd/media.go`

**Step 1: Write tests for WP-CLI wrapper**

```go
func TestDetectWPCLI(t *testing.T) {
    // Test local mode, SSH mode, disabled mode
}

func TestMediaImport(t *testing.T) {
    // Test parsing wp media import --porcelain output
}
```

**Step 2: Implement WP-CLI wrapper**

- Detect mode from config
- Execute commands via `exec.Command`
- Parse output (especially `--porcelain` for IDs)
- Graceful fallback to REST API

**Step 3: Wire up media commands**

```
bricks media upload hero-bg.jpg --page 1297
bricks media list
bricks media search "logo"
```

**Step 4: Integration test**

Upload a test image, verify attachment ID returned, use in a generate command.

**Step 5: Commit**

```bash
git commit -m "feat(cli): WP-CLI integration with media upload/list/search"
```

---

## Phase 8: Converters + Doctor

### Task 18: HTML to Bricks Converter

**Files:**
- Create: `cli/internal/convert/html.go`
- Create: `cli/internal/convert/html_test.go`
- Create: `cli/cmd/convert.go`

**Step 1: Write tests with HTML fixtures**

```go
func TestConvertSimpleHTML(t *testing.T) {
    html := `<section><h1>Hello</h1><p>World</p></section>`
    elements, err := convert.HTMLToBricks(html)
    if err != nil { t.Fatal(err) }
    if len(elements) != 3 { t.Errorf("expected 3 elements, got %d", len(elements)) }
    if elements[0].Name != "section" { t.Error("first element should be section") }
}
```

**Step 2: Implement HTML parser → Bricks element mapper**

Use Go `html` package for parsing. Map tags to Bricks elements. Extract inline styles to settings.

**Step 3: Wire up `bricks convert html page.html -o elements.json`**

**Step 4: Commit**

```bash
git commit -m "feat(cli): HTML to Bricks converter"
```

---

### Task 19: Page Doctor

**Files:**
- Create: `cli/internal/doctor/doctor.go`
- Create: `cli/internal/doctor/doctor_test.go`
- Create: `cli/cmd/doctor.go`

**Step 1: Write tests for each health check**

- Orphaned elements (parent references non-existent ID)
- Broken class references
- Nesting violations
- Duplicate IDs
- Mismatched parent/children

**Step 2: Implement doctor checks**

**Step 3: Wire up `bricks doctor 1297`**

**Step 4: Integration test against staging site**

**Step 5: Commit**

```bash
git commit -m "feat(cli): page doctor health check"
```

---

## Phase 9: Style Profiles

### Task 20: Style Profile System

**Files:**
- Create: `cli/internal/styles/profile.go`
- Create: `cli/internal/styles/profile_test.go`
- Create: `cli/internal/styles/analyzer.go`

**Step 1: Write tests**

```go
func TestLoadProfile(t *testing.T) {
    // Load style-profile.json, verify defaults
}

func TestAnalyzePage(t *testing.T) {
    // Given page elements, extract frequency-ranked classes, spacing values, patterns
}
```

**Step 2: Implement**

- `profile.go`: Load/save `~/.agent-to-bricks/style-profile.json`
- `analyzer.go`: Analyze page elements → update profile with frequency data

**Step 3: Integrate with `bricks templates learn` command**

When learning from a page, also update the style profile.

**Step 4: Integrate with LLM prompt builder**

Include style preferences in system prompt context.

**Step 5: Commit**

```bash
git commit -m "feat(cli): style profiles with page analysis"
```

---

## Phase 10: Global Commands + Polish

### Task 21: Classes and Styles CLI Commands

**Files:**
- Create: `cli/cmd/classes.go`
- Create: `cli/cmd/styles.go`

**Step 1: Wire up remaining commands**

```
bricks classes list
bricks classes create my-card-style --settings '{"_padding":{"top":"20px"}}'
bricks classes find "btn--*"
bricks classes sync

bricks styles show
bricks styles colors
bricks styles variables
```

**Step 2: Integration test**

**Step 3: Commit**

```bash
git commit -m "feat(cli): classes and styles management commands"
```

---

### Task 22: Config Init Wizard

**Files:**
- Modify: `cli/cmd/config.go`

**Step 1: Implement interactive setup**

```
bricks config init

Welcome to Agent to Bricks!

Site URL: https://mysite.com
Username: admin
App Password: ****-****-****-****

Testing connection... OK (Bricks 2.2 detected)

CSS Framework detected: Automatic.css
Downloading ACSS class inventory... 58 classes loaded

WP-CLI available via SSH? (y/n): y
SSH connection: user@mysite.com
WordPress path: /var/www/html
Testing WP-CLI... OK

LLM Provider (cerebras/openrouter/ollama/custom): cerebras
API Key: ****

Config saved to ~/.agent-to-bricks/config.yaml
```

**Step 2: Test, commit**

```bash
git commit -m "feat(cli): interactive config init wizard with auto-detection"
```

---

### Task 23: Build Distribution

**Files:**
- Create: `cli/.goreleaser.yaml`
- Create: `Makefile`

**Step 1: Set up goreleaser for cross-platform builds**

Targets: linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64

**Step 2: Test local build**

```bash
cd cli && go build -o bricks . && ./bricks --version
```

**Step 3: Commit**

```bash
git commit -m "chore: add goreleaser config and Makefile for distribution"
```

---

## Phase 11: End-to-End Integration Testing

### Task 24: Full E2E Test Suite

**Files:**
- Create: `tests/e2e/test-full-workflow.sh`

**Step 1: Write comprehensive E2E test**

```bash
#!/usr/bin/env bash
# Full workflow: config → pull → generate → validate → push → verify → rollback
set -euo pipefail

echo "=== E2E Test: Full Agent to Bricks Workflow ==="

# 1. Config
./bricks config set site.url "$WP_STAGING_URL"
./bricks config set site.username "$WP_STAGING_USER"
./bricks config set site.app_password "$WP_STAGING_PASS"

# 2. Site info
./bricks site info

# 3. Pull current page
./bricks site pull 1297 -o /tmp/e2e-before.json

# 4. Validate pulled content
./bricks validate /tmp/e2e-before.json

# 5. Create snapshot
./bricks site snapshot 1297

# 6. Generate a test section (dry run first)
./bricks generate section "simple heading that says E2E Test" --page 1297 --dry-run

# 7. Push the section
./bricks generate section "simple heading that says E2E Test" --page 1297

# 8. Pull again, verify new element exists
./bricks site pull 1297 -o /tmp/e2e-after.json

# 9. Doctor check
./bricks doctor 1297

# 10. Rollback
./bricks site rollback 1297

# 11. Pull again, verify restored
./bricks site pull 1297 -o /tmp/e2e-restored.json

echo "=== E2E Test Complete ==="
```

**Step 2: Run against staging site**

**Step 3: Verify via Chrome DevTools**

Use Chrome DevTools MCP to:
1. Navigate to page 1297 on frontend
2. Take screenshot before and after generate
3. Verify element appears visually
4. Verify CSS is correct (ACSS classes applied)
5. Verify rollback restores original

**Step 4: Commit**

```bash
git commit -m "test: add full E2E integration test suite"
```

---

## Dependency Graph

```
Task 1 (scaffold) → Task 2 (delta patch) → Task 3 (append/delete/batch) → Task 4 (snapshots)
                                                                                ↓
Task 5 (classes) ──────────────────────────────────────────────────────→ Task 6 (styles/site info)
                                                                                ↓
Task 7 (templates API) ──────────────────────────────────────────────→ Task 8 (ACSS discovery)
                                                                                ↓
Task 9 (Go foundation) → Task 10 (site commands) → Task 11 (validator)
                                                                ↓
Task 12 (framework registry) → Task 13 (template engine) → Task 14 (vector search)
                                                                ↓
Task 15 (LLM client) → Task 16 (generate commands) → Task 17 (WP-CLI/media)
                                                                ↓
Task 18 (HTML converter) → Task 19 (doctor) → Task 20 (style profiles)
                                                                ↓
Task 21 (classes/styles CLI) → Task 22 (config wizard) → Task 23 (distribution)
                                                                ↓
                                                        Task 24 (E2E tests)
```

**Parallelizable:**
- Tasks 1-8 (plugin) can proceed independently of Tasks 9-23 (CLI)
- Within plugin: Tasks 5, 6, 7 can run in parallel after Task 4
- Within CLI: Tasks 12, 13 can run in parallel after Task 11

---

## Estimated Scope

| Phase | Tasks | Approx Effort |
|-------|-------|---------------|
| Phase 1: Plugin core | 1-4 | Foundation |
| Phase 2: Plugin introspection | 5-8 | Medium |
| Phase 3: Go CLI foundation | 9-10 | Foundation |
| Phase 4: Framework registry | 11-12 | Medium |
| Phase 5: Templates + search | 13-14 | Medium |
| Phase 6: LLM + generation | 15-16 | Large |
| Phase 7: WP-CLI + media | 17 | Medium |
| Phase 8: Converters + doctor | 18-19 | Medium |
| Phase 9: Style profiles | 20 | Small |
| Phase 10: Polish | 21-23 | Small |
| Phase 11: E2E testing | 24 | Medium |
