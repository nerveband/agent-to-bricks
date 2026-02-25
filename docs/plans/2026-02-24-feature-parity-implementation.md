# Feature Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cross-site element search, components listing, rich element type metadata, and bump PHP to 8.0 for public distribution readiness.

**Architecture:** Three new REST endpoints on the plugin side with corresponding Go CLI commands and client methods. Each feature follows the existing pattern: static PHP class with `init()` + `register_routes()`, Go `client.Client` method with httptest mock, cobra command with tabwriter output. TDD throughout.

**Tech Stack:** PHP 8.0+ (WordPress REST API), Go 1.22+ (cobra, httptest), ts-staging.wavedepth.com for integration tests.

**Testing on staging:** `ssh root@23.94.202.65` then `wp eval-file` in `/home/runcloud/webapps/TS-Staging`. After deploying PHP code: `systemctl restart php84rc-fpm` (OPcache has validate_timestamps=0).

---

## Task 1: PHP 8.0 Version Bump

**Files:**
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php:8`

**Step 1: Bump PHP requirement header**

In `plugin/agent-to-bricks/agent-to-bricks.php`, change line 8:

```php
// Old:
 * Requires PHP: 7.4
// New:
 * Requires PHP: 8.0
```

**Step 2: Verify existing tests still pass**

Run: `cd cli && go test ./...`
Expected: All 149 tests PASS (PHP change doesn't affect Go tests, but confirms no breakage)

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/agent-to-bricks.php
git commit -m "chore: bump PHP requirement from 7.4 to 8.0"
```

---

## Task 2: Search API — Plugin Endpoint (Red)

**Files:**
- Create: `tests/plugin/test-search-runner.php`

**Step 1: Write failing plugin test**

Create `tests/plugin/test-search-runner.php`:

```php
<?php
/**
 * ATB Search API test runner.
 * Run via: wp eval-file test-search-runner.php
 */
wp_set_current_user(1);

$GLOBALS['atb_rest_server'] = rest_get_server();

function dispatch_rest(string $method, string $route, array $params = [], array $headers = [], mixed $body = null): array {
    $server = $GLOBALS['atb_rest_server'];
    $request = new WP_REST_Request($method, $route);
    foreach ($params as $k => $v) $request->set_param($k, $v);
    foreach ($headers as $k => $v) $request->set_header($k, $v);
    if ($body !== null) {
        $request->set_body(json_encode($body));
        $request->set_header('content_type', 'application/json');
    }
    $response = $server->dispatch($request);
    return ['status' => $response->get_status(), 'data' => $response->get_data()];
}

$pass = 0;
$fail = 0;

// ===== Test 1: GET /search/elements returns 200 =====
echo "TEST 1: Search elements endpoint exists... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/search/elements');
if ($r['status'] === 200 && isset($r['data']['results']) && isset($r['data']['total'])) {
    echo "PASS (total={$r['data']['total']})\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

// ===== Test 2: Filter by element_type =====
echo "TEST 2: Filter by element_type=heading... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/search/elements', ['element_type' => 'heading']);
if ($r['status'] === 200) {
    $all_headings = true;
    foreach ($r['data']['results'] as $result) {
        if ($result['elementType'] !== 'heading') {
            $all_headings = false;
            break;
        }
    }
    if ($all_headings) {
        echo "PASS (" . count($r['data']['results']) . " headings found)\n";
        $pass++;
    } else {
        echo "FAIL (non-heading elements returned)\n";
        $fail++;
    }
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

// ===== Test 3: Filter by setting_key and setting_value =====
echo "TEST 3: Filter by setting_key=tag, setting_value=h1... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/search/elements', [
    'setting_key' => 'tag',
    'setting_value' => 'h1',
]);
if ($r['status'] === 200) {
    echo "PASS (" . count($r['data']['results']) . " results)\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

// ===== Test 4: Pagination =====
echo "TEST 4: Pagination with per_page=2... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/search/elements', [
    'element_type' => 'heading',
    'per_page' => 2,
    'page' => 1,
]);
if ($r['status'] === 200 && count($r['data']['results']) <= 2 && isset($r['data']['totalPages'])) {
    echo "PASS (page=1, results=" . count($r['data']['results']) . ", totalPages={$r['data']['totalPages']})\n";
    $pass++;
} else {
    echo "FAIL\n";
    $fail++;
}

// ===== Test 5: Response shape =====
echo "TEST 5: Response shape has required fields... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/search/elements', ['per_page' => 1]);
if ($r['status'] === 200 && count($r['data']['results']) > 0) {
    $first = $r['data']['results'][0];
    $has_fields = isset($first['postId'], $first['postTitle'], $first['postType'],
        $first['elementId'], $first['elementType']);
    if ($has_fields) {
        echo "PASS\n";
        $pass++;
    } else {
        echo "FAIL (missing fields in result)\n";
        $fail++;
    }
} else {
    echo "SKIP (no results to check shape)\n";
}

// ===== Test 6: Filter by post_type =====
echo "TEST 6: Filter by post_type=page... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/search/elements', ['post_type' => 'page']);
if ($r['status'] === 200) {
    $all_pages = true;
    foreach ($r['data']['results'] as $result) {
        if ($result['postType'] !== 'page') {
            $all_pages = false;
            break;
        }
    }
    echo ($all_pages ? "PASS" : "FAIL") . " (" . count($r['data']['results']) . " results)\n";
    $all_pages ? $pass++ : $fail++;
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
```

**Step 2: Deploy test to staging and verify it fails**

```bash
scp tests/plugin/test-search-runner.php root@23.94.202.65:/tmp/
ssh root@23.94.202.65 "cd /home/runcloud/webapps/TS-Staging && sudo -u runcloud wp eval-file /tmp/test-search-runner.php"
```
Expected: FAIL — route not registered, returns 404

---

## Task 3: Search API — Plugin Implementation (Green)

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-search-api.php`
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php` (add require + init)

**Step 1: Create the search API class**

Create `plugin/agent-to-bricks/includes/class-search-api.php`:

