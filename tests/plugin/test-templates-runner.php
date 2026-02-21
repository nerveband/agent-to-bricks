<?php
/**
 * ATB Templates API test runner.
 * Run via: wp eval-file test-templates-runner.php
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

// ===== Test 1: GET /templates =====
echo "TEST 1: GET templates... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/templates');
if ($r['status'] === 200 && isset($r['data']['templates'])) {
    $count = count($r['data']['templates']);
    echo "PASS ($count templates)\n";
    $pass++;
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 2: POST /templates — create from elements =====
echo "TEST 2: POST create template... ";
$post_r = dispatch_rest('POST', '/agent-bricks/v1/templates', [], [], [
    'title' => 'ATB Test Template',
    'type' => 'section',
    'elements' => [
        ['id' => 'tmpl01', 'name' => 'section', 'parent' => 0, 'children' => ['tmpl02'], 'settings' => []],
        ['id' => 'tmpl02', 'name' => 'heading', 'parent' => 'tmpl01', 'children' => [], 'settings' => ['text' => 'Template Heading', 'tag' => 'h2']],
    ],
]);
if ($post_r['status'] === 201 && isset($post_r['data']['id'])) {
    $template_id = $post_r['data']['id'];
    echo "PASS (id=$template_id)\n";
    $pass++;
} else {
    echo "FAIL (status={$post_r['status']})\n";
    echo json_encode($post_r['data']) . "\n";
    $fail++;
    $template_id = null;
}

// ===== Test 3: GET /templates/{id} — read template content =====
echo "TEST 3: GET template content... ";
if ($template_id) {
    $get_r = dispatch_rest('GET', "/agent-bricks/v1/templates/$template_id", ['id' => $template_id]);
    if ($get_r['status'] === 200 && isset($get_r['data']['elements']) && count($get_r['data']['elements']) === 2) {
        echo "PASS (title={$get_r['data']['title']}, elements=" . count($get_r['data']['elements']) . ")\n";
        $pass++;
    } else {
        echo "FAIL (status={$get_r['status']})\n";
        echo json_encode($get_r['data']) . "\n";
        $fail++;
    }
} else {
    echo "SKIP\n";
}

// ===== Test 4: PATCH /templates/{id} — update template =====
echo "TEST 4: PATCH update template... ";
if ($template_id) {
    $patch_r = dispatch_rest('PATCH', "/agent-bricks/v1/templates/$template_id",
        ['id' => $template_id], [],
        ['title' => 'ATB Updated Template', 'elements' => [
            ['id' => 'upd01', 'name' => 'section', 'parent' => 0, 'children' => [], 'settings' => []],
        ]]
    );
    if ($patch_r['status'] === 200 && $patch_r['data']['title'] === 'ATB Updated Template') {
        echo "PASS (title updated, elements=" . count($patch_r['data']['elements']) . ")\n";
        $pass++;
    } else {
        echo "FAIL (status={$patch_r['status']})\n";
        echo json_encode($patch_r['data']) . "\n";
        $fail++;
    }
} else {
    echo "SKIP\n";
}

// ===== Test 5: DELETE /templates/{id} =====
echo "TEST 5: DELETE template... ";
if ($template_id) {
    $del_r = dispatch_rest('DELETE', "/agent-bricks/v1/templates/$template_id", ['id' => $template_id]);
    if ($del_r['status'] === 200) {
        // Verify it's gone
        $verify = dispatch_rest('GET', "/agent-bricks/v1/templates/$template_id", ['id' => $template_id]);
        if ($verify['status'] === 404) {
            echo "PASS (deleted + verified)\n";
            $pass++;
        } else {
            echo "FAIL (still exists)\n";
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

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
