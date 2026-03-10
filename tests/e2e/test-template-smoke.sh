#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck disable=SC1091
source "$PROJECT_DIR/scripts/lib/staging-env.sh"

atb_load_repo_env "$PROJECT_DIR"
atb_export_staging_env
atb_require_env ATB_STAGING_URL ATB_STAGING_API_KEY ATB_STAGING_TEMPLATE_PAGE_ID

BRICKS="${BRICKS_BIN:-$PROJECT_DIR/bin/bricks}"
TEMPLATE_ROOT="$PROJECT_DIR/docs/test-data/templates"
TMP_DIR="$(mktemp -d)"
TMP_HOME="$TMP_DIR/home"
CONFIG_PATH="$TMP_DIR/config.yaml"
COMPOSED_JSON="$TMP_DIR/composed.json"
BEFORE_JSON="$TMP_DIR/before.json"
AFTER_JSON="$TMP_DIR/after.json"
RESTORED_JSON="$TMP_DIR/restored.json"
DOCTOR_LOG="$TMP_DIR/doctor.txt"
SNAPSHOT_ID=""

cleanup() {
  if [[ -n "$SNAPSHOT_ID" ]]; then
    HOME="$TMP_HOME" "$BRICKS" --config "$CONFIG_PATH" site rollback "$ATB_STAGING_TEMPLATE_PAGE_ID" "$SNAPSHOT_ID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ ! -d "$TEMPLATE_ROOT" ]]; then
  echo "Template corpus not present at $TEMPLATE_ROOT; skipping local-only template smoke test."
  exit 0
fi

mkdir -p "$TMP_HOME"

run_bricks() {
  HOME="$TMP_HOME" "$BRICKS" --config "$CONFIG_PATH" "$@"
}

read_json_field() {
  local file="$1"
  local field="$2"
  python3 - "$file" "$field" <<'PY'
import json
import sys

path, field = sys.argv[1:]
data = json.load(open(path))
value = data
for part in field.split("."):
    value = value[part]
print(value)
PY
}

template_name_from_file() {
  local file="$1"
  python3 - "$file" <<'PY'
import json
import sys

data = json.load(open(sys.argv[1]))
print(data.get("name") or data.get("title") or "")
PY
}

echo "=== Agent to Bricks: template smoke test ==="
atb_print_staging_summary

run_bricks config set site.url "$ATB_STAGING_URL" >/dev/null
run_bricks config set site.api_key "$ATB_STAGING_API_KEY" >/dev/null

categories=(hero feature-section faq-section pricing-section testimonial-section)
selected_files=()
for category in "${categories[@]}"; do
  candidate="$(find "$TEMPLATE_ROOT/$category" -maxdepth 1 -type f -name '*.json' | sort | head -n 1 || true)"
  if [[ -n "$candidate" ]]; then
    selected_files+=("$candidate")
  fi
done

if (( ${#selected_files[@]} < 3 )); then
  echo "Expected at least 3 curated templates, found ${#selected_files[@]}" >&2
  exit 1
fi

template_names=()
for file in "${selected_files[@]}"; do
  run_bricks templates import "$file" >/dev/null
  template_names+=("$(template_name_from_file "$file")")
done

printf 'Selected templates:\n'
printf '  %s\n' "${template_names[@]}"

run_bricks site pull "$ATB_STAGING_TEMPLATE_PAGE_ID" -o "$BEFORE_JSON" >/dev/null
before_hash="$(read_json_field "$BEFORE_JSON" "contentHash")"

snapshot_output="$(run_bricks site snapshot "$ATB_STAGING_TEMPLATE_PAGE_ID" --label "template-smoke-$(date +%Y%m%d-%H%M%S)")"
SNAPSHOT_ID="$(printf '%s\n' "$snapshot_output" | sed -E 's/^Snapshot created: ([^ ]+).*/\1/')"
if [[ -z "$SNAPSHOT_ID" ]]; then
  echo "Failed to parse snapshot ID from: $snapshot_output" >&2
  exit 1
fi

run_bricks compose "${template_names[@]}" -o "$COMPOSED_JSON" >/dev/null
run_bricks validate "$COMPOSED_JSON" >/dev/null
run_bricks compose "${template_names[@]}" --push "$ATB_STAGING_TEMPLATE_PAGE_ID" >/dev/null

if ! run_bricks doctor "$ATB_STAGING_TEMPLATE_PAGE_ID" >"$DOCTOR_LOG" 2>&1; then
  cat "$DOCTOR_LOG"
  exit 1
fi

run_bricks site pull "$ATB_STAGING_TEMPLATE_PAGE_ID" -o "$AFTER_JSON" >/dev/null
run_bricks validate "$AFTER_JSON" >/dev/null

run_bricks site rollback "$ATB_STAGING_TEMPLATE_PAGE_ID" "$SNAPSHOT_ID" >/dev/null
SNAPSHOT_ID=""

run_bricks site pull "$ATB_STAGING_TEMPLATE_PAGE_ID" -o "$RESTORED_JSON" >/dev/null
restored_hash="$(read_json_field "$RESTORED_JSON" "contentHash")"

if [[ "$restored_hash" != "$before_hash" ]]; then
  echo "Rollback hash mismatch: expected $before_hash, got $restored_hash" >&2
  exit 1
fi

echo "Template smoke test passed."
