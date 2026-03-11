#!/usr/bin/env bash
# scripts/deploy-staging.sh
# Deploy plugin to staging server via SSH + SCP
# Usage: ./scripts/deploy-staging.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# shellcheck disable=SC1091
source "$PROJECT_DIR/scripts/lib/staging-env.sh"

atb_load_repo_env "$PROJECT_DIR"
atb_export_staging_env

SSH_PASS="${SSH_PASSWORD:-${WP_APP_PASS:-}}"
if command -v sshpass >/dev/null 2>&1 && [[ -n "$SSH_PASS" ]]; then
    SSH_PREFIX=(sshpass -p "$SSH_PASS")
else
    SSH_PREFIX=()
fi

SSH_OPTIONS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
SSH_CMD=("${SSH_PREFIX[@]}" ssh "${SSH_OPTIONS[@]}" "$SSH_HOST")
SCP_CMD=("${SSH_PREFIX[@]}" scp -q "${SSH_OPTIONS[@]}")
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
"${SCP_CMD[@]}" /tmp/agent-to-bricks.zip "$SSH_HOST:/tmp/agent-to-bricks.zip" 2>/dev/null
echo "done"

# 3. Extract (replace existing)
echo -n "Installing... "
"${SSH_CMD[@]}" "cd $WP_PATH/wp-content/plugins && rm -rf agent-to-bricks && unzip -qo /tmp/agent-to-bricks.zip && rm /tmp/agent-to-bricks.zip" 2>/dev/null
echo "done"

# 4. Ensure plugin is active
echo -n "Activating... "
ACTIVATE_OUTPUT=$("${SSH_CMD[@]}" "cd $WP_PATH && $WP_CMD plugin activate agent-to-bricks 2>&1" 2>/dev/null || true)
if echo "$ACTIVATE_OUTPUT" | grep -q "already active\|Activated"; then
    echo "done"
else
    echo "warning: $ACTIVATE_OUTPUT"
fi

# 5. Flush caches
echo -n "Flushing caches... "
"${SSH_CMD[@]}" "cd $WP_PATH && $WP_CMD cache flush 2>/dev/null && $WP_CMD rewrite flush 2>/dev/null" 2>/dev/null || true
echo "done"

# 6. Restore ownership (best effort)
if [[ -n "${WP_APP_USER:-}" ]]; then
    echo -n "Fixing ownership... "
    "${SSH_CMD[@]}" "chown -R '$WP_APP_USER':'$WP_APP_USER' '$PLUGIN_DIR'" 2>/dev/null || true
    echo "done"
fi

# 7. Reload PHP-FPM (best effort)
PHP_SERIES="$(basename "$(dirname "$(dirname "$PHP_BIN")")")"
echo -n "Reloading PHP-FPM... "
"${SSH_CMD[@]}" "sudo -n systemctl reload '$PHP_SERIES-fpm' 2>/dev/null || sudo -n service '$PHP_SERIES-fpm' reload 2>/dev/null || true" 2>/dev/null || true
echo "done"

# 8. Verify REST endpoint (best effort if API key is configured)
if [[ -n "${ATB_STAGING_URL:-}" && -n "${ATB_STAGING_API_KEY:-}" ]]; then
    echo -n "Verifying site info... "
    HTTP_CODE="$(
        curl -s -o /dev/null -w "%{http_code}" \
            -H "X-ATB-Key: $ATB_STAGING_API_KEY" \
            "$ATB_STAGING_URL/wp-json/agent-bricks/v1/site/info"
    )"
    if [[ "$HTTP_CODE" == "200" ]]; then
        echo "done"
    else
        echo "failed ($HTTP_CODE)"
        exit 1
    fi
fi

echo ""
echo "Deploy complete!"
