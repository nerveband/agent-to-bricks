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
