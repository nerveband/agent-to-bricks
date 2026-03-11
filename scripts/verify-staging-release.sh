#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# shellcheck disable=SC1091
source "$PROJECT_DIR/scripts/lib/staging-env.sh"

atb_load_repo_env "$PROJECT_DIR"
atb_export_staging_env
atb_require_env ATB_STAGING_URL ATB_STAGING_API_KEY ATB_STAGING_READ_PAGE_ID ATB_STAGING_SCRATCH_PAGE_ID ATB_STAGING_TEMPLATE_PAGE_ID SSH_HOST WP_PATH PHP_BIN WPCLI_BIN

BRICKS_BIN="${BRICKS_BIN:-$PROJECT_DIR/bin/bricks}"
SOCKET_PATH="${TAURI_MCP_IPC_PATH:-/tmp/tauri-mcp-atb.sock}"
GUI_VITE_PORT="${ATB_GUI_DEV_PORT:-1420}"
GUI_LOG="$(mktemp)"
GUI_PID=""

stop_stale_gui_dev_server() {
  local stale_pids=()

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    stale_pids+=("$pid")
  done < <(lsof -tiTCP:"$GUI_VITE_PORT" -sTCP:LISTEN 2>/dev/null | sort -u)

  if [[ "${#stale_pids[@]}" -gt 0 ]]; then
    echo "Stopping stale GUI dev server on port $GUI_VITE_PORT: ${stale_pids[*]}"
    kill "${stale_pids[@]}" >/dev/null 2>&1 || true
    sleep 2
  fi
}

cleanup() {
  if [[ -n "$GUI_PID" ]]; then
    kill "$GUI_PID" >/dev/null 2>&1 || true
    wait "$GUI_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$GUI_LOG"
}
trap cleanup EXIT

echo "=== Agent to Bricks staging release gate ==="
atb_print_staging_summary

(cd "$PROJECT_DIR" && make build)
"$PROJECT_DIR/scripts/deploy-staging.sh"

http_code="$(
  curl -s -o /dev/null -w "%{http_code}" \
    -H "X-ATB-Key: $ATB_STAGING_API_KEY" \
    "$ATB_STAGING_URL/wp-json/agent-bricks/v1/site/info"
)"
if [[ "$http_code" != "200" ]]; then
  echo "Staging verification failed: expected /site/info to return 200, got $http_code" >&2
  exit 1
fi

"$PROJECT_DIR/tests/plugin/run-staging-suite.sh"
BRICKS_BIN="$BRICKS_BIN" "$PROJECT_DIR/tests/e2e/test-full-workflow.sh"
BRICKS_BIN="$BRICKS_BIN" "$PROJECT_DIR/tests/e2e/test-template-smoke.sh"

if [[ "${ATB_SKIP_GUI_E2E:-0}" == "1" ]]; then
  echo "Skipping GUI E2E because ATB_SKIP_GUI_E2E=1"
  exit 0
fi

stop_stale_gui_dev_server
rm -f "$SOCKET_PATH"
(
  cd "$PROJECT_DIR/gui"
  npm run dev:mcp
) >"$GUI_LOG" 2>&1 &
GUI_PID="$!"

for _ in $(seq 1 90); do
  if [[ -S "$SOCKET_PATH" ]]; then
    break
  fi
  if ! kill -0 "$GUI_PID" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if [[ ! -S "$SOCKET_PATH" ]]; then
  cat "$GUI_LOG"
  echo "GUI E2E failed: MCP socket did not appear at $SOCKET_PATH" >&2
  exit 1
fi

TAURI_MCP_IPC_PATH="$SOCKET_PATH" "$PROJECT_DIR/gui/e2e/run-tests.sh"