```php
<?php
/**
 * Cross-site element search REST API endpoint.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Search_API {

    public static function init(): void {
        add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
    }

    public static function register_routes(): void {
        register_rest_route( 'agent-bricks/v1', '/search/elements', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'search_elements' ],
            'permission_callback' => [ __CLASS__, 'check_permission' ],
        ] );
    }

    public static function check_permission(): bool {
        return current_user_can( 'edit_posts' );
    }

    /**
     * GET /search/elements — search elements across all Bricks content.
     */
    public static function search_elements( WP_REST_Request $request ): WP_REST_Response {
        $element_type  = $request->get_param( 'element_type' );
        $setting_key   = $request->get_param( 'setting_key' );
        $setting_value = $request->get_param( 'setting_value' );
        $global_class  = $request->get_param( 'global_class' );
        $post_type     = $request->get_param( 'post_type' );
        $per_page      = min( (int) ( $request->get_param( 'per_page' ) ?: 50 ), 100 );
        $page          = max( (int) ( $request->get_param( 'page' ) ?: 1 ), 1 );

        $meta_key = ATB_Bricks_Lifecycle::content_meta_key();

        // Query all posts with Bricks content
        $query_args = [
            'post_type'      => $post_type ?: [ 'page', 'post', 'bricks_template' ],
            'posts_per_page' => -1,
            'post_status'    => 'any',
            'meta_query'     => [
                [
                    'key'     => $meta_key,
                    'compare' => 'EXISTS',
                ],
            ],
            'fields' => 'ids',
        ];

        // If specific post type, use string not array
        if ( $post_type ) {
            $query_args['post_type'] = sanitize_text_field( $post_type );
        }

        $post_ids = get_posts( $query_args );

        // Resolve global class name to ID if needed
        $class_id = null;
        if ( $global_class ) {
            $class_id = self::resolve_class_id( $global_class );
        }

        $all_results = [];

        foreach ( $post_ids as $pid ) {
            $post     = get_post( $pid );
            $elements = get_post_meta( $pid, $meta_key, true );
            if ( ! is_array( $elements ) ) continue;

            foreach ( $elements as $el ) {
                if ( ! self::element_matches( $el, $element_type, $setting_key, $setting_value, $class_id, $global_class ) ) {
                    continue;
                }

                $all_results[] = [
                    'postId'       => $pid,
                    'postTitle'    => $post->post_title,
                    'postType'     => $post->post_type,
                    'elementId'    => $el['id'] ?? '',
                    'elementType'  => $el['name'] ?? '',
                    'elementLabel' => $el['label'] ?? '',
                    'settings'     => $el['settings'] ?? new \stdClass(),
                    'parentId'     => $el['parent'] ?? '',
                ];
            }
        }

        $total       = count( $all_results );
        $total_pages = (int) ceil( $total / $per_page );
        $offset      = ( $page - 1 ) * $per_page;
        $paged       = array_slice( $all_results, $offset, $per_page );

        return new WP_REST_Response( [
            'results'    => $paged,
            'total'      => $total,
            'page'       => $page,
            'perPage'    => $per_page,
            'totalPages' => $total_pages,
        ], 200 );
    }

    /**
     * Check if an element matches the search filters.
     */
    private static function element_matches(
        array $el,
        ?string $element_type,
        ?string $setting_key,
        ?string $setting_value,
        ?string $class_id,
        ?string $global_class
    ): bool {
        // Filter by element type
        if ( $element_type && ( $el['name'] ?? '' ) !== $element_type ) {
            return false;
        }

        $settings = $el['settings'] ?? [];

        // Filter by setting key
        if ( $setting_key && ! array_key_exists( $setting_key, $settings ) ) {
            return false;
        }

        // Filter by setting value (substring match)
        if ( $setting_value && $setting_key ) {
            $val = $settings[ $setting_key ] ?? '';
            if ( is_string( $val ) && ! str_contains( strtolower( $val ), strtolower( $setting_value ) ) ) {
                return false;
            }
        } elseif ( $setting_value && ! $setting_key ) {
            // Search all setting values
            $found = false;
            foreach ( $settings as $v ) {
                if ( is_string( $v ) && str_contains( strtolower( $v ), strtolower( $setting_value ) ) ) {
                    $found = true;
                    break;
                }
            }
            if ( ! $found ) return false;
        }

        // Filter by global class
        if ( $global_class ) {
            $el_classes = $settings['_cssGlobalClasses'] ?? [];
            if ( ! is_array( $el_classes ) ) return false;
            // Match by ID or by name (class_id resolved above)
            $matched = false;
            if ( $class_id && in_array( $class_id, $el_classes, true ) ) {
                $matched = true;
            }
            if ( ! $matched && in_array( $global_class, $el_classes, true ) ) {
                $matched = true;
            }
            if ( ! $matched ) return false;
        }

        return true;
    }

    /**
     * Resolve a global class name to its ID.
     */
    private static function resolve_class_id( string $name ): ?string {
        $classes = get_option( 'bricks_global_classes', [] );
        foreach ( $classes as $c ) {
            if ( ( $c['name'] ?? '' ) === $name ) {
                return $c['id'] ?? null;
            }
        }
        return null;
    }
}
```

**Step 2: Register the class in the main plugin file**

In `plugin/agent-to-bricks/agent-to-bricks.php`:

Add after line 36 (the update-checker require):
```php
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-search-api.php';
```

Add in `agent_bricks_init()` after `ATB_Update_Checker::init();`:
```php
ATB_Search_API::init();
```

**Step 3: Deploy to staging and run tests**

```bash
scp plugin/agent-to-bricks/includes/class-search-api.php root@23.94.202.65:/home/runcloud/webapps/TS-Staging/wp-content/plugins/agent-to-bricks/includes/
scp plugin/agent-to-bricks/agent-to-bricks.php root@23.94.202.65:/home/runcloud/webapps/TS-Staging/wp-content/plugins/agent-to-bricks/
ssh root@23.94.202.65 "systemctl restart php84rc-fpm"
ssh root@23.94.202.65 "cd /home/runcloud/webapps/TS-Staging && sudo -u runcloud wp eval-file /tmp/test-search-runner.php"
```
Expected: All 6 tests PASS

