#!/usr/bin/env bash
# tests/plugin/test-elements-api.sh
# Integration tests for elements API against staging via SSH + WP-CLI eval-file
# Usage: ./tests/plugin/test-elements-api.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck disable=SC1091
source "$PROJECT_DIR/scripts/lib/staging-env.sh"

atb_load_repo_env "$PROJECT_DIR"
atb_export_staging_env
atb_require_env SSH_HOST WP_PATH PHP_BIN WPCLI_BIN ATB_STAGING_SCRATCH_PAGE_ID

SSH_PASS="${SSH_PASSWORD:-${WP_APP_PASS:-}}"
if command -v sshpass >/dev/null 2>&1 && [[ -n "$SSH_PASS" ]]; then
  SSH_PREFIX=(sshpass -p "$SSH_PASS")
else
  SSH_PREFIX=()
fi

SSH_CMD=("${SSH_PREFIX[@]}" ssh -o ConnectTimeout=30 "$SSH_HOST")
REMOTE_HOME="/home/${SSH_HOST%%@*}"
PHP="$PHP_BIN"
WPCLI="$WPCLI_BIN"
TEST_PAGE="$ATB_STAGING_SCRATCH_PAGE_ID"

echo "=== Agent to Bricks: Elements API Tests ==="
echo "Target: $SSH_HOST:$WP_PATH (page $TEST_PAGE)"
echo ""

# Upload test runner PHP file
"${SSH_CMD[@]}" "cat > $REMOTE_HOME/atb-test-runner.php" <"$SCRIPT_DIR/test-elements-runner.php" 2>/dev/null

# Run tests via eval-file (don't fail on non-zero exit from test runner)
RESULT=$("${SSH_CMD[@]}" "cd $WP_PATH && $PHP $WPCLI eval-file $REMOTE_HOME/atb-test-runner.php $TEST_PAGE 2>&1" 2>/dev/null | grep -v '^\*\*' || true)

echo "$RESULT"

# Cleanup
"${SSH_CMD[@]}" "rm -f $REMOTE_HOME/atb-test-runner.php" 2>/dev/null

# Check for failures
if echo "$RESULT" | grep -q "FAIL"; then
    exit 1
fi
if echo "$RESULT" | grep -q "0 passed"; then
    echo "ERROR: No tests ran!"
    exit 1
fi
