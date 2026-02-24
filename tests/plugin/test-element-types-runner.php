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
