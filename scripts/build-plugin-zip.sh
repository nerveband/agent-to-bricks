#!/usr/bin/env bash
set -euo pipefail

# Build the plugin zip for release attachment.
# Usage: ./scripts/build-plugin-zip.sh [version]
# If version is omitted, reads from plugin header.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGIN_DIR="$REPO_ROOT/plugin/agent-to-bricks"

# Get version
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    VERSION=$(grep "define( 'AGENT_BRICKS_VERSION'" "$PLUGIN_DIR/agent-to-bricks.php" | grep -oE "'[0-9]+\.[0-9]+\.[0-9]+'" | tr -d "'")
fi

if [ -z "$VERSION" ]; then
    echo "Error: Could not determine version" >&2
    exit 1
fi

OUTPUT="$REPO_ROOT/agent-to-bricks-plugin-${VERSION}.zip"

echo "Building plugin zip v${VERSION}..."

cd "$REPO_ROOT/plugin"
zip -r "$OUTPUT" agent-to-bricks/ \
    -x "agent-to-bricks/.DS_Store" \
    -x "agent-to-bricks/**/.DS_Store"

echo "Created: $OUTPUT"
echo "Upload with: gh release upload v${VERSION} $(basename "$OUTPUT")"
