#!/usr/bin/env bash
# scripts/deploy-staging.sh
# Deploy plugin to staging server via SSH + SCP
# Usage: ./scripts/deploy-staging.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env
set -a
source "$PROJECT_DIR/.env"
set +a

SSH_CMD="ssh -o ConnectTimeout=10 $SSH_HOST"
WP_CMD="$PHP_BIN $WPCLI_BIN"
PLUGIN_DIR="$WP_PATH/wp-content/plugins/agent-to-bricks"

echo "=== Deploying agent-to-bricks to staging ==="
echo "Server: $SSH_HOST"
echo "Path: $WP_PATH"

# 1. Create plugin zip
echo -n "Creating zip... "
cd "$PROJECT_DIR/plugin"
zip -rq /tmp/agent-to-bricks.zip agent-to-bricks/
echo "done"

# 2. Upload
echo -n "Uploading... "
scp -q /tmp/agent-to-bricks.zip "$SSH_HOST:/tmp/agent-to-bricks.zip" 2>/dev/null
echo "done"

# 3. Extract (replace existing)
echo -n "Installing... "
$SSH_CMD "cd $WP_PATH/wp-content/plugins && rm -rf agent-to-bricks && unzip -qo /tmp/agent-to-bricks.zip && rm /tmp/agent-to-bricks.zip" 2>/dev/null
echo "done"

# 4. Ensure plugin is active
echo -n "Activating... "
ACTIVATE_OUTPUT=$($SSH_CMD "cd $WP_PATH && $WP_CMD plugin activate agent-to-bricks 2>&1" 2>/dev/null || true)
if echo "$ACTIVATE_OUTPUT" | grep -q "already active\|Activated"; then
    echo "done"
else
    echo "warning: $ACTIVATE_OUTPUT"
fi

# 5. Flush caches
echo -n "Flushing caches... "
$SSH_CMD "cd $WP_PATH && $WP_CMD cache flush 2>/dev/null && $WP_CMD rewrite flush 2>/dev/null" 2>/dev/null || true
echo "done"

echo ""
echo "Deploy complete!"