**Step 4: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-search-api.php plugin/agent-to-bricks/agent-to-bricks.php tests/plugin/test-search-runner.php
git commit -m "feat(search): add cross-site element search endpoint"
```

---

## Task 4: Search API — Go Client Method (Red then Green)

**Files:**
- Modify: `cli/internal/client/client.go` (add types + method)
- Modify: `cli/internal/client/client_test.go` (add tests)

**Step 1: Write failing Go test**

Add to `cli/internal/client/client_test.go`:

```go
func TestSearchElements(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/search/elements" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("expected GET, got %s", r.Method)
		}
		// Check query params
		if r.URL.Query().Get("element_type") != "heading" {
			t.Errorf("expected element_type=heading, got %s", r.URL.Query().Get("element_type"))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"results": []map[string]interface{}{
				{"postId": 42, "postTitle": "Home", "postType": "page", "elementId": "abc", "elementType": "heading"},
			},
			"total":      1,
			"page":       1,
			"perPage":    50,
			"totalPages": 1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.SearchElements(client.SearchParams{ElementType: "heading"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Total != 1 {
		t.Errorf("expected total 1, got %d", resp.Total)
	}
	if resp.Results[0].ElementType != "heading" {
		t.Errorf("expected heading, got %s", resp.Results[0].ElementType)
	}
}

func TestSearchElementsWithSettingFilter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("setting_key") != "tag" {
			t.Errorf("expected setting_key=tag")
		}
		if r.URL.Query().Get("setting_value") != "h1" {
			t.Errorf("expected setting_value=h1")
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"results": []map[string]interface{}{},
			"total": 0, "page": 1, "perPage": 50, "totalPages": 0,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.SearchElements(client.SearchParams{SettingKey: "tag", SettingValue: "h1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Total != 0 {
		t.Errorf("expected 0, got %d", resp.Total)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd cli && go test -run TestSearchElements -v ./internal/client/`
Expected: FAIL — `SearchElements` undefined, `SearchParams` undefined

**Step 3: Implement client types and method**

Add to `cli/internal/client/client.go`:

```go
// SearchParams for GET /search/elements.
type SearchParams struct {
	ElementType  string
	SettingKey   string
	SettingValue string
	GlobalClass  string
	PostType     string
	PerPage      int
	Page         int
}

// SearchResult is a single element match.
type SearchResult struct {
	PostID       int                    `json:"postId"`
	PostTitle    string                 `json:"postTitle"`
	PostType     string                 `json:"postType"`
	ElementID    string                 `json:"elementId"`
	ElementType  string                 `json:"elementType"`
	ElementLabel string                 `json:"elementLabel"`
	Settings     map[string]interface{} `json:"settings"`
	ParentID     string                 `json:"parentId"`
}

// SearchResponse from GET /search/elements.
type SearchResponse struct {
	Results    []SearchResult `json:"results"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	PerPage    int            `json:"perPage"`
	TotalPages int            `json:"totalPages"`
}

// SearchElements searches elements across all Bricks content.
func (c *Client) SearchElements(params SearchParams) (*SearchResponse, error) {
	path := "/search/elements?"
	q := make([]string, 0)
	if params.ElementType != "" {
		q = append(q, "element_type="+params.ElementType)
	}
	if params.SettingKey != "" {
		q = append(q, "setting_key="+params.SettingKey)
	}
	if params.SettingValue != "" {
		q = append(q, "setting_value="+params.SettingValue)
	}
	if params.GlobalClass != "" {
		q = append(q, "global_class="+params.GlobalClass)
	}
	if params.PostType != "" {
		q = append(q, "post_type="+params.PostType)
	}
	if params.PerPage > 0 {
		q = append(q, fmt.Sprintf("per_page=%d", params.PerPage))
	}
	if params.Page > 0 {
		q = append(q, fmt.Sprintf("page=%d", params.Page))
	}
	path += strings.Join(q, "&")

	resp, err := c.do("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
```

**Step 4: Run test to verify it passes**

Run: `cd cli && go test -run TestSearchElement -v ./internal/client/`
Expected: PASS

**Step 5: Commit**

```bash
git add cli/internal/client/client.go cli/internal/client/client_test.go
git commit -m "feat(cli): add SearchElements client method"
```

---

## Task 5: Search API — CLI Command

**Files:**
- Create: `cli/cmd/search.go`

**Step 1: Create search command**

Create `cli/cmd/search.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/nerveband/agent-to-bricks/internal/client"
	"github.com/spf13/cobra"
)

var searchCmd = &cobra.Command{
	Use:   "search",
	Short: "Search across your Bricks site",
}

var (
	searchType     string
	searchSetting  string
	searchClass    string
	searchPostType string
	searchJSON     bool
	searchLimit    int
)

var searchElementsCmd = &cobra.Command{
	Use:   "elements",
	Short: "Search elements by type, setting, or class across all pages",
	Long: `Search for elements across all Bricks content on your site.

Examples:
  bricks search elements --type heading
  bricks search elements --setting tag=h1
  bricks search elements --class btn--primary
  bricks search elements --type button --post-type page`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		params := client.SearchParams{
			ElementType: searchType,
			GlobalClass: searchClass,
			PostType:    searchPostType,
		}

		if searchSetting != "" {
			parts := splitSetting(searchSetting)
			params.SettingKey = parts[0]
			if len(parts) > 1 {
				params.SettingValue = parts[1]
			}
		}

		if searchLimit > 0 {
			params.PerPage = searchLimit
		}

		resp, err := c.SearchElements(params)
		if err != nil {
			return fmt.Errorf("search failed: %w", err)
		}

		if searchJSON {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(resp)
		}

		if len(resp.Results) == 0 {
			fmt.Println("No matching elements found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "PAGE\tTYPE\tELEMENT ID\tLABEL\tPOST TYPE")
		for _, r := range resp.Results {
			label := r.ElementLabel
			if label == "" {
				label = "-"
			}
			fmt.Fprintf(w, "%s (ID:%d)\t%s\t%s\t%s\t%s\n",
				r.PostTitle, r.PostID, r.ElementType, r.ElementID, label, r.PostType)
		}
		w.Flush()
		fmt.Printf("\n%d results (page %d of %d)\n", resp.Total, resp.Page, resp.TotalPages)
		return nil
	},
}

func splitSetting(s string) []string {
	for i, c := range s {
		if c == '=' {
			return []string{s[:i], s[i+1:]}
		}
	}
	return []string{s}
}

func init() {
	searchElementsCmd.Flags().StringVar(&searchType, "type", "", "element type (heading, button, etc.)")
	searchElementsCmd.Flags().StringVar(&searchSetting, "setting", "", "setting filter as key=value")
	searchElementsCmd.Flags().StringVar(&searchClass, "class", "", "global class name or ID")
	searchElementsCmd.Flags().StringVar(&searchPostType, "post-type", "", "post type filter")
	searchElementsCmd.Flags().BoolVar(&searchJSON, "json", false, "output as JSON")
	searchElementsCmd.Flags().IntVar(&searchLimit, "limit", 0, "max results")

	searchCmd.AddCommand(searchElementsCmd)
	rootCmd.AddCommand(searchCmd)
}
```

**Step 2: Verify it builds**

Run: `cd cli && go build ./...`
Expected: Compiles without errors

**Step 3: Commit**

```bash
git add cli/cmd/search.go
git commit -m "feat(cli): add bricks search elements command"
```

---

## Task 6: Components API — Plugin Endpoint (Red)

**Files:**
- Create: `tests/plugin/test-components-runner.php`

**Step 1: Write failing plugin test**

Create `tests/plugin/test-components-runner.php`:

```php
<?php
/**
 * ATB Components API test runner.
 * Run via: wp eval-file test-components-runner.php
 */
wp_set_current_user(1);

$GLOBALS['atb_rest_server'] = rest_get_server();

function dispatch_rest(string $method, string $route, array $params = [], array $headers = [], mixed $body = null): array {
    $server = $GLOBALS['atb_rest_server'];
    $request = new WP_REST_Request($method, $route);
    foreach ($params as $k => $v) $request->set_param($k, $v);
    foreach ($headers as $k => $v) $request->set_header($k, $v);
    if ($body !== null) {
        $request->set_body(json_encode($body));
        $request->set_header('content_type', 'application/json');
    }
    $response = $server->dispatch($request);
    return ['status' => $response->get_status(), 'data' => $response->get_data()];
}

$pass = 0;
$fail = 0;

// ===== Test 1: GET /components returns 200 =====
echo "TEST 1: List components endpoint... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/components');
if ($r['status'] === 200 && isset($r['data']['components']) && isset($r['data']['count'])) {
    echo "PASS (count={$r['data']['count']})\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

// ===== Test 2: Components are section-type templates only =====
echo "TEST 2: Components are section-type only... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/components');
if ($r['status'] === 200) {
    $all_sections = true;
    foreach ($r['data']['components'] as $comp) {
        if ($comp['type'] !== 'section') {
            $all_sections = false;
            break;
        }
    }
    echo ($all_sections ? "PASS" : "FAIL (non-section types found)") . "\n";
    $all_sections ? $pass++ : $fail++;
} else {
    echo "FAIL\n";
    $fail++;
}

// ===== Test 3: Component shape has required fields =====
echo "TEST 3: Component shape... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/components');
if ($r['status'] === 200 && count($r['data']['components']) > 0) {
    $first = $r['data']['components'][0];
    $has_fields = isset($first['id'], $first['title'], $first['type'], $first['status'], $first['elementCount']);
    echo ($has_fields ? "PASS" : "FAIL (missing fields)") . "\n";
    $has_fields ? $pass++ : $fail++;
} else {
    echo "SKIP (no components to check)\n";
}

// ===== Test 4: GET /components/{id} returns single component =====
echo "TEST 4: Get single component... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/components');
if ($r['status'] === 200 && count($r['data']['components']) > 0) {
    $comp_id = $r['data']['components'][0]['id'];
    $r2 = dispatch_rest('GET', "/agent-bricks/v1/components/$comp_id", ['id' => $comp_id]);
    if ($r2['status'] === 200 && isset($r2['data']['elements'], $r2['data']['contentHash'])) {
        echo "PASS (id=$comp_id, elements=" . count($r2['data']['elements']) . ")\n";
        $pass++;
    } else {
        echo "FAIL (status={$r2['status']})\n";
        $fail++;
    }
} else {
    echo "SKIP (no components)\n";
}

// ===== Test 5: GET /components/99999 returns 404 =====
echo "TEST 5: Non-existent component returns 404... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/components/99999', ['id' => 99999]);
if ($r['status'] === 404) {
    echo "PASS\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
```

**Step 2: Deploy and verify it fails**

```bash
scp tests/plugin/test-components-runner.php root@23.94.202.65:/tmp/
ssh root@23.94.202.65 "cd /home/runcloud/webapps/TS-Staging && sudo -u runcloud wp eval-file /tmp/test-components-runner.php"
```
Expected: FAIL — route not registered

---

## Task 7: Components API — Plugin Implementation (Green)

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-components-api.php`
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php`

**Step 1: Create the components API class**

Create `plugin/agent-to-bricks/includes/class-components-api.php`:

```php
<?php
/**
 * Components (reusable section templates) REST API endpoints.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Components_API {

    public static function init(): void {
        add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
    }

    public static function register_routes(): void {
        register_rest_route( 'agent-bricks/v1', '/components', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'list_components' ],
            'permission_callback' => [ __CLASS__, 'check_permission' ],
        ] );

        register_rest_route( 'agent-bricks/v1', '/components/(?P<id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'get_component' ],
            'permission_callback' => [ __CLASS__, 'check_permission' ],
        ] );
    }

    public static function check_permission(): bool {
        return current_user_can( 'edit_posts' );
    }

    /**
     * GET /components — list reusable components (section-type templates).
     */
    public static function list_components(): WP_REST_Response {
        $posts = get_posts( [
            'post_type'      => 'bricks_template',
            'posts_per_page' => 100,
            'post_status'    => 'any',
            'orderby'        => 'title',
            'order'          => 'ASC',
            'meta_query'     => [
                [
                    'key'   => '_bricks_template_type',
                    'value' => 'section',
                ],
            ],
        ] );

        $meta_key   = ATB_Bricks_Lifecycle::content_meta_key();
        $components = [];

        foreach ( $posts as $post ) {
            $content = get_post_meta( $post->ID, $meta_key, true );
            $components[] = [
                'id'           => $post->ID,
                'title'        => $post->post_title,
                'type'         => 'section',
                'status'       => $post->post_status,
                'elementCount' => is_array( $content ) ? count( $content ) : 0,
                'modified'     => $post->post_modified,
            ];
        }

        return new WP_REST_Response( [
            'components' => $components,
            'count'      => count( $components ),
            'total'      => count( $components ),
        ], 200 );
    }

    /**
     * GET /components/{id} — get single component with element tree.
     */
    public static function get_component( WP_REST_Request $request ): WP_REST_Response {
        $post_id = (int) $request->get_param( 'id' );
        $post    = get_post( $post_id );

        if ( ! $post || $post->post_type !== 'bricks_template' ) {
            return new WP_REST_Response( [ 'error' => 'Component not found.' ], 404 );
        }

        $tmpl_type = get_post_meta( $post_id, '_bricks_template_type', true );
        if ( $tmpl_type !== 'section' ) {
            return new WP_REST_Response( [ 'error' => 'Not a component (section template).' ], 404 );
        }

        $meta_key = ATB_Bricks_Lifecycle::content_meta_key();
        $content  = get_post_meta( $post_id, $meta_key, true );
        $elements = is_array( $content ) ? $content : [];

        return new WP_REST_Response( [
            'id'           => $post->ID,
            'title'        => $post->post_title,
            'type'         => 'section',
            'status'       => $post->post_status,
            'elements'     => $elements,
            'contentHash'  => md5( serialize( $elements ) ),
            'elementCount' => count( $elements ),
            'modified'     => $post->post_modified,
        ], 200 );
    }
}
```

**Step 2: Register in main plugin file**

In `plugin/agent-to-bricks/agent-to-bricks.php`:

Add require after the search-api require:
```php
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-components-api.php';
```

Add in `agent_bricks_init()` after `ATB_Search_API::init();`:
```php
ATB_Components_API::init();
```

**Step 3: Deploy to staging and run tests**

```bash
scp plugin/agent-to-bricks/includes/class-components-api.php root@23.94.202.65:/home/runcloud/webapps/TS-Staging/wp-content/plugins/agent-to-bricks/includes/
scp plugin/agent-to-bricks/agent-to-bricks.php root@23.94.202.65:/home/runcloud/webapps/TS-Staging/wp-content/plugins/agent-to-bricks/
ssh root@23.94.202.65 "systemctl restart php84rc-fpm"
ssh root@23.94.202.65 "cd /home/runcloud/webapps/TS-Staging && sudo -u runcloud wp eval-file /tmp/test-components-runner.php"
```
Expected: All tests PASS

**Step 4: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-components-api.php plugin/agent-to-bricks/agent-to-bricks.php tests/plugin/test-components-runner.php
git commit -m "feat(components): add components listing endpoint"
```

---

## Task 8: Components API — Go Client + CLI Command

**Files:**
- Modify: `cli/internal/client/client.go`
- Modify: `cli/internal/client/client_test.go`
- Create: `cli/cmd/components.go`

**Step 1: Write failing Go test**

Add to `cli/internal/client/client_test.go`:

```go
func TestListComponents(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/components" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"components": []map[string]interface{}{
				{"id": 89, "title": "Hero Block", "type": "section", "status": "publish", "elementCount": 5},
			},
			"count": 1,
			"total": 1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListComponents()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Count != 1 {
		t.Errorf("expected 1, got %d", resp.Count)
	}
	if resp.Components[0].Title != "Hero Block" {
		t.Errorf("expected Hero Block, got %s", resp.Components[0].Title)
	}
}

func TestGetComponent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/components/89" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id": 89, "title": "Hero Block", "type": "section",
			"elements":    []interface{}{},
			"contentHash": "hash123",
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.GetComponent(89)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Title != "Hero Block" {
		t.Errorf("expected Hero Block, got %s", resp.Title)
	}
}
```

**Step 2: Run to verify failure**

Run: `cd cli && go test -run TestListComponents -v ./internal/client/`
Expected: FAIL

**Step 3: Implement client types and methods**

Add to `cli/internal/client/client.go`:

```go
// ComponentItem in the list response.
type ComponentItem struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	Type         string `json:"type"`
	Status       string `json:"status"`
	ElementCount int    `json:"elementCount"`
	Modified     string `json:"modified"`
}

// ComponentsResponse from GET /components.
type ComponentsResponse struct {
	Components []ComponentItem `json:"components"`
	Count      int             `json:"count"`
	Total      int             `json:"total"`
}

// ComponentDetailResponse from GET /components/{id}.
type ComponentDetailResponse struct {
	ID           int                      `json:"id"`
	Title        string                   `json:"title"`
	Type         string                   `json:"type"`
	Status       string                   `json:"status"`
	Elements     []map[string]interface{} `json:"elements"`
	ContentHash  string                   `json:"contentHash"`
	ElementCount int                      `json:"elementCount"`
	Modified     string                   `json:"modified"`
}

// ListComponents returns reusable components (section-type templates).
func (c *Client) ListComponents() (*ComponentsResponse, error) {
	resp, err := c.do("GET", "/components", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result ComponentsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetComponent returns a single component with its element tree.
func (c *Client) GetComponent(id int) (*ComponentDetailResponse, error) {
	resp, err := c.do("GET", fmt.Sprintf("/components/%d", id), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result ComponentDetailResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
```

**Step 4: Run tests to verify they pass**

Run: `cd cli && go test -run "TestListComponents|TestGetComponent" -v ./internal/client/`
Expected: PASS

**Step 5: Create CLI command**

Create `cli/cmd/components.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var componentsCmd = &cobra.Command{
	Use:   "components",
	Short: "Manage reusable Bricks components",
}

var componentsJSON bool

var componentsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List reusable components (section templates)",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()
		resp, err := c.ListComponents()
		if err != nil {
			return fmt.Errorf("list failed: %w", err)
		}

		if componentsJSON {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(resp)
		}

		if resp.Count == 0 {
			fmt.Println("No components found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTITLE\tSTATUS\tELEMENTS\tMODIFIED")
		for _, comp := range resp.Components {
			fmt.Fprintf(w, "%d\t%s\t%s\t%d\t%s\n",
				comp.ID, comp.Title, comp.Status, comp.ElementCount, comp.Modified)
		}
		w.Flush()
		fmt.Printf("\n%d components\n", resp.Count)
		return nil
	},
}

var componentsShowCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "Show a component with its element tree",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		var id int
		if _, err := fmt.Sscanf(args[0], "%d", &id); err != nil {
			return fmt.Errorf("invalid component ID: %s", args[0])
		}
		c := newSiteClient()
		resp, err := c.GetComponent(id)
		if err != nil {
			return fmt.Errorf("get component failed: %w", err)
		}

		if componentsJSON {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(resp)
		}

		fmt.Printf("Component: %s (ID: %d)\n", resp.Title, resp.ID)
		fmt.Printf("Status:    %s\n", resp.Status)
		fmt.Printf("Elements:  %d\n", resp.ElementCount)
		fmt.Printf("Hash:      %s\n", resp.ContentHash)
		fmt.Println("\nElement tree:")
		data, _ := json.MarshalIndent(resp.Elements, "  ", "  ")
		fmt.Printf("  %s\n", string(data))
		return nil
	},
}

func init() {
	componentsListCmd.Flags().BoolVar(&componentsJSON, "json", false, "output as JSON")
	componentsShowCmd.Flags().BoolVar(&componentsJSON, "json", false, "output as JSON")

	componentsCmd.AddCommand(componentsListCmd)
	componentsCmd.AddCommand(componentsShowCmd)
	rootCmd.AddCommand(componentsCmd)
}
```

**Step 6: Verify it builds**

Run: `cd cli && go build ./...`
Expected: Compiles

**Step 7: Commit**

```bash
git add cli/internal/client/client.go cli/internal/client/client_test.go cli/cmd/components.go
git commit -m "feat(cli): add components list/show commands"
```

---

## Task 9: Element Types API — Plugin Endpoint (Red)

**Files:**
- Create: `tests/plugin/test-element-types-runner.php`

**Step 1: Write failing plugin test**

Create `tests/plugin/test-element-types-runner.php`:

```php
<?php
/**
 * ATB Element Types API test runner.
 * Run via: wp eval-file test-element-types-runner.php
 */
wp_set_current_user(1);

$GLOBALS['atb_rest_server'] = rest_get_server();

function dispatch_rest(string $method, string $route, array $params = [], array $headers = [], mixed $body = null): array {
    $server = $GLOBALS['atb_rest_server'];
    $request = new WP_REST_Request($method, $route);
    foreach ($params as $k => $v) $request->set_param($k, $v);
    foreach ($headers as $k => $v) $request->set_header($k, $v);
    if ($body !== null) {
        $request->set_body(json_encode($body));
        $request->set_header('content_type', 'application/json');
    }
    $response = $server->dispatch($request);
    return ['status' => $response->get_status(), 'data' => $response->get_data()];
}

$pass = 0;
$fail = 0;

// ===== Test 1: GET /site/element-types returns 200 =====
echo "TEST 1: Element types endpoint exists... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/element-types');
if ($r['status'] === 200 && isset($r['data']['elementTypes']) && isset($r['data']['count'])) {
    echo "PASS (count={$r['data']['count']})\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

// ===== Test 2: Each type has name, label, category =====
echo "TEST 2: Element type shape... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/element-types');
if ($r['status'] === 200 && count($r['data']['elementTypes']) > 0) {
    $first = $r['data']['elementTypes'][0];
    $has_fields = isset($first['name'], $first['label'], $first['category']);
    echo ($has_fields ? "PASS" : "FAIL (missing fields)") . "\n";
    $has_fields ? $pass++ : $fail++;
} else {
    echo "FAIL\n";
    $fail++;
}

// ===== Test 3: Without include_controls, no controls field =====
echo "TEST 3: No controls by default... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/element-types');
if ($r['status'] === 200 && count($r['data']['elementTypes']) > 0) {
    $first = $r['data']['elementTypes'][0];
    $no_controls = !isset($first['controls']);
    echo ($no_controls ? "PASS" : "FAIL (controls present without flag)") . "\n";
    $no_controls ? $pass++ : $fail++;
} else {
    echo "FAIL\n";
    $fail++;
}

// ===== Test 4: With include_controls=1, controls present =====
echo "TEST 4: Controls included when requested... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/element-types', ['include_controls' => '1']);
if ($r['status'] === 200 && count($r['data']['elementTypes']) > 0) {
    // Find heading element (should exist in all Bricks installs)
    $heading = null;
    foreach ($r['data']['elementTypes'] as $et) {
        if ($et['name'] === 'heading') {
            $heading = $et;
            break;
        }
    }
    if ($heading && isset($heading['controls']) && !empty($heading['controls'])) {
        echo "PASS (heading has " . count($heading['controls']) . " control groups)\n";
        $pass++;
    } else {
        echo "FAIL (heading controls missing)\n";
        $fail++;
    }
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

// ===== Test 5: Filter by category =====
echo "TEST 5: Filter by category... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/element-types', ['category' => 'media']);
if ($r['status'] === 200) {
    $all_media = true;
    foreach ($r['data']['elementTypes'] as $et) {
        if ($et['category'] !== 'media') {
            $all_media = false;
            break;
        }
    }
    echo ($all_media ? "PASS" : "FAIL") . " (count={$r['data']['count']})\n";
    $all_media ? $pass++ : $fail++;
} else {
    echo "FAIL (status={$r['status']})\n";
    $fail++;
}

// ===== Test 6: Known element types present =====
echo "TEST 6: Known elements (heading, section, container)... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/element-types');
if ($r['status'] === 200) {
    $names = array_column($r['data']['elementTypes'], 'name');
    $has_heading = in_array('heading', $names);
    $has_section = in_array('section', $names);
    $has_container = in_array('container', $names);
    if ($has_heading && $has_section && $has_container) {
        echo "PASS\n";
        $pass++;
    } else {
        echo "FAIL (heading=$has_heading, section=$has_section, container=$has_container)\n";
        $fail++;
    }
} else {
    echo "FAIL\n";
    $fail++;
}

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
```

**Step 2: Deploy and verify it fails**

```bash
scp tests/plugin/test-element-types-runner.php root@23.94.202.65:/tmp/
ssh root@23.94.202.65 "cd /home/runcloud/webapps/TS-Staging && sudo -u runcloud wp eval-file /tmp/test-element-types-runner.php"
```
Expected: FAIL — route not registered

---

## Task 10: Element Types API — Plugin Implementation (Green)

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-site-api.php`

**Step 1: Add element-types endpoint to ATB_Site_API**

In `plugin/agent-to-bricks/includes/class-site-api.php`, add the new route registration in `register_routes()` and the handler method:

Add route in `register_routes()`:
```php
register_rest_route( 'agent-bricks/v1', '/site/element-types', [
    'methods'             => 'GET',
    'callback'            => [ __CLASS__, 'get_element_types' ],
    'permission_callback' => [ __CLASS__, 'check_permission' ],
] );
```

Add handler method to the class:
```php
/**
 * GET /site/element-types — rich element type metadata with optional controls.
 */
public static function get_element_types( WP_REST_Request $request ): WP_REST_Response {
    $include_controls = (bool) $request->get_param( 'include_controls' );
    $category_filter  = $request->get_param( 'category' );

    if ( ! class_exists( '\Bricks\Elements' ) || empty( \Bricks\Elements::$elements ) ) {
        return new WP_REST_Response( [
            'elementTypes' => [],
            'count'        => 0,
        ], 200 );
    }

    $types = [];

    foreach ( \Bricks\Elements::$elements as $name => $element_class ) {
        // Get metadata from the element instance
        $label    = '';
        $category = 'general';
        $icon     = '';
        $controls = [];

        if ( is_object( $element_class ) ) {
            $label    = $element_class->label ?? $name;
            $category = $element_class->category ?? 'general';
            $icon     = $element_class->icon ?? '';

            if ( $include_controls && method_exists( $element_class, 'set_controls' ) ) {
                // Trigger control registration
                $element_class->set_controls();
                $controls = $element_class->controls ?? [];
            }
        } elseif ( is_string( $element_class ) && class_exists( $element_class ) ) {
            // Element registered as class name string
            try {
                $instance = new $element_class();
                $label    = $instance->label ?? $name;
                $category = $instance->category ?? 'general';
                $icon     = $instance->icon ?? '';

                if ( $include_controls && method_exists( $instance, 'set_controls' ) ) {
                    $instance->set_controls();
                    $controls = $instance->controls ?? [];
                }
            } catch ( \Throwable $e ) {
                $label = $name;
            }
        }

        // Apply category filter
        if ( $category_filter && $category !== $category_filter ) {
            continue;
        }

        $type_data = [
            'name'     => $name,
            'label'    => $label,
            'category' => $category,
            'icon'     => $icon,
        ];

        if ( $include_controls && ! empty( $controls ) ) {
            $type_data['controls'] = self::sanitize_controls( $controls );
        }

        $types[] = $type_data;
    }

    // Sort by name for consistent output
    usort( $types, fn( $a, $b ) => strcmp( $a['name'], $b['name'] ) );

    return new WP_REST_Response( [
        'elementTypes' => $types,
        'count'        => count( $types ),
    ], 200 );
}

/**
 * Sanitize controls for API response — strip closures and internal fields.
 */
private static function sanitize_controls( array $controls ): array {
    $clean = [];
    foreach ( $controls as $key => $control ) {
        if ( ! is_array( $control ) ) continue;

        $entry = [];
        foreach ( [ 'type', 'label', 'default', 'options', 'placeholder', 'description', 'units', 'min', 'max', 'step' ] as $field ) {
            if ( isset( $control[ $field ] ) && ! ( $control[ $field ] instanceof \Closure ) ) {
                $entry[ $field ] = $control[ $field ];
            }
        }

        if ( ! empty( $entry ) ) {
            $clean[ $key ] = $entry;
        }
    }
    return $clean;
}
```

**Step 2: Deploy to staging and run tests**

```bash
scp plugin/agent-to-bricks/includes/class-site-api.php root@23.94.202.65:/home/runcloud/webapps/TS-Staging/wp-content/plugins/agent-to-bricks/includes/
ssh root@23.94.202.65 "systemctl restart php84rc-fpm"
ssh root@23.94.202.65 "cd /home/runcloud/webapps/TS-Staging && sudo -u runcloud wp eval-file /tmp/test-element-types-runner.php"
```
Expected: All 6 tests PASS

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-site-api.php tests/plugin/test-element-types-runner.php
git commit -m "feat(site): add rich element types endpoint with controls"
```

---

## Task 11: Element Types — Go Client + CLI Command

**Files:**
- Modify: `cli/internal/client/client.go`
- Modify: `cli/internal/client/client_test.go`
- Create: `cli/cmd/elements.go`

**Step 1: Write failing Go test**

Add to `cli/internal/client/client_test.go`:

```go
func TestListElementTypes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/element-types" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elementTypes": []map[string]interface{}{
				{"name": "heading", "label": "Heading", "category": "basic", "icon": "ti-text"},
				{"name": "section", "label": "Section", "category": "layout", "icon": "ti-layout"},
			},
			"count": 2,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListElementTypes(false, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Count != 2 {
		t.Errorf("expected 2, got %d", resp.Count)
	}
	if resp.ElementTypes[0].Name != "heading" {
		t.Errorf("expected heading, got %s", resp.ElementTypes[0].Name)
	}
}

func TestListElementTypesWithControls(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("include_controls") != "1" {
			t.Error("expected include_controls=1")
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elementTypes": []map[string]interface{}{
				{
					"name": "heading", "label": "Heading", "category": "basic",
					"controls": map[string]interface{}{
						"text": map[string]interface{}{"type": "text", "label": "Text"},
					},
				},
			},
			"count": 1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListElementTypes(true, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ElementTypes[0].Controls == nil {
		t.Error("expected controls")
	}
}

func TestListElementTypesByCategory(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("category") != "media" {
			t.Errorf("expected category=media, got %s", r.URL.Query().Get("category"))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elementTypes": []map[string]interface{}{},
			"count":        0,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	_, err := c.ListElementTypes(false, "media")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
```

**Step 2: Run to verify failure**

Run: `cd cli && go test -run TestListElementType -v ./internal/client/`
Expected: FAIL

**Step 3: Implement client types and method**

Add to `cli/internal/client/client.go`:

```go
// ElementTypeInfo from GET /site/element-types.
type ElementTypeInfo struct {
	Name     string                 `json:"name"`
	Label    string                 `json:"label"`
	Category string                 `json:"category"`
	Icon     string                 `json:"icon"`
	Controls map[string]interface{} `json:"controls,omitempty"`
}

// ElementTypesResponse from GET /site/element-types.
type ElementTypesResponse struct {
	ElementTypes []ElementTypeInfo `json:"elementTypes"`
	Count        int               `json:"count"`
}

// ListElementTypes returns rich element type metadata.
func (c *Client) ListElementTypes(includeControls bool, category string) (*ElementTypesResponse, error) {
	path := "/site/element-types"
	q := make([]string, 0)
	if includeControls {
		q = append(q, "include_controls=1")
	}
	if category != "" {
		q = append(q, "category="+category)
	}
	if len(q) > 0 {
		path += "?" + strings.Join(q, "&")
	}

	resp, err := c.do("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result ElementTypesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
```

**Step 4: Run tests to verify they pass**

Run: `cd cli && go test -run TestListElementType -v ./internal/client/`
Expected: PASS

**Step 5: Create CLI command**

Create `cli/cmd/elements.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var elementsCmd = &cobra.Command{
	Use:   "elements",
	Short: "Element type information",
}

var (
	elemTypesControls bool
	elemTypesCategory string
	elemTypesJSON     bool
)

var elemTypesCmd = &cobra.Command{
	Use:   "types [name]",
	Short: "List available Bricks element types with metadata",
	Long: `List all available element types in your Bricks installation.

Examples:
  bricks elements types
  bricks elements types --category media
  bricks elements types --controls
  bricks elements types heading --controls`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requireConfig(); err != nil {
			return err
		}
		c := newSiteClient()

		// If single element name provided, always include controls
		singleName := ""
		if len(args) > 0 {
			singleName = args[0]
			elemTypesControls = true
		}

		resp, err := c.ListElementTypes(elemTypesControls, elemTypesCategory)
		if err != nil {
			return fmt.Errorf("failed: %w", err)
		}

		// If single element requested, filter to just that one
		if singleName != "" {
			for _, et := range resp.ElementTypes {
				if et.Name == singleName {
					if elemTypesJSON {
						enc := json.NewEncoder(os.Stdout)
						enc.SetIndent("", "  ")
						return enc.Encode(et)
					}
					fmt.Printf("Name:     %s\n", et.Name)
					fmt.Printf("Label:    %s\n", et.Label)
					fmt.Printf("Category: %s\n", et.Category)
					if et.Controls != nil {
						fmt.Println("\nControls:")
						data, _ := json.MarshalIndent(et.Controls, "  ", "  ")
						fmt.Printf("  %s\n", string(data))
					}
					return nil
				}
			}
			return fmt.Errorf("element type '%s' not found", singleName)
		}

		if elemTypesJSON {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(resp)
		}

		if resp.Count == 0 {
			fmt.Println("No element types found.")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NAME\tLABEL\tCATEGORY\tICON")
		for _, et := range resp.ElementTypes {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", et.Name, et.Label, et.Category, et.Icon)
		}
		w.Flush()
		fmt.Printf("\n%d element types\n", resp.Count)
		return nil
	},
}

func init() {
	elemTypesCmd.Flags().BoolVar(&elemTypesControls, "controls", false, "include element controls schema")
	elemTypesCmd.Flags().StringVar(&elemTypesCategory, "category", "", "filter by category")
	elemTypesCmd.Flags().BoolVar(&elemTypesJSON, "json", false, "output as JSON")

	elementsCmd.AddCommand(elemTypesCmd)
	rootCmd.AddCommand(elementsCmd)
}
```

**Step 6: Verify it builds**

Run: `cd cli && go build ./...`
Expected: Compiles

**Step 7: Commit**

```bash
git add cli/internal/client/client.go cli/internal/client/client_test.go cli/cmd/elements.go
git commit -m "feat(cli): add elements types command with controls"
```

---

## Task 12: Run All Tests — Full Verification

**Step 1: Run all Go tests**

```bash
cd cli && go test -v ./...
```
Expected: All tests pass (original 149 + new 5 = 154+)

**Step 2: Run all plugin tests on staging**

```bash
# Deploy all plugin files
scp -r plugin/agent-to-bricks/ root@23.94.202.65:/home/runcloud/webapps/TS-Staging/wp-content/plugins/agent-to-bricks/
ssh root@23.94.202.65 "systemctl restart php84rc-fpm"

# Run all test runners
for test in test-search-runner.php test-components-runner.php test-element-types-runner.php test-site-runner.php test-elements-runner.php test-classes-runner.php test-api-auth-runner.php test-snapshots-runner.php; do
    echo "=== $test ==="
    scp tests/plugin/$test root@23.94.202.65:/tmp/
    ssh root@23.94.202.65 "cd /home/runcloud/webapps/TS-Staging && sudo -u runcloud wp eval-file /tmp/$test"
done
```
Expected: All test runners pass, no regressions

**Step 3: Verify PHP header**

```bash
ssh root@23.94.202.65 "cd /home/runcloud/webapps/TS-Staging && sudo -u runcloud wp eval 'echo PHP_VERSION;'"
```
Expected: Shows 8.x version (confirming PHP 8.0+ is running)

**Step 4: Final commit if anything was missed**

```bash
git status
# If clean, skip. Otherwise:
# git add <files>
# git commit -m "test: verify all features pass on staging"
```

---

## Summary

| Task | Type | Files | Tests |
|------|------|-------|-------|
| 1 | PHP bump | agent-to-bricks.php | - |
| 2-3 | Search API (plugin) | class-search-api.php | test-search-runner.php (6 tests) |
| 4-5 | Search API (CLI) | client.go, search.go | client_test.go (2 tests) |
| 6-7 | Components (plugin) | class-components-api.php | test-components-runner.php (5 tests) |
| 8 | Components (CLI) | client.go, components.go | client_test.go (2 tests) |
| 9-10 | Element types (plugin) | class-site-api.php | test-element-types-runner.php (6 tests) |
| 11 | Element types (CLI) | client.go, elements.go | client_test.go (3 tests) |
| 12 | Full verification | - | All tests |

**New tests:** 17 plugin + 7 Go = 24 new tests
**New files:** 5 PHP + 3 Go = 8 new files
**Modified files:** 3 PHP + 2 Go = 5 modified files
