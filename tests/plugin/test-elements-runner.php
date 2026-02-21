<?php
/**
 * ATB Elements API test runner.
 * Run via: wp eval-file test-elements-runner.php <test_page_id>
 */
$test_page = isset($args[0]) ? (int)$args[0] : 2005;
wp_set_current_user(1);

// Get the REST server (initializes routes via rest_api_init)
$GLOBALS['atb_rest_server'] = rest_get_server();

function dispatch_rest($method, $route, $params = [], $headers = [], $body = null) {
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

// ===== Test 1: GET /pages/{id}/elements =====
echo "TEST 1: GET elements... ";
$r = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/elements", ['id' => $test_page]);
if ($r['status'] === 200 && isset($r['data']['elements']) && isset($r['data']['contentHash'])) {
    $count = count($r['data']['elements']);
    $hash = $r['data']['contentHash'];
    echo "PASS ($count elements, hash=$hash)\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 2: PATCH delta with valid hash =====
echo "TEST 2: PATCH delta (valid hash)... ";
$get_r = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/elements", ['id' => $test_page]);
$current_hash = $get_r['data']['contentHash'];
$first_id = $get_r['data']['elements'][0]['id'] ?? null;

if ($first_id) {
    $patch_r = dispatch_rest('PATCH', "/agent-bricks/v1/pages/$test_page/elements",
        ['id' => $test_page],
        ['if_match' => $current_hash],
        ['patches' => [['id' => $first_id, 'label' => 'ATB Test Label']]]
    );
    if ($patch_r['status'] === 200 && isset($patch_r['data']['contentHash'])) {
        $new_hash = $patch_r['data']['contentHash'];
        echo "PASS (new hash=$new_hash)\n";
        $pass++;

        // Restore: patch back
        dispatch_rest('PATCH', "/agent-bricks/v1/pages/$test_page/elements",
            ['id' => $test_page],
            ['if_match' => $new_hash],
            ['patches' => [['id' => $first_id, 'label' => 'Test Section']]]
        );
    } else {
        echo "FAIL (status={$patch_r['status']})\n";
        echo json_encode($patch_r['data']) . "\n";
        $fail++;
    }
} else {
    echo "SKIP (no elements)\n";
}

// ===== Test 3: PATCH with stale hash -> 409 =====
echo "TEST 3: PATCH delta (stale hash -> 409)... ";
$stale_r = dispatch_rest('PATCH', "/agent-bricks/v1/pages/$test_page/elements",
    ['id' => $test_page],
    ['if_match' => 'stale_hash_value'],
    ['patches' => [['id' => $first_id, 'label' => 'Should Fail']]]
);
if ($stale_r['status'] === 409) {
    echo "PASS (correctly rejected stale hash)\n";
    $pass++;
} else {
    echo "FAIL (expected 409, got {$stale_r['status']})\n";
    echo json_encode($stale_r['data']) . "\n";
    $fail++;
}

// ===== Test 4: PATCH without If-Match -> 428 =====
echo "TEST 4: PATCH without If-Match -> 428... ";
$no_match_r = dispatch_rest('PATCH', "/agent-bricks/v1/pages/$test_page/elements",
    ['id' => $test_page],
    [],
    ['patches' => [['id' => $first_id, 'label' => 'No Match']]]
);
if ($no_match_r['status'] === 428) {
    echo "PASS (correctly requires If-Match)\n";
    $pass++;
} else {
    echo "FAIL (expected 428, got {$no_match_r['status']})\n";
    echo json_encode($no_match_r['data']) . "\n";
    $fail++;
}

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
