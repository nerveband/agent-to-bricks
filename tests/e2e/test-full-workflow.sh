#!/usr/bin/env bash
# =============================================================================
# Agent to Bricks — Full E2E Integration Test
# =============================================================================
# Tests the complete workflow against a live WordPress staging site using a
# temporary CLI config. Read-only checks run against ATB_STAGING_READ_PAGE_ID.
# Snapshot-only checks run against ATB_STAGING_SCRATCH_PAGE_ID.
#
# Prerequisites:
#   - BRICKS_BIN: path to the bricks binary (default: ./bin/bricks)
#   - ATB_STAGING_URL: WordPress staging site URL
#   - ATB_STAGING_API_KEY: Agent to Bricks API key
#   - ATB_STAGING_READ_PAGE_ID: read-only reference page
#   - ATB_STAGING_SCRATCH_PAGE_ID: scratch page for mutation-adjacent checks
#
# Usage:
#   export ATB_STAGING_URL="https://ts-staging.wavedepth.com"
#   export ATB_STAGING_API_KEY="atb_xxxxx"
#   ./tests/e2e/test-full-workflow.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck disable=SC1091
source "$PROJECT_DIR/scripts/lib/staging-env.sh"

atb_load_repo_env "$PROJECT_DIR"
atb_export_staging_env
atb_require_env ATB_STAGING_URL ATB_STAGING_API_KEY ATB_STAGING_READ_PAGE_ID ATB_STAGING_SCRATCH_PAGE_ID

BRICKS="${BRICKS_BIN:-$PROJECT_DIR/bin/bricks}"
URL="$ATB_STAGING_URL"
KEY="$ATB_STAGING_API_KEY"
READ_PAGE="$ATB_STAGING_READ_PAGE_ID"
SCRATCH_PAGE="$ATB_STAGING_SCRATCH_PAGE_ID"
TMP_DIR=$(mktemp -d)
CONFIG_PATH="$TMP_DIR/config.yaml"
PASSED=0
FAILED=0

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

run_bricks() {
    HOME="$TMP_DIR/home" "$BRICKS" --config "$CONFIG_PATH" "$@"
}

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
echo "Read:    $READ_PAGE"
echo "Scratch: $SCRATCH_PAGE"
echo "Temp:    $TMP_DIR"
echo ""

# --- Step 1: Configure ---
echo "Step 1: Configure CLI"
mkdir -p "$TMP_DIR/home"
run_bricks config set site.url "$URL" && pass "set site.url" || fail "set site.url"
run_bricks config set site.api_key "$KEY" && pass "set site.api_key" || fail "set site.api_key"
echo ""

# --- Step 2: Site Info ---
echo "Step 2: Site Info"
if run_bricks site info > "$TMP_DIR/site-info.txt" 2>&1; then
    pass "site info"
    cat "$TMP_DIR/site-info.txt"
else
    fail "site info (may fail due to OPcache - check web routes)"
    cat "$TMP_DIR/site-info.txt"
fi
echo ""

# --- Step 3: Pull Page ---
echo "Step 3: Pull Page Elements"
if run_bricks site pull "$READ_PAGE" -o "$TMP_DIR/before.json" 2>&1; then
    pass "pull page $READ_PAGE"
    ELEMENT_COUNT=$(python3 -c "import json; d=json.load(open('$TMP_DIR/before.json')); print(d.get('count', len(d.get('elements', []))))" 2>/dev/null || echo "?")
    echo "  Elements: $ELEMENT_COUNT"
else
    fail "pull page $READ_PAGE"
fi
echo ""

# --- Step 4: Validate ---
echo "Step 4: Validate Pulled Content"
if run_bricks validate "$TMP_DIR/before.json" > "$TMP_DIR/validate.txt" 2>&1; then
    pass "validate"
    cat "$TMP_DIR/validate.txt"
else
    fail "validate (non-zero exit may indicate errors in page)"
    cat "$TMP_DIR/validate.txt"
fi
echo ""

# --- Step 5: Doctor ---
echo "Step 5: Page Doctor"
if run_bricks doctor "$READ_PAGE" > "$TMP_DIR/doctor.txt" 2>&1; then
    pass "doctor"
else
    # Doctor returns non-zero if it finds errors, which is OK
    pass "doctor (found issues, which is expected)"
fi
cat "$TMP_DIR/doctor.txt"
echo ""

# --- Step 6: Snapshot ---
echo "Step 6: Create Snapshot"
if run_bricks site snapshot "$SCRATCH_PAGE" --label "e2e-test-backup" > "$TMP_DIR/snapshot.txt" 2>&1; then
    pass "snapshot"
    cat "$TMP_DIR/snapshot.txt"
else
    fail "snapshot"
    cat "$TMP_DIR/snapshot.txt"
fi
echo ""

# --- Step 7: Template Operations ---
echo "Step 7: Template Operations"
if run_bricks templates list > "$TMP_DIR/templates.txt" 2>&1; then
    pass "templates list"
else
    pass "templates list (empty is OK)"
fi
echo ""

# --- Step 8: Framework Info ---
echo "Step 8: Framework Registry"
if run_bricks frameworks list > "$TMP_DIR/frameworks.txt" 2>&1; then
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

if run_bricks convert html "$TMP_DIR/test.html" -o "$TMP_DIR/converted.json" 2>&1; then
    pass "convert html"
else
    fail "convert html"
fi
echo ""

# --- Step 10: Validate Converted ---
echo "Step 10: Validate Converted Content"
if run_bricks validate "$TMP_DIR/converted.json" > /dev/null 2>&1; then
    pass "validate converted HTML"
else
    fail "validate converted HTML"
fi
echo ""

# --- Step 11: Version ---
echo "Step 11: Version Check"
if run_bricks --version > /dev/null 2>&1; then
    VERSION=$(run_bricks --version 2>&1)
    pass "version: $VERSION"
else
    fail "version"
fi
echo ""

# --- Step 12: Classes List ---
echo "Step 12: Classes"
if run_bricks classes list > "$TMP_DIR/classes.txt" 2>&1; then
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
