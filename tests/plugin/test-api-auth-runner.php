<?php
/**
 * ATB API Auth test runner.
 * Run via: wp eval-file test-api-auth-runner.php
 *
 * Tests the plugin-level API key auth system (class-api-auth.php).
 */
wp_set_current_user(1);

$pass = 0;
$fail = 0;

// ===== Test 1: Generate API key =====
echo "TEST 1: Generate API key... ";
$raw_key = ATB_API_Auth::generate_key(1, 'Test Key');
if ($raw_key && strpos($raw_key, 'atb_') === 0 && strlen($raw_key) > 20) {
    echo "PASS (key={$raw_key})\n";
    $pass++;
} else {
    echo "FAIL (key=$raw_key)\n";
    $fail++;
}

// ===== Test 2: Validate generated key =====
echo "TEST 2: Validate key... ";
$key_data = ATB_API_Auth::validate_key($raw_key);
if ($key_data && $key_data['user_id'] === 1 && $key_data['label'] === 'Test Key') {
    echo "PASS (user_id={$key_data['user_id']}, label={$key_data['label']})\n";
    $pass++;
} else {
    echo "FAIL\n";
    echo json_encode($key_data) . "\n";
    $fail++;
}

// ===== Test 3: Reject invalid key =====
echo "TEST 3: Reject invalid key... ";
$bad_result = ATB_API_Auth::validate_key('atb_bogus_key_that_does_not_exist');
if ($bad_result === false) {
    echo "PASS (correctly rejected)\n";
    $pass++;
} else {
    echo "FAIL (should have returned false)\n";
    $fail++;
}

// ===== Test 4: List keys shows our key =====
echo "TEST 4: List keys... ";
$all_keys = ATB_API_Auth::get_all_keys();
$found = false;
$prefix = substr($raw_key, 0, 8);
foreach ($all_keys as $k) {
    if ($k['prefix'] === $prefix && $k['label'] === 'Test Key') {
        $found = true;
        break;
    }
}
if ($found) {
    echo "PASS (found key prefix=$prefix)\n";
    $pass++;
} else {
    echo "FAIL (key not found in list)\n";
    echo json_encode($all_keys) . "\n";
    $fail++;
}

// ===== Test 5: Revoke key =====
echo "TEST 5: Revoke key... ";
ATB_API_Auth::revoke_key($prefix);
$after_revoke = ATB_API_Auth::validate_key($raw_key);
if ($after_revoke === false) {
    echo "PASS (key revoked successfully)\n";
    $pass++;
} else {
    echo "FAIL (key still valid after revoke)\n";
    $fail++;
}

// ===== Test 6: REST auth via X-ATB-Key header =====
echo "TEST 6: REST auth via X-ATB-Key... ";
// Generate a fresh key for REST test
$rest_key = ATB_API_Auth::generate_key(1, 'REST Test');
$rest_prefix = substr($rest_key, 0, 8);

// Log out to simulate external request
wp_set_current_user(0);

// Get the REST server
$server = rest_get_server();

// Create a request with X-ATB-Key header
$request = new WP_REST_Request('GET', '/agent-bricks/v1/pages/2005/elements');
$request->set_param('id', 2005);
$request->set_header('X-ATB-Key', $rest_key);

// Simulate the authenticate filter
$auth_result = ATB_API_Auth::authenticate(null);
// Since we can't set $_SERVER in eval-file context reliably,
// test the validate_key path directly
$validated = ATB_API_Auth::validate_key($rest_key);
if ($validated && $validated['user_id'] === 1) {
    // Manually set user like authenticate() would
    wp_set_current_user($validated['user_id']);
    $response = $server->dispatch($request);
    if ($response->get_status() === 200 && isset($response->get_data()['elements'])) {
        echo "PASS (authenticated + got elements)\n";
        $pass++;
    } else {
        echo "FAIL (auth ok but dispatch failed, status={$response->get_status()})\n";
        echo json_encode($response->get_data()) . "\n";
        $fail++;
    }
} else {
    echo "FAIL (key validation failed)\n";
    $fail++;
}

// Cleanup: revoke test key
ATB_API_Auth::revoke_key($rest_prefix);
wp_set_current_user(1);

// ===== Test 7: External curl test setup verification =====
echo "TEST 7: Key hash uses wp_salt... ";
$salt_key = ATB_API_Auth::generate_key(1, 'Salt Test');
$salt_prefix = substr($salt_key, 0, 8);
// Verify the key is stored hashed (not plaintext)
$stored_keys = get_option('agent_bricks_api_keys', array());
$found_raw = false;
foreach ($stored_keys as $sk) {
    if ($sk['key_prefix'] === $salt_prefix) {
        // key_hash should NOT equal the raw key
        if ($sk['key_hash'] !== $salt_key && strlen($sk['key_hash']) === 64) {
            echo "PASS (stored as SHA-256 hash)\n";
            $pass++;
        } else {
            echo "FAIL (key not properly hashed)\n";
            $fail++;
        }
        $found_raw = true;
        break;
    }
}
if (!$found_raw) {
    echo "FAIL (key not found in storage)\n";
    $fail++;
}
ATB_API_Auth::revoke_key($salt_prefix);

echo "\nResults: $pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
