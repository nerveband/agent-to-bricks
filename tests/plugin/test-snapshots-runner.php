<?php
/**
 * ATB Snapshots API test runner.
 * Run via: wp eval-file test-snapshots-runner.php <test_page_id>
 */
$test_page = isset($args[0]) ? (int)$args[0] : 2005;
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

// ===== Test 1: Create snapshot =====
echo "TEST 1: POST snapshot... ";
$get_r = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/elements", ['id' => $test_page]);
$hash_before = $get_r['data']['contentHash'];
$elements_before = $get_r['data']['elements'];

$snap_r = dispatch_rest('POST', "/agent-bricks/v1/pages/$test_page/snapshots", ['id' => $test_page]);
if ($snap_r['status'] === 201 && isset($snap_r['data']['snapshotId'])) {
    $snapshot_id = $snap_r['data']['snapshotId'];
    echo "PASS (id=$snapshot_id)\n";
    $pass++;
} else {
    echo "FAIL (status={$snap_r['status']})\n";
    echo json_encode($snap_r['data']) . "\n";
    $fail++;
    $snapshot_id = null;
}

// ===== Test 2: List snapshots =====
echo "TEST 2: GET snapshots... ";
$list_r = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/snapshots", ['id' => $test_page]);
if ($list_r['status'] === 200 && isset($list_r['data']['snapshots']) && count($list_r['data']['snapshots']) > 0) {
    $count = count($list_r['data']['snapshots']);
    echo "PASS ($count snapshots)\n";
    $pass++;
} else {
    echo "FAIL (status={$list_r['status']})\n";
    echo json_encode($list_r['data']) . "\n";
    $fail++;
}

// ===== Test 3: Modify page, then rollback =====
echo "TEST 3: Modify + rollback... ";
if ($snapshot_id) {
    // Modify the page
    $get_r2 = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/elements", ['id' => $test_page]);
    $current_hash = $get_r2['data']['contentHash'];

    $put_r = dispatch_rest('PUT', "/agent-bricks/v1/pages/$test_page/elements",
        ['id' => $test_page],
        ['if_match' => $current_hash],
        ['elements' => [['id' => 'rollback_test', 'name' => 'heading', 'parent' => 0, 'children' => [], 'settings' => ['text' => 'Will be rolled back']]]]
    );

    if ($put_r['status'] !== 200) {
        echo "FAIL (modify failed, status={$put_r['status']})\n";
        echo json_encode($put_r['data']) . "\n";
        $fail++;
    } else {
        // Verify modification took effect
        $get_r3 = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/elements", ['id' => $test_page]);
        $modified_count = count($get_r3['data']['elements']);

        // Rollback to snapshot
        $roll_r = dispatch_rest('POST', "/agent-bricks/v1/pages/$test_page/snapshots/$snapshot_id/rollback",
            ['id' => $test_page, 'snapshot_id' => $snapshot_id]
        );

        if ($roll_r['status'] === 200 && isset($roll_r['data']['contentHash'])) {
            // Verify restored
            $get_r4 = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/elements", ['id' => $test_page]);
            $restored_hash = $get_r4['data']['contentHash'];
            $restored_count = count($get_r4['data']['elements']);

            if ($restored_hash === $hash_before && $restored_count === count($elements_before)) {
                echo "PASS (modified=$modified_count, restored=$restored_count, hash matches)\n";
                $pass++;
            } else {
                echo "FAIL (hash mismatch: expected=$hash_before, got=$restored_hash)\n";
                $fail++;
            }
        } else {
            echo "FAIL (rollback status={$roll_r['status']})\n";
            echo json_encode($roll_r['data']) . "\n";
            $fail++;
        }
    }
} else {
    echo "SKIP (no snapshot)\n";
}

// ===== Test 4: Snapshot auto-creates before destructive ops =====
echo "TEST 4: Auto-snapshot on PUT... ";
$get_r5 = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/elements", ['id' => $test_page]);
$before_count = count($list_r['data']['snapshots'] ?? []);

// Do a PUT (full replace) which should auto-snapshot
$put_r2 = dispatch_rest('PUT', "/agent-bricks/v1/pages/$test_page/elements",
    ['id' => $test_page],
    ['if_match' => $get_r5['data']['contentHash']],
    ['elements' => $get_r5['data']['elements']]  // Same content, just triggers auto-snapshot
);

$list_r2 = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/snapshots", ['id' => $test_page]);
$after_count = count($list_r2['data']['snapshots'] ?? []);

if ($after_count > $before_count) {
    echo "PASS (snapshots: $before_count -> $after_count)\n";
    $pass++;
} else {
    echo "FAIL (no auto-snapshot created: $before_count -> $after_count)\n";
    $fail++;
}

// ===== Test 5: Max 10 snapshots (FIFO) =====
echo "TEST 5: Max snapshots FIFO... ";
// Create snapshots until we hit 10+
for ($i = 0; $i < 12; $i++) {
    dispatch_rest('POST', "/agent-bricks/v1/pages/$test_page/snapshots", ['id' => $test_page]);
}
$list_r3 = dispatch_rest('GET', "/agent-bricks/v1/pages/$test_page/snapshots", ['id' => $test_page]);
$snap_count = count($list_r3['data']['snapshots'] ?? []);
if ($snap_count <= 10) {
    echo "PASS (count=$snap_count, max=10)\n";
    $pass++;
} else {
    echo "FAIL (count=$snap_count, expected <=10)\n";
    $fail++;
}

// ===== Cleanup: delete all test snapshots =====
delete_post_meta($test_page, '_agent_bricks_snapshots');

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
