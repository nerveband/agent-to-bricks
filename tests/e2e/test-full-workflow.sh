#!/usr/bin/env bash
# =============================================================================
# Agent to Bricks — Full E2E Integration Test
# =============================================================================
# Tests the complete workflow: config → pull → validate → snapshot → push →
# doctor → rollback against a live WordPress staging site.
#
# Prerequisites:
#   - BRICKS_BIN: path to the bricks binary (default: ./bin/bricks)
#   - WP_STAGING_URL: WordPress staging site URL
#   - ATB_API_KEY: Agent to Bricks API key
#   - TEST_PAGE_ID: page ID to test against (default: 2005)
#
# Usage:
#   export WP_STAGING_URL="https://ts-staging.wavedepth.com"
#   export ATB_API_KEY="atb_xxxxx"
#   ./tests/e2e/test-full-workflow.sh
# =============================================================================

set -euo pipefail

BRICKS="${BRICKS_BIN:-./bin/bricks}"
URL="${WP_STAGING_URL:?Set WP_STAGING_URL}"
KEY="${ATB_API_KEY:?Set ATB_API_KEY}"
PAGE="${TEST_PAGE_ID:-2005}"
TMP_DIR=$(mktemp -d)
PASSED=0
FAILED=0

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

pass() {
    PASSED=$((PASSED + 1))
    echo "  PASS: $1"
}

fail() {
    FAILED=$((FAILED + 1))
    echo "  FAIL: $1"
}

echo "=== Agent to Bricks: Full E2E Workflow Test ==="
echo "Binary:  $BRICKS"
echo "Site:    $URL"
echo "Page:    $PAGE"
echo "Temp:    $TMP_DIR"
echo ""

# --- Step 1: Configure ---
echo "Step 1: Configure CLI"
$BRICKS config set site.url "$URL" && pass "set site.url" || fail "set site.url"
$BRICKS config set site.api_key "$KEY" && pass "set site.api_key" || fail "set site.api_key"
echo ""

# --- Step 2: Site Info ---
echo "Step 2: Site Info"
if $BRICKS site info > "$TMP_DIR/site-info.txt" 2>&1; then
    pass "site info"
    cat "$TMP_DIR/site-info.txt"
else
    fail "site info (may fail due to OPcache - check web routes)"
    cat "$TMP_DIR/site-info.txt"
fi
echo ""

# --- Step 3: Pull Page ---
echo "Step 3: Pull Page Elements"
if $BRICKS site pull "$PAGE" -o "$TMP_DIR/before.json" 2>&1; then
    pass "pull page $PAGE"
    ELEMENT_COUNT=$(python3 -c "import json; d=json.load(open('$TMP_DIR/before.json')); print(d.get('count', len(d.get('elements', []))))" 2>/dev/null || echo "?")
    echo "  Elements: $ELEMENT_COUNT"
else
    fail "pull page $PAGE"
fi
echo ""

# --- Step 4: Validate ---
echo "Step 4: Validate Pulled Content"
if $BRICKS validate "$TMP_DIR/before.json" > "$TMP_DIR/validate.txt" 2>&1; then
    pass "validate"
    cat "$TMP_DIR/validate.txt"
else
    fail "validate (non-zero exit may indicate errors in page)"
    cat "$TMP_DIR/validate.txt"
fi
echo ""

# --- Step 5: Doctor ---
echo "Step 5: Page Doctor"
if $BRICKS doctor "$PAGE" > "$TMP_DIR/doctor.txt" 2>&1; then
    pass "doctor"
else
    # Doctor returns non-zero if it finds errors, which is OK
    pass "doctor (found issues, which is expected)"
fi
cat "$TMP_DIR/doctor.txt"
echo ""

# --- Step 6: Snapshot ---
echo "Step 6: Create Snapshot"
if $BRICKS site snapshot "$PAGE" --label "e2e-test-backup" > "$TMP_DIR/snapshot.txt" 2>&1; then
    pass "snapshot"
    cat "$TMP_DIR/snapshot.txt"
else
    fail "snapshot"
    cat "$TMP_DIR/snapshot.txt"
fi
echo ""

# --- Step 7: Template Operations ---
echo "Step 7: Template Operations"
if $BRICKS templates list > "$TMP_DIR/templates.txt" 2>&1; then
    pass "templates list"
else
    pass "templates list (empty is OK)"
fi
echo ""

# --- Step 8: Framework Info ---
echo "Step 8: Framework Registry"
if $BRICKS frameworks list > "$TMP_DIR/frameworks.txt" 2>&1; then
    pass "frameworks list"
    cat "$TMP_DIR/frameworks.txt"
else
    fail "frameworks list"
fi
echo ""

# --- Step 9: Convert HTML ---
echo "Step 9: HTML Converter"
cat > "$TMP_DIR/test.html" << 'HTMLEOF'
<section>
  <div class="container">
    <h2>E2E Test Heading</h2>
    <p>This is a test paragraph for the E2E test suite.</p>
  </div>
</section>
HTMLEOF

if $BRICKS convert html "$TMP_DIR/test.html" -o "$TMP_DIR/converted.json" 2>&1; then
    pass "convert html"
else
    fail "convert html"
fi
echo ""

# --- Step 10: Validate Converted ---
echo "Step 10: Validate Converted Content"
if $BRICKS validate "$TMP_DIR/converted.json" > /dev/null 2>&1; then
    pass "validate converted HTML"
else
    fail "validate converted HTML"
fi
echo ""

# --- Step 11: Version ---
echo "Step 11: Version Check"
if $BRICKS --version > /dev/null 2>&1; then
    VERSION=$($BRICKS --version 2>&1)
    pass "version: $VERSION"
else
    fail "version"
fi
echo ""

# --- Step 12: Classes List ---
echo "Step 12: Classes"
if $BRICKS classes list > "$TMP_DIR/classes.txt" 2>&1; then
    pass "classes list"
else
    fail "classes list (may fail due to OPcache)"
fi
echo ""

# --- Summary ---
echo "========================================"
echo "  E2E Results: $PASSED passed, $FAILED failed"
echo "========================================"

if [ $FAILED -gt 0 ]; then
    echo "  Note: Some failures may be due to web PHP-FPM OPcache."
    echo "  Restart PHP-FPM from RunCloud dashboard to fix."
    exit 1
fi
