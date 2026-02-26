#!/usr/bin/env bash
set -euo pipefail

# sync-version.sh — Single source of truth version synchronization
# Reads the VERSION file and propagates it to all components.
# Usage:
#   ./scripts/sync-version.sh           # Update all version references
#   ./scripts/sync-version.sh --check   # Verify only, exit 1 on mismatch

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION_FILE="$ROOT_DIR/VERSION"

# --- Helpers ---

die() {
    echo "ERROR: $*" >&2
    exit 1
}

# Cross-platform sed in-place with extended regex
# Usage: sedi 'pattern' file
sedi() {
    local pattern="$1"
    local file="$2"
    if sed --version >/dev/null 2>&1; then
        # GNU sed (Linux)
        sed -i -E "$pattern" "$file"
    else
        # BSD sed (macOS)
        sed -i '' -E "$pattern" "$file"
    fi
}

# --- Read & validate version ---

[ -f "$VERSION_FILE" ] || die "VERSION file not found at $VERSION_FILE"

VERSION="$(cat "$VERSION_FILE")"

# Validate semver (major.minor.patch, optional pre-release/build metadata)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$'; then
    die "Invalid semver format: '$VERSION'"
fi

echo "Version: $VERSION"

# --- File paths ---

PLUGIN_PHP="$ROOT_DIR/plugin/agent-to-bricks/agent-to-bricks.php"
GUI_PACKAGE_JSON="$ROOT_DIR/gui/package.json"
TAURI_CONF_JSON="$ROOT_DIR/gui/src-tauri/tauri.conf.json"
TAURI_CARGO_TOML="$ROOT_DIR/gui/src-tauri/Cargo.toml"

# --- Check mode ---

CHECK_MODE=false
if [ "${1:-}" = "--check" ]; then
    CHECK_MODE=true
fi

ERRORS=0

check_or_update() {
    local file="$1"
    local label="$2"
    local pattern="$3"
    local current="$4"

    if [ "$current" != "$VERSION" ]; then
        if $CHECK_MODE; then
            echo "MISMATCH [$label]: found '$current', expected '$VERSION' in $file"
            ERRORS=$((ERRORS + 1))
        else
            sedi "$pattern" "$file"
            echo "Updated  [$label]: $current -> $VERSION in $file"
        fi
    else
        echo "OK       [$label]: $VERSION"
    fi
}

# --- 1. Plugin PHP: header comment Version ---

[ -f "$PLUGIN_PHP" ] || die "Plugin file not found: $PLUGIN_PHP"

PLUGIN_HEADER_VER="$(grep -E '^ \* Version:' "$PLUGIN_PHP" | sed -E 's/^ \* Version: *([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"

check_or_update "$PLUGIN_PHP" "plugin-header" \
    "s/^( \\* Version:) .*/\\1 $VERSION/" \
    "$PLUGIN_HEADER_VER"

# --- 2. Plugin PHP: AGENT_BRICKS_VERSION constant ---

PLUGIN_CONST_VER="$(grep "^define( 'AGENT_BRICKS_VERSION'" "$PLUGIN_PHP" | sed -E "s/.*'([0-9]+\.[0-9]+\.[0-9]+[^']*)'.*/\1/")"

check_or_update "$PLUGIN_PHP" "plugin-constant" \
    "s/^(define\\( 'AGENT_BRICKS_VERSION', ')[^']*('.*)/\\1$VERSION\\2/" \
    "$PLUGIN_CONST_VER"

# --- 3. GUI package.json ---

[ -f "$GUI_PACKAGE_JSON" ] || die "GUI package.json not found: $GUI_PACKAGE_JSON"

GUI_PKG_VER="$(grep '"version"' "$GUI_PACKAGE_JSON" | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')"

check_or_update "$GUI_PACKAGE_JSON" "gui-package.json" \
    "s/(\"version\": \")[^\"]*/\\1$VERSION/" \
    "$GUI_PKG_VER"

# --- 4. Tauri conf.json ---

[ -f "$TAURI_CONF_JSON" ] || die "Tauri conf.json not found: $TAURI_CONF_JSON"

TAURI_CONF_VER="$(grep '"version"' "$TAURI_CONF_JSON" | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')"

check_or_update "$TAURI_CONF_JSON" "tauri-conf.json" \
    "s/(\"version\": \")[^\"]*/\\1$VERSION/" \
    "$TAURI_CONF_VER"

# --- 5. Tauri Cargo.toml ---

[ -f "$TAURI_CARGO_TOML" ] || die "Tauri Cargo.toml not found: $TAURI_CARGO_TOML"

CARGO_VER="$(grep '^version' "$TAURI_CARGO_TOML" | head -1 | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+[^"]*)".*/\1/')"

check_or_update "$TAURI_CARGO_TOML" "tauri-Cargo.toml" \
    "s/^(version = \")[^\"]*/\\1$VERSION/" \
    "$CARGO_VER"

# --- Summary ---

if $CHECK_MODE && [ $ERRORS -gt 0 ]; then
    echo ""
    echo "Found $ERRORS version mismatch(es). Run ./scripts/sync-version.sh to fix."
    exit 1
fi

echo ""
echo "All versions synced to $VERSION"
