#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck disable=SC1091
source "$REPO_DIR/scripts/lib/staging-env.sh"

atb_load_repo_env "$REPO_DIR"
atb_export_staging_env
atb_require_env ATB_STAGING_URL ATB_STAGING_API_KEY ATB_STAGING_READ_PAGE_ID

exec node "$SCRIPT_DIR/run-tests.mjs"
