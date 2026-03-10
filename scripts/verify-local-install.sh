#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# shellcheck disable=SC1091
source "$PROJECT_DIR/scripts/lib/staging-env.sh"

atb_load_repo_env "$PROJECT_DIR"
atb_export_staging_env

TMP_DIR="$(mktemp -d)"
CONFIG_PATH="$TMP_DIR/config.yaml"
SITE_INFO_LOG="$TMP_DIR/site-info.txt"

resolve_installed_bricks() {
  local candidates=(
    "/opt/homebrew/bin/bricks"
    "$HOME/.local/bin/bricks"
    "/usr/local/bin/bricks"
  )
  local candidate

  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  command -v bricks
}

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "=== Local CLI install verification ==="
(cd "$PROJECT_DIR" && make build)
(cd "$PROJECT_DIR" && make install)

BRICKS_PATH="$(resolve_installed_bricks)"
if [[ -z "$BRICKS_PATH" ]]; then
  echo "bricks is not on PATH after install" >&2
  exit 1
fi

echo "Installed binary: $BRICKS_PATH"
if [[ "$(command -v bricks || true)" != "$BRICKS_PATH" ]]; then
  echo "Warning: \`bricks\` resolves to $(command -v bricks || true) before the installed binary."
  echo "Using the installed binary directly for verification."
fi
"$BRICKS_PATH" --version

if [[ -n "${ATB_STAGING_URL:-}" && -n "${ATB_STAGING_API_KEY:-}" ]]; then
  echo "Verifying staging connectivity with a temporary config..."
  "$BRICKS_PATH" --config "$CONFIG_PATH" config set site.url "$ATB_STAGING_URL" >/dev/null
  "$BRICKS_PATH" --config "$CONFIG_PATH" config set site.api_key "$ATB_STAGING_API_KEY" >/dev/null
  "$BRICKS_PATH" --config "$CONFIG_PATH" site info >"$SITE_INFO_LOG" 2>&1
  sed -n '1,40p' "$SITE_INFO_LOG"
else
  echo "Skipping staging connectivity check; ATB_STAGING_URL / ATB_STAGING_API_KEY not configured."
fi
