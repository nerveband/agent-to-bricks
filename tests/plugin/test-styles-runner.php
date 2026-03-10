<?php
/**
 * ATB Styles API regression tests.
 * Run via: wp eval-file test-styles-runner.php
 */
wp_set_current_user(1);

$pass = 0;
$fail = 0;

$method = new ReflectionMethod('ATB_Styles_API', 'extract_custom_properties');
$vars = $method->invoke(null, ':root{--data:url(data:text/plain;utf8,hello);--token:"a;b";--color:#fff;}', 'inline');
$by_name = array();
foreach ($vars as $var) {
	$by_name[$var['name']] = $var['value'];
}

echo "TEST 1: data URI custom property... ";
if (($by_name['--data'] ?? null) === 'url(data:text/plain;utf8,hello)') {
	echo "PASS\n";
	$pass++;
} else {
	echo "FAIL\n";
	echo json_encode($vars) . "\n";
	$fail++;
}

echo "TEST 2: quoted semicolon custom property... ";
if (($by_name['--token'] ?? null) === '"a;b"') {
	echo "PASS\n";
	$pass++;
} else {
	echo "FAIL\n";
	echo json_encode($vars) . "\n";
	$fail++;
}

echo "TEST 3: plain property still extracted... ";
if (($by_name['--color'] ?? null) === '#fff') {
	echo "PASS\n";
	$pass++;
} else {
	echo "FAIL\n";
	echo json_encode($vars) . "\n";
	$fail++;
}

echo "\n=== Styles API Summary ===\n";
echo "Passed: $pass\n";
echo "Failed: $fail\n";

exit($fail > 0 ? 1 : 0);
