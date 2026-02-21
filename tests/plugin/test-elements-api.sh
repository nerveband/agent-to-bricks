#!/usr/bin/env bash
# tests/plugin/test-elements-api.sh
# Integration tests for elements API against staging via SSH + WP-CLI eval-file
# Usage: ./tests/plugin/test-elements-api.sh

set -euo pipefail

SSH_HOST="runcloud@198.23.148.52"
WP_PATH="/home/runcloud/webapps/Tayseer-Wilderness"
PHP="/RunCloud/Packages/php83rc/bin/php"
WPCLI="/usr/local/bin/wp"
TEST_PAGE=2005
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Agent to Bricks: Elements API Tests ==="
echo "Target: $SSH_HOST:$WP_PATH (page $TEST_PAGE)"
echo ""

# Upload test runner PHP file
scp -q "$SCRIPT_DIR/test-elements-runner.php" "$SSH_HOST:$WP_PATH/atb-test-runner.php" 2>/dev/null

# Run tests via eval-file
RESULT=$(ssh -o ConnectTimeout=30 "$SSH_HOST" "cd $WP_PATH && $PHP $WPCLI eval-file atb-test-runner.php $TEST_PAGE" 2>&1 | grep -v '^\*\*')

echo "$RESULT"

# Cleanup
ssh -o ConnectTimeout=10 "$SSH_HOST" "rm -f $WP_PATH/atb-test-runner.php" 2>/dev/null

# Check for failures
if echo "$RESULT" | grep -q "FAIL"; then
    exit 1
fi
if echo "$RESULT" | grep -q "0 passed"; then
    echo "ERROR: No tests ran!"
    exit 1
fi
