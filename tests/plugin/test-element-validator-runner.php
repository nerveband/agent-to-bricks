<?php
/**
 * ATB Element Validator CSS formatting test runner.
 * Run via: wp eval-file test-element-validator-runner.php
 */
wp_set_current_user( 1 );

$pass = 0;
$fail = 0;
$GLOBALS['pass'] = 0;
$GLOBALS['fail'] = 0;

function assert_same_css( $label, $input, $expected ) {
	echo "TEST: {$label}... ";
	$settings = ATB_Element_Validator::sanitize_settings(
		array(
			'_cssCustom' => $input,
		)
	);
	$actual = $settings['_cssCustom'] ?? null;

	if ( $actual === $expected ) {
		echo "PASS\n";
		$GLOBALS['pass']++;
		return;
	}

	echo "FAIL\n";
	echo "Expected:\n{$expected}\n";
	echo "Actual:\n{$actual}\n";
	$GLOBALS['fail']++;
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


function assert_true( $label, $condition, $message ) {
	echo "TEST: {$label}... ";
	if ( $condition ) {
		echo "PASS
";
		$GLOBALS['pass']++;
		return;
	}
	echo "FAIL
";
	echo $message . "
";
	$GLOBALS['fail']++;
}

$flat = ATB_Element_Validator::sanitize_flat_elements(
	array(
		array(
			'id' => 'abc123',
			'name' => 'slot',
			'parent' => 'root001',
			'children' => array( 'def456' ),
			'cid' => 'component-1',
			'slotChildren' => array( 'slotChildA', 'slotChildB' ),
			'parentComponent' => 'parent-comp',
			'instanceId' => 'instance-xyz',
			'_hideElementFrontend' => true,
			'settings' => array( 'queryId' => 'filter-main' ),
		),
	)
);

assert_true(
	'Preserves Bricks 2.3 component fields in flat sanitizer',
	isset( $flat[0]['cid'], $flat[0]['slotChildren'], $flat[0]['parentComponent'], $flat[0]['instanceId'], $flat[0]['_hideElementFrontend'] ),
	'Expected cid/slotChildren/parentComponent/instanceId/_hideElementFrontend to be preserved.'
);

$validated = ATB_Element_Validator::validate(
	array(
		'elements' => array(
			array(
				'name' => 'query-results-summary',
				'settings' => array( 'queryId' => 'products' ),
			),
			array(
				'name' => 'filter-select',
				'settings' => array( 'queryId' => 'products', 'source' => 'taxonomy' ),
			),
		),
	)
);

assert_true(
	'Bricks 2.3 query/filter element names are accepted without warnings',
	empty( $validated['warnings'] ),
	'Expected no warnings for query-results-summary and filter-select.'
);

$pass = $GLOBALS['pass'];
$fail = $GLOBALS['fail'];

echo "\nResults: {$pass} passed, {$fail} failed\n";
exit( $fail > 0 ? 1 : 0 );
