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

// Test 1: GET /pages/{id}/elements returns elements + contentHash
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

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
