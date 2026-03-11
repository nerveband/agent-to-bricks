<?php
/**
 * ATB WooCommerce discovery API test runner.
 * Run via: wp eval-file test-woo-runner.php
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

// ===== Test 1: GET /woo/products =====
echo "TEST 1: Woo products endpoint... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/woo/products', ['per_page' => 5]);
if (
    $r['status'] === 200
    && isset($r['data']['products'])
    && isset($r['data']['count'])
    && isset($r['data']['woocommerceActive'])
) {
    if (!empty($r['data']['products'])) {
        $first = $r['data']['products'][0];
        $has_fields = isset($first['id'], $first['title'], $first['slug'], $first['status']);
        if (!$has_fields) {
            echo "FAIL (missing product fields)\n";
            $fail++;
        } else {
            echo "PASS (" . count($r['data']['products']) . " products)\n";
            $pass++;
        }
    } else {
        echo "PASS (0 products, active=" . (!empty($r['data']['woocommerceActive']) ? 'yes' : 'no') . ")\n";
        $pass++;
    }
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 2: GET /woo/product-categories =====
echo "TEST 2: Woo product categories endpoint... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/woo/product-categories', ['per_page' => 5]);
if (
    $r['status'] === 200
    && isset($r['data']['categories'])
    && isset($r['data']['count'])
    && isset($r['data']['woocommerceActive'])
) {
    if (!empty($r['data']['categories'])) {
        $first = $r['data']['categories'][0];
        $has_fields = isset($first['id'], $first['name'], $first['slug'], $first['count']);
        if (!$has_fields) {
            echo "FAIL (missing category fields)\n";
            $fail++;
        } else {
            echo "PASS (" . count($r['data']['categories']) . " categories)\n";
            $pass++;
        }
    } else {
        echo "PASS (0 categories, active=" . (!empty($r['data']['woocommerceActive']) ? 'yes' : 'no') . ")\n";
        $pass++;
    }
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

// ===== Test 3: GET /woo/product-tags =====
echo "TEST 3: Woo product tags endpoint... ";
$r = dispatch_rest('GET', '/agent-bricks/v1/woo/product-tags', ['per_page' => 5]);
if (
    $r['status'] === 200
    && isset($r['data']['tags'])
    && isset($r['data']['count'])
    && isset($r['data']['woocommerceActive'])
) {
    if (!empty($r['data']['tags'])) {
        $first = $r['data']['tags'][0];
        $has_fields = isset($first['id'], $first['name'], $first['slug'], $first['count']);
        if (!$has_fields) {
            echo "FAIL (missing tag fields)\n";
            $fail++;
        } else {
            echo "PASS (" . count($r['data']['tags']) . " tags)\n";
            $pass++;
        }
    } else {
        echo "PASS (0 tags, active=" . (!empty($r['data']['woocommerceActive']) ? 'yes' : 'no') . ")\n";
        $pass++;
    }
} else {
    echo "FAIL (status={$r['status']})\n";
    echo json_encode($r['data']) . "\n";
    $fail++;
}

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
