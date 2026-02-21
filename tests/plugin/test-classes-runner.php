<?php
/**
 * ATB Global Classes API test runner.
 * Run via: wp eval-file test-classes-runner.php
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

// ===== Test 1: GET /classes =====
echo "TEST 1: GET classes... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/classes');
if ($r['status'] === 200 && isset($r['data']['classes'])) {
    $count = count($r['data']['classes']);
    // Check if any ACSS classes have framework flag
    $acss_count = 0;
    $custom_count = 0;
    foreach ($r['data']['classes'] as $c) {
        if (isset($c['framework']) && $c['framework'] === 'acss') $acss_count++;
        if (isset($c['framework']) && $c['framework'] === 'custom') $custom_count++;
    }
    echo "PASS ($count classes, acss=$acss_count, custom=$custom_count)\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 2: POST /classes — create a test class =====
echo "TEST 2: POST create class... ";
$post_r = dispatch_rest('POST', '/agent-bricks/v1/classes', [], [],
    ['name' => 'atb-test-class', 'settings' => ['color' => ['hex' => '#ff0000']], 'label' => 'ATB Test']
);
if ($post_r['status'] === 201 && isset($post_r['data']['id'])) {
    $test_class_id = $post_r['data']['id'];
    echo "PASS (id=$test_class_id)\n";
    $pass++;
} else {
    echo "FAIL (status={$post_r['status']})\n";
    echo json_encode($post_r['data']) . "\n";
    $fail++;
    $test_class_id = null;
}

// ===== Test 3: GET /classes/{id} — read the class we created =====
echo "TEST 3: GET single class... ";
if ($test_class_id) {
    $get_r = dispatch_rest('GET', "/agent-bricks/v1/classes/$test_class_id", ['id' => $test_class_id]);
    if ($get_r['status'] === 200 && $get_r['data']['name'] === 'atb-test-class') {
        echo "PASS (name={$get_r['data']['name']})\n";
        $pass++;
    } else {
        echo "FAIL (status={$get_r['status']})\n";
        echo json_encode($get_r['data']) . "\n";
        $fail++;
    }
} else {
    echo "SKIP\n";
}

// ===== Test 4: PATCH /classes/{id} — update settings =====
echo "TEST 4: PATCH update class... ";
if ($test_class_id) {
    $patch_r = dispatch_rest('PATCH', "/agent-bricks/v1/classes/$test_class_id",
        ['id' => $test_class_id], [],
        ['settings' => ['color' => ['hex' => '#00ff00']], 'label' => 'ATB Updated']
    );
    if ($patch_r['status'] === 200 && $patch_r['data']['label'] === 'ATB Updated') {
        echo "PASS (label updated)\n";
        $pass++;
    } else {
        echo "FAIL (status={$patch_r['status']})\n";
        echo json_encode($patch_r['data']) . "\n";
        $fail++;
    }
} else {
    echo "SKIP\n";
}

// ===== Test 5: DELETE /classes/{id} =====
echo "TEST 5: DELETE class... ";
if ($test_class_id) {
    $del_r = dispatch_rest('DELETE', "/agent-bricks/v1/classes/$test_class_id", ['id' => $test_class_id]);
    if ($del_r['status'] === 200) {
        // Verify it's gone
        $verify = dispatch_rest('GET', "/agent-bricks/v1/classes/$test_class_id", ['id' => $test_class_id]);
        if ($verify['status'] === 404) {
            echo "PASS (deleted + verified)\n";
            $pass++;
        } else {
            echo "FAIL (still exists after delete)\n";
            $fail++;
        }
    } else {
        echo "FAIL (status={$del_r['status']})\n";
        echo json_encode($del_r['data']) . "\n";
        $fail++;
    }
} else {
    echo "SKIP\n";
}

// ===== Test 6: Duplicate class name rejected =====
echo "TEST 6: Reject duplicate class name... ";
$dup1 = dispatch_rest('POST', '/agent-bricks/v1/classes', [], [],
    ['name' => 'atb-dup-test', 'settings' => []]
);
$dup2 = dispatch_rest('POST', '/agent-bricks/v1/classes', [], [],
    ['name' => 'atb-dup-test', 'settings' => []]
);
if ($dup2['status'] === 409) {
    echo "PASS (correctly rejected duplicate)\n";
    $pass++;
} else {
    echo "FAIL (expected 409, got {$dup2['status']})\n";
    $fail++;
}
// Cleanup
if (isset($dup1['data']['id'])) {
    dispatch_rest('DELETE', "/agent-bricks/v1/classes/{$dup1['data']['id']}", ['id' => $dup1['data']['id']]);
}

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
