<?php
/**
 * ATB Site Info, Styles, and Frameworks API test runner.
 * Run via: wp eval-file test-site-runner.php
 */
wp_set_current_user(1);

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

// ===== Test 1: GET /site/info =====
echo "TEST 1: GET site info... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/info');
if ($r['status'] === 200
    && isset($r['data']['bricksVersion'])
    && isset($r['data']['contentMetaKey'])
    && isset($r['data']['elementTypes'])
    && isset($r['data']['breakpoints'])
) {
    echo "PASS (bricks={$r['data']['bricksVersion']}, types=" . count($r['data']['elementTypes']) . ", bp=" . count($r['data']['breakpoints']) . ")\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 2: GET /site/frameworks =====
echo "TEST 2: GET frameworks... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/frameworks');
if ($r['status'] === 200 && isset($r['data']['frameworks'])) {
    $fw_names = array_keys($r['data']['frameworks']);
    $has_acss = in_array('acss', $fw_names);
    echo "PASS (frameworks=" . implode(',', $fw_names) . ", acss=" . ($has_acss ? 'detected' : 'not found') . ")\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 3: GET /styles =====
echo "TEST 3: GET theme styles... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/styles');
if ($r['status'] === 200 && isset($r['data']['themeStyles'])) {
    $count = count($r['data']['themeStyles']);
    $names = array_map(function($s) { return $s['label'] ?? $s['key'] ?? '?'; }, $r['data']['themeStyles']);
    echo "PASS ($count styles: " . implode(', ', $names) . ")\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 4: GET /styles includes global settings =====
echo "TEST 4: Global settings in styles... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/styles');
if ($r['status'] === 200 && isset($r['data']['globalSettings'])) {
    $setting_count = count($r['data']['globalSettings']);
    echo "PASS ($setting_count global settings)\n";
    $pass++;
} else {
    echo "FAIL (missing globalSettings)\n";
    $fail++;
}

// ===== Test 5: GET /variables =====
echo "TEST 5: GET CSS variables... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/variables');
if ($r['status'] === 200 && isset($r['data']['variables'])) {
    echo "PASS (" . count($r['data']['variables']) . " variables)\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 6: ACSS settings accessible if present =====
echo "TEST 6: ACSS settings detail... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/site/frameworks');
if ($r['status'] === 200 && isset($r['data']['frameworks']['acss'])) {
    $acss = $r['data']['frameworks']['acss'];
    $has_settings = !empty($acss['settingsKeys']);
    $has_classes = isset($acss['classCount']);
    echo "PASS (settings_keys=" . ($has_settings ? count($acss['settingsKeys']) : 0) . ", class_count=" . ($acss['classCount'] ?? 0) . ")\n";
    $pass++;
} else {
    echo "SKIP (no ACSS)\n";
}

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
