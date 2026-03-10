#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck disable=SC1091
source "$PROJECT_DIR/scripts/lib/staging-env.sh"

atb_load_repo_env "$PROJECT_DIR"
atb_export_staging_env
atb_require_env SSH_HOST WP_PATH PHP_BIN WPCLI_BIN ATB_STAGING_READ_PAGE_ID ATB_STAGING_SCRATCH_PAGE_ID

SSH_PASS="${SSH_PASSWORD:-${WP_APP_PASS:-}}"
if command -v sshpass >/dev/null 2>&1 && [[ -n "$SSH_PASS" ]]; then
  SSH_PREFIX=(sshpass -p "$SSH_PASS")
else
  SSH_PREFIX=()
fi

SSH_CMD=("${SSH_PREFIX[@]}" ssh -o ConnectTimeout=30 "$SSH_HOST")
REMOTE_HOME="/home/${SSH_HOST%%@*}"
WP_CMD="$PHP_BIN $WPCLI_BIN"
STATUS=0

run_runner() {
  local runner_name="$1"
  local page_id="${2:-}"
  local runner_path="$SCRIPT_DIR/$runner_name"
  local remote_path="$REMOTE_HOME/$runner_name"
  local result

  echo "=== $runner_name ==="
  "${SSH_CMD[@]}" "cat > '$remote_path'" <"$runner_path"

  if [[ -n "$page_id" ]]; then
    result="$("${SSH_CMD[@]}" "cd '$WP_PATH' && $WP_CMD eval-file '$remote_path' '$page_id' 2>&1" | grep -v '^\*\*' || true)"
  else
    result="$("${SSH_CMD[@]}" "cd '$WP_PATH' && $WP_CMD eval-file '$remote_path' 2>&1" | grep -v '^\*\*' || true)"
  fi

  printf '%s\n' "$result"
  "${SSH_CMD[@]}" "rm -f '$remote_path'" >/dev/null 2>&1 || true

  if grep -q "FAIL" <<<"$result" || grep -q "0 passed" <<<"$result"; then
    STATUS=1
  fi
  echo ""
}

run_runner "test-api-auth-runner.php" "$ATB_STAGING_READ_PAGE_ID"
run_runner "test-site-runner.php"
run_runner "test-element-types-runner.php"
run_runner "test-classes-runner.php"
run_runner "test-components-runner.php"
run_runner "test-search-runner.php"
run_runner "test-elements-runner.php" "$ATB_STAGING_SCRATCH_PAGE_ID"
run_runner "test-snapshots-runner.php" "$ATB_STAGING_SCRATCH_PAGE_ID"
run_runner "test-templates-runner.php"

exit "$STATUS"
