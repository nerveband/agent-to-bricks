<?php
/**
 * ATB Element Validator CSS formatting test runner.
 * Run via: wp eval-file test-element-validator-runner.php
 */
wp_set_current_user( 1 );

$pass = 0;
$fail = 0;

function assert_same_css( $label, $input, $expected ) {
	global $pass, $fail;

	echo "TEST: {$label}... ";
	$settings = ATB_Element_Validator::sanitize_settings(
		array(
			'_cssCustom' => $input,
		)
	);
	$actual = $settings['_cssCustom'] ?? null;

	if ( $actual === $expected ) {
		echo "PASS\n";
		$pass++;
		return;
	}

	echo "FAIL\n";
	echo "Expected:\n{$expected}\n";
	echo "Actual:\n{$actual}\n";
	$fail++;
}

assert_same_css(
	'Formats minified CSS',
	'.x{color:red}',
	".x {\n  color:red\n}"
);

assert_same_css(
	'Preserves encoded data URI values',
	'.x{background:url(data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E);color:red}',
	".x {\n  background:url(data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E);\n  color:red\n}"
);

assert_same_css(
	'Preserves quoted braces',
	'.x{content:"}";color:red}',
	".x {\n  content:\"}\";\n  color:red\n}"
);

assert_same_css(
	'Preserves semicolons inside strings',
	'.x{--token:"a;b";color:red}',
	".x {\n  --token:\"a;b\";\n  color:red\n}"
);

echo "\nResults: {$pass} passed, {$fail} failed\n";
exit( $fail > 0 ? 1 : 0 );
