#!/usr/bin/env bash

atb_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  printf '%s\n' "$script_dir"
}

atb_load_repo_env() {
  local repo_root="${1:-$(atb_repo_root)}"
  if [[ -f "$repo_root/.env" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$repo_root/.env"
    set +a
  fi
}

atb_read_cli_config_value() {
  local key="$1"
  local config_path="${2:-${ATB_CONFIG_PATH:-$HOME/.agent-to-bricks/config.yaml}}"

  [[ -f "$config_path" ]] || return 1

  if [[ "$(head -c 1 "$config_path")" == "{" ]]; then
    python3 - "$config_path" "$key" <<'PY'
import json
import sys

config_path, key = sys.argv[1:]
data = json.load(open(config_path))
site = data.get("site") or {}
if not site and isinstance(data.get("sites"), list):
    active_index = data.get("active_site", 0)
    if 0 <= active_index < len(data["sites"]):
        site = data["sites"][active_index]
value = site.get(key)
if isinstance(value, str) and value:
    print(value)
PY
    return 0
  fi

  awk -v key="$key" '
    $1 == "site:" { in_site = 1; next }
    in_site && /^[^[:space:]]/ { in_site = 0 }
    in_site && $1 == key ":" {
      $1 = ""
      sub(/^[[:space:]]+/, "", $0)
      gsub(/^["'"'"']|["'"'"']$/, "", $0)
      print
      exit
    }
  ' "$config_path"
}

atb_export_staging_env() {
  local cli_url=""
  local cli_key=""

  cli_url="$(atb_read_cli_config_value url 2>/dev/null || true)"
  cli_key="$(atb_read_cli_config_value api_key 2>/dev/null || true)"

  export ATB_STAGING_URL="${ATB_STAGING_URL:-${WP_STAGING_URL:-$cli_url}}"
  export ATB_STAGING_API_KEY="${ATB_STAGING_API_KEY:-${ATB_API_KEY:-$cli_key}}"
  export ATB_STAGING_READ_PAGE_ID="${ATB_STAGING_READ_PAGE_ID:-${TEST_PAGE_ID:-}}"
  export ATB_STAGING_SCRATCH_PAGE_ID="${ATB_STAGING_SCRATCH_PAGE_ID:-${ATB_STAGING_READ_PAGE_ID:-}}"
  export ATB_STAGING_TEMPLATE_PAGE_ID="${ATB_STAGING_TEMPLATE_PAGE_ID:-${ATB_STAGING_SCRATCH_PAGE_ID:-}}"

  if [[ -n "${ATB_STAGING_URL:-}" ]]; then
    export WP_STAGING_URL="${WP_STAGING_URL:-$ATB_STAGING_URL}"
  fi
  if [[ -n "${ATB_STAGING_API_KEY:-}" ]]; then
    export ATB_API_KEY="${ATB_API_KEY:-$ATB_STAGING_API_KEY}"
  fi
  if [[ -n "${ATB_STAGING_READ_PAGE_ID:-}" ]]; then
    export TEST_PAGE_ID="${TEST_PAGE_ID:-$ATB_STAGING_READ_PAGE_ID}"
  fi
}

atb_require_env() {
  local missing=()
  local name

  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("$name")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    printf 'Missing required environment: %s\n' "${missing[*]}" >&2
    return 1
  fi
}

atb_print_staging_summary() {
  printf 'Staging URL:      %s\n' "${ATB_STAGING_URL:-"(unset)"}"
  printf 'Read page ID:     %s\n' "${ATB_STAGING_READ_PAGE_ID:-"(unset)"}"
  printf 'Scratch page ID:  %s\n' "${ATB_STAGING_SCRATCH_PAGE_ID:-"(unset)"}"
  printf 'Template page ID: %s\n' "${ATB_STAGING_TEMPLATE_PAGE_ID:-"(unset)"}"
}
