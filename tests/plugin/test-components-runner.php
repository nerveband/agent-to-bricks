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
