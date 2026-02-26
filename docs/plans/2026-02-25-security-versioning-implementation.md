# Security Hardening, Unified Versioning & Access Control — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical/important security vulnerabilities, add allow/deny page access control, unify versioning across CLI/GUI/Plugin to a single source of truth at v1.4.0.

**Architecture:** Single `VERSION` file at project root drives all components. New `ATB_Access_Control` PHP class provides per-key page gating. Security fixes applied to both CLI (Go) and Plugin (PHP) with backward-compatible encryption migration.

**Tech Stack:** Go 1.22+ (CLI), PHP 8.0+ (Plugin), Rust/TypeScript (GUI), bash (sync script)

---

### Task 1: Create VERSION File and Sync Script

**Files:**
- Create: `VERSION`
- Create: `scripts/sync-version.sh`
- Modify: `Makefile`

**Step 1: Create VERSION file**

Create `VERSION` at project root:
```
1.4.0
```

**Step 2: Create sync script**

Create `scripts/sync-version.sh`:
```bash
#!/usr/bin/env bash
# scripts/sync-version.sh
# Reads VERSION file and patches all component version references.
# Usage: ./scripts/sync-version.sh [--check]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION=$(cat "$PROJECT_DIR/VERSION" | tr -d '[:space:]')

if [ -z "$VERSION" ]; then
  echo "ERROR: VERSION file is empty" >&2
  exit 1
fi

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "ERROR: VERSION must be semver (got: $VERSION)" >&2
  exit 1
fi

CHECK_ONLY=false
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=true
fi

ERRORS=0

check_or_update() {
  local file="$1"
  local pattern="$2"
  local replacement="$3"

  if [ ! -f "$file" ]; then
    echo "SKIP: $file (not found)"
    return
  fi

  if $CHECK_ONLY; then
    if ! grep -q "$replacement" "$file" 2>/dev/null; then
      echo "MISMATCH: $file (expected $VERSION)"
      ERRORS=$((ERRORS + 1))
    else
      echo "OK: $file"
    fi
  else
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|$pattern|$replacement|g" "$file"
    else
      sed -i "s|$pattern|$replacement|g" "$file"
    fi
    echo "UPDATED: $file -> $VERSION"
  fi
}

echo "Version: $VERSION"
echo "---"

# Plugin header version
check_or_update \
  "$PROJECT_DIR/plugin/agent-to-bricks/agent-to-bricks.php" \
  "^ \* Version: .*" \
  " * Version: $VERSION"

# Plugin constant
check_or_update \
  "$PROJECT_DIR/plugin/agent-to-bricks/agent-to-bricks.php" \
  "define( 'AGENT_BRICKS_VERSION', '.*' )" \
  "define( 'AGENT_BRICKS_VERSION', '$VERSION' )"

# GUI package.json
check_or_update \
  "$PROJECT_DIR/gui/package.json" \
  '"version": ".*"' \
  "\"version\": \"$VERSION\""

# GUI tauri.conf.json
check_or_update \
  "$PROJECT_DIR/gui/src-tauri/tauri.conf.json" \
  '"version": ".*"' \
  "\"version\": \"$VERSION\""

# GUI Cargo.toml
check_or_update \
  "$PROJECT_DIR/gui/src-tauri/Cargo.toml" \
  '^version = ".*"' \
  "version = \"$VERSION\""

echo "---"
if $CHECK_ONLY && [ $ERRORS -gt 0 ]; then
  echo "FAILED: $ERRORS file(s) out of sync"
  exit 1
elif $CHECK_ONLY; then
  echo "All versions in sync."
fi
```

**Step 3: Update Makefile to read VERSION**

In `Makefile`, change line 3:
```makefile
VERSION ?= $(shell cat VERSION 2>/dev/null || git describe --tags --always --dirty 2>/dev/null || echo "dev")
```

Add new targets:
```makefile
sync-version:
	./scripts/sync-version.sh

check-version:
	./scripts/sync-version.sh --check
```

**Step 4: Make sync script executable and run it**

```bash
chmod +x scripts/sync-version.sh
./scripts/sync-version.sh
```

**Step 5: Commit**

```bash
git add VERSION scripts/sync-version.sh Makefile plugin/agent-to-bricks/agent-to-bricks.php gui/package.json gui/src-tauri/tauri.conf.json gui/src-tauri/Cargo.toml
git commit -m "feat: add unified versioning with single VERSION file source of truth"
```

---

### Task 2: Fix GUI Hardcoded Version (SettingsDialog.tsx)

**Files:**
- Modify: `gui/src/components/SettingsDialog.tsx:530`

**Step 1: Replace hardcoded version with dynamic import**

At the top of `SettingsDialog.tsx`, add import:
```typescript
import packageJson from '../../package.json';
```

Then replace line 530:
```typescript
{ label: "Version", value: "0.1.0" },
```
with:
```typescript
{ label: "Version", value: packageJson.version },
```

**Step 2: Commit**

```bash
git add gui/src/components/SettingsDialog.tsx
git commit -m "fix(gui): read version from package.json instead of hardcoding"
```

---

### Task 3: Fix Config File Permissions (C1)

**Files:**
- Modify: `cli/internal/config/config.go`
- Modify: `cli/internal/styles/profile.go`
- Modify: `cli/internal/updater/updater.go`

**Step 1: Fix config.go**

In `config.go`, change `Save` method:
```go
func (c *Config) Save(path string) error {
	data, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
```

Fix `DefaultPath` to handle errors:
```go
func DefaultPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		// Fall back to current directory
		return filepath.Join(".agent-to-bricks", "config.yaml")
	}
	return filepath.Join(home, ".agent-to-bricks", "config.yaml")
}
```

**Step 2: Fix profile.go**

In `styles/profile.go`, change `DefaultPath`:
```go
func DefaultPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".agent-to-bricks", "style-profile.json")
	}
	return filepath.Join(home, ".agent-to-bricks", "style-profile.json")
}
```

Change `Save` method:
```go
func (p *Profile) Save(path string) error {
	os.MkdirAll(filepath.Dir(path), 0700)
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
```

**Step 3: Fix updater.go**

In `updater/updater.go`, change `DefaultCachePath`:
```go
func DefaultCachePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".agent-to-bricks", "update-check.json")
	}
	return filepath.Join(home, ".agent-to-bricks", "update-check.json")
}
```

Change `Save` method:
```go
func (c *CheckCache) Save(latestVersion string) error {
	data := checkCacheData{
		LatestVersion: latestVersion,
		CheckedAt:     time.Now().Unix(),
		TTLHours:      24,
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	os.MkdirAll(filepath.Dir(c.Path), 0700)
	return os.WriteFile(c.Path, raw, 0600)
}
```

**Step 4: Run tests**

```bash
cd cli && go test ./internal/config/ ./internal/styles/ ./internal/updater/ -v
```

**Step 5: Commit**

```bash
git add cli/internal/config/config.go cli/internal/styles/profile.go cli/internal/updater/updater.go
git commit -m "fix(cli): use restrictive file permissions (0600/0700) for config and cache files"
```

---

### Task 4: Add Checksum Verification to Self-Update (C2)

**Files:**
- Modify: `cli/internal/updater/selfupdate.go`

**Step 1: Add checksum verification**

Replace the entire `selfupdate.go` with:
```go
package updater

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// DetectPlatform returns the current OS and architecture.
func DetectPlatform() (string, string) {
	return runtime.GOOS, runtime.GOARCH
}

// CurrentBinaryPath returns the path of the running binary.
func CurrentBinaryPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(exe)
}

// DownloadAndVerify downloads a URL, verifies its SHA256 against checksums, then extracts.
func DownloadAndVerify(archiveURL, checksumsURL, destPath string) error {
	// 1. Download checksums.txt
	expectedHash, archiveName, err := fetchExpectedChecksum(checksumsURL, archiveURL)
	if err != nil {
		return fmt.Errorf("checksum fetch failed: %w (downloading without verification)", err)
	}

	// 2. Download archive into memory
	resp, err := http.Get(archiveURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	// 3. Verify checksum
	if expectedHash != "" {
		actualHash := sha256.Sum256(body)
		actualHex := hex.EncodeToString(actualHash[:])
		if actualHex != expectedHash {
			return fmt.Errorf("checksum mismatch for %s: expected %s, got %s", archiveName, expectedHash, actualHex)
		}
	}

	// 4. Extract
	reader := bytes.NewReader(body)
	if strings.HasSuffix(archiveURL, ".tar.gz") || strings.HasSuffix(archiveURL, ".tgz") {
		return extractTarGz(reader, destPath)
	}
	return writeToFile(reader, destPath)
}

// DownloadFile downloads a URL to a local path (legacy, no checksum).
func DownloadFile(url, destPath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	if strings.HasSuffix(url, ".tar.gz") || strings.HasSuffix(url, ".tgz") {
		return extractTarGz(resp.Body, destPath)
	}

	return writeToFile(resp.Body, destPath)
}

func fetchExpectedChecksum(checksumsURL, archiveURL string) (string, string, error) {
	resp, err := http.Get(checksumsURL)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", "", fmt.Errorf("checksums.txt returned HTTP %d", resp.StatusCode)
	}

	archiveName := filepath.Base(archiveURL)
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		// Format: "<hash>  <filename>" (two spaces)
		parts := strings.SplitN(line, "  ", 2)
		if len(parts) == 2 && strings.TrimSpace(parts[1]) == archiveName {
			return strings.TrimSpace(parts[0]), archiveName, nil
		}
	}

	return "", archiveName, fmt.Errorf("no checksum found for %s", archiveName)
}

func extractTarGz(r io.Reader, destPath string) error {
	body, err := io.ReadAll(r)
	if err != nil {
		return err
	}

	gz, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		return writeToFile(bytes.NewReader(body), destPath)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if header.Typeflag == tar.TypeReg {
			name := filepath.Base(header.Name)
			if name == "bricks" || strings.HasPrefix(name, "bricks") {
				return writeToFile(tr, destPath)
			}
		}
	}
	return fmt.Errorf("no bricks binary found in archive")
}

func writeToFile(r io.Reader, destPath string) error {
	tmpPath := destPath + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}

	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}
	f.Close()

	return os.Rename(tmpPath, destPath)
}

// SelfUpdate downloads a new CLI binary with checksum verification and replaces the current one.
func SelfUpdate(downloadURL, checksumsURL string) error {
	binPath, err := CurrentBinaryPath()
	if err != nil {
		return fmt.Errorf("cannot determine binary path: %w", err)
	}
	if checksumsURL != "" {
		return DownloadAndVerify(downloadURL, checksumsURL, binPath)
	}
	return DownloadFile(downloadURL, binPath)
}
```

**Step 2: Update the update command to pass checksums URL**

In `cli/cmd/update.go`, find where `SelfUpdate` is called and update it to construct and pass the checksums URL. The checksums URL follows the pattern: `https://github.com/{repo}/releases/download/{tag}/checksums.txt`.

**Step 3: Run tests**

```bash
cd cli && go test ./internal/updater/ -v
```

**Step 4: Commit**

```bash
git add cli/internal/updater/selfupdate.go cli/cmd/update.go
git commit -m "fix(cli): verify SHA256 checksums before replacing binary during self-update"
```

---

### Task 5: Fix Plugin Update Version Validation + Hosting Checks (C3, HP3, HP6)

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-update-api.php`

**Step 1: Replace handle_update with hardened version**

Replace the entire `handle_update` method:
```php
public static function handle_update( $request ) {
    $version = sanitize_text_field( $request->get_param( 'version' ) );

    // C3: Strict semver validation
    if ( ! preg_match( '/^\d+\.\d+\.\d+$/', $version ) ) {
        return new WP_REST_Response( array(
            'success' => false,
            'error'   => 'Invalid version format. Expected: X.Y.Z',
        ), 400 );
    }

    // HP3: Check if file modifications are allowed
    if ( defined( 'DISALLOW_FILE_MODS' ) && DISALLOW_FILE_MODS ) {
        return new WP_REST_Response( array(
            'success' => false,
            'error'   => 'File modifications are disabled on this host. Update the plugin manually or via your hosting dashboard.',
        ), 403 );
    }

    $previous_version = AGENT_BRICKS_VERSION;

    $download_url = sprintf(
        'https://github.com/%s/releases/download/v%s/agent-to-bricks-plugin-%s.zip',
        self::GITHUB_REPO,
        $version,
        $version
    );

    $head = wp_remote_head( $download_url, array( 'timeout' => 10 ) );
    if ( is_wp_error( $head ) ) {
        return new WP_REST_Response( array(
            'success' => false,
            'error'   => 'Cannot reach GitHub: ' . $head->get_error_message(),
        ), 502 );
    }

    $status = wp_remote_retrieve_response_code( $head );
    if ( $status !== 200 && $status !== 302 ) {
        return new WP_REST_Response( array(
            'success' => false,
            'error'   => sprintf( 'Plugin zip not found for v%s (HTTP %d)', $version, $status ),
        ), 404 );
    }

    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    require_once ABSPATH . 'wp-admin/includes/plugin.php';

    $skin     = new WP_Ajax_Upgrader_Skin();
    $upgrader = new Plugin_Upgrader( $skin );

    $result = $upgrader->install( $download_url, array(
        'overwrite_package' => true,
    ) );

    if ( is_wp_error( $result ) ) {
        return new WP_REST_Response( array(
            'success' => false,
            'error'   => $result->get_error_message(),
        ), 500 );
    }

    if ( $result === false ) {
        $errors = $skin->get_errors();
        $msg    = is_wp_error( $errors ) ? $errors->get_error_message() : 'Unknown install error';
        return new WP_REST_Response( array(
            'success' => false,
            'error'   => $msg,
        ), 500 );
    }

    // Reactivate plugin
    $plugin_file = 'agent-to-bricks/agent-to-bricks.php';
    if ( ! is_plugin_active( $plugin_file ) ) {
        activate_plugin( $plugin_file );
    }

    // HP6: Clear OPcache if available
    if ( function_exists( 'opcache_reset' ) ) {
        opcache_reset();
    }

    return new WP_REST_Response( array(
        'success'         => true,
        'version'         => $version,
        'previousVersion' => $previous_version,
    ), 200 );
}
```

**Step 2: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-update-api.php
git commit -m "fix(plugin): validate version format, check DISALLOW_FILE_MODS, reset OPcache after update"
```

---

### Task 6: Add Rate Limiting to API Authentication (C4)

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-api-auth.php`

**Step 1: Add rate limiting to authenticate method**

Add a new `check_rate_limit` method and modify `authenticate` and `touch_key`:

After `if ( empty( $api_key ) ) { return $result; }` in `authenticate`, add:
```php
// C4: Rate limiting on failed auth attempts
$rate_check = self::check_rate_limit();
if ( is_wp_error( $rate_check ) ) {
    return $rate_check;
}
```

After the `if ( ! $key_data )` block that returns the WP_Error, add before the return:
```php
self::record_auth_failure();
```

Replace the `touch_key` method with a debounced version:
```php
private static function touch_key( $raw_key ) {
    $key_hash = self::hash_key( $raw_key );
    $transient_key = 'atb_touch_' . substr( $key_hash, 0, 12 );

    // Only update DB every 5 minutes per key
    if ( get_transient( $transient_key ) ) {
        return;
    }

    $keys = get_option( self::OPTION_KEY, array() );
    foreach ( $keys as &$stored ) {
        if ( hash_equals( $stored['key_hash'], $key_hash ) ) {
            $stored['last_used'] = current_time( 'mysql' );
            break;
        }
    }
    unset( $stored );

    update_option( self::OPTION_KEY, $keys );
    set_transient( $transient_key, 1, 5 * MINUTE_IN_SECONDS );
}
```

Add these new methods:
```php
/**
 * Check if the current IP has exceeded the auth failure rate limit.
 */
private static function check_rate_limit() {
    $ip_hash = self::get_ip_hash();
    $transient_key = 'atb_auth_fail_' . $ip_hash;
    $failures = (int) get_transient( $transient_key );

    if ( $failures >= 10 ) {
        return new WP_Error(
            'atb_rate_limited',
            'Too many failed authentication attempts. Try again later.',
            array( 'status' => 429 )
        );
    }

    return true;
}

/**
 * Record a failed authentication attempt for rate limiting.
 */
private static function record_auth_failure() {
    $ip_hash = self::get_ip_hash();
    $transient_key = 'atb_auth_fail_' . $ip_hash;
    $failures = (int) get_transient( $transient_key );
    set_transient( $transient_key, $failures + 1, 5 * MINUTE_IN_SECONDS );
}

/**
 * Get a hashed representation of the client IP for rate limiting.
 */
private static function get_ip_hash() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return substr( hash( 'sha256', $ip . wp_salt( 'auth' ) ), 0, 16 );
}
```

**Step 2: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-api-auth.php
git commit -m "fix(plugin): add IP-based rate limiting on API auth and debounce touch_key writes"
```

---

### Task 7: Fix Encryption to Use Random IV (C5)

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-api-auth.php`
- Modify: `plugin/agent-to-bricks/includes/class-settings.php`

**Step 1: Update encryption in class-api-auth.php**

Replace `encrypt_key` and `decrypt_stored_key`:
```php
private static function encrypt_key( $key ) {
    if ( empty( $key ) ) {
        return '';
    }
    $iv = random_bytes( 16 );
    $encrypted = openssl_encrypt(
        $key,
        'aes-256-cbc',
        wp_salt( 'auth' ),
        OPENSSL_RAW_DATA,
        $iv
    );
    // Prepend IV to ciphertext so we can extract it during decryption
    return base64_encode( $iv . $encrypted );
}

private static function decrypt_stored_key( $encrypted ) {
    if ( empty( $encrypted ) ) {
        return '';
    }
    $raw = base64_decode( $encrypted );
    if ( strlen( $raw ) <= 16 ) {
        // Try legacy static-IV decryption for backward compatibility
        return self::decrypt_legacy( $encrypted );
    }
    $iv         = substr( $raw, 0, 16 );
    $ciphertext = substr( $raw, 16 );
    $decrypted  = openssl_decrypt(
        $ciphertext,
        'aes-256-cbc',
        wp_salt( 'auth' ),
        OPENSSL_RAW_DATA,
        $iv
    );
    if ( $decrypted === false ) {
        // Fallback to legacy decryption for keys encrypted before this update
        return self::decrypt_legacy( $encrypted );
    }
    return $decrypted;
}

/**
 * Legacy decryption using static IV (for backward compatibility during migration).
 */
private static function decrypt_legacy( $encrypted ) {
    if ( empty( $encrypted ) ) {
        return '';
    }
    return openssl_decrypt(
        base64_decode( $encrypted ),
        'aes-256-cbc',
        wp_salt( 'auth' ),
        0,
        substr( md5( wp_salt( 'secure_auth' ) ), 0, 16 )
    );
}
```

**Step 2: Update encryption in class-settings.php**

Replace `encrypt_key` and `decrypt_key`:
```php
private static function encrypt_key( $key ) {
    if ( empty( $key ) ) {
        return '';
    }
    $iv = random_bytes( 16 );
    $encrypted = openssl_encrypt(
        $key,
        'aes-256-cbc',
        wp_salt( 'auth' ),
        OPENSSL_RAW_DATA,
        $iv
    );
    return base64_encode( $iv . $encrypted );
}

public static function decrypt_key( $encrypted ) {
    if ( empty( $encrypted ) ) {
        return '';
    }
    $raw = base64_decode( $encrypted );
    if ( strlen( $raw ) <= 16 ) {
        return self::decrypt_legacy( $encrypted );
    }
    $iv         = substr( $raw, 0, 16 );
    $ciphertext = substr( $raw, 16 );
    $decrypted  = openssl_decrypt(
        $ciphertext,
        'aes-256-cbc',
        wp_salt( 'auth' ),
        OPENSSL_RAW_DATA,
        $iv
    );
    if ( $decrypted === false ) {
        return self::decrypt_legacy( $encrypted );
    }
    return $decrypted;
}

private static function decrypt_legacy( $encrypted ) {
    if ( empty( $encrypted ) ) {
        return '';
    }
    return openssl_decrypt(
        base64_decode( $encrypted ),
        'aes-256-cbc',
        wp_salt( 'auth' ),
        0,
        substr( md5( wp_salt( 'secure_auth' ) ), 0, 16 )
    );
}
```

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-api-auth.php plugin/agent-to-bricks/includes/class-settings.php
git commit -m "fix(plugin): use random IV for AES encryption with backward-compatible legacy fallback"
```

---

### Task 8: Create Access Control Class (I1)

**Files:**
- Create: `plugin/agent-to-bricks/includes/class-access-control.php`
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php`

**Step 1: Create the access control class**

Create `plugin/agent-to-bricks/includes/class-access-control.php`:
```php
<?php
/**
 * Per-key access control for page/template/component access.
 *
 * Supports three modes per API key:
 * - 'unrestricted' (default): full access to all content
 * - 'allow': only listed post IDs and post types are accessible
 * - 'deny': listed post IDs and post types are blocked, everything else is allowed
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class ATB_Access_Control {

	const OPTION_KEY = 'agent_bricks_access_rules';

	/**
	 * Current request's API key prefix (set during authentication).
	 */
	private static $current_key_prefix = null;

	/**
	 * Set the current API key prefix after successful authentication.
	 */
	public static function set_current_key( $key_prefix ) {
		self::$current_key_prefix = $key_prefix;
	}

	/**
	 * Get the current API key prefix.
	 */
	public static function get_current_key() {
		return self::$current_key_prefix;
	}

	/**
	 * Check if the current API key is allowed to access a specific post.
	 *
	 * @param int $post_id The post ID to check access for.
	 * @return true|WP_Error True if allowed, WP_Error if denied.
	 */
	public static function can_access_post( $post_id ) {
		// If no API key auth (logged-in user via browser), allow
		if ( self::$current_key_prefix === null ) {
			return true;
		}

		$rules = self::get_rules_for_key( self::$current_key_prefix );

		// Default: unrestricted
		if ( empty( $rules ) || ( $rules['mode'] ?? 'unrestricted' ) === 'unrestricted' ) {
			return true;
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return true; // Let the calling code handle 404
		}

		$mode = $rules['mode'];
		$allowed_ids   = $rules['post_ids'] ?? array();
		$allowed_types = $rules['post_types'] ?? array();

		$id_match   = in_array( $post_id, $allowed_ids, true );
		$type_match = in_array( $post->post_type, $allowed_types, true );

		if ( $mode === 'allow' ) {
			if ( ! $id_match && ! $type_match ) {
				return new WP_Error(
					'atb_access_denied',
					sprintf( 'Access denied: API key %s... is not allowed to access post %d.', self::$current_key_prefix, $post_id ),
					array( 'status' => 403 )
				);
			}
		} elseif ( $mode === 'deny' ) {
			if ( $id_match || $type_match ) {
				return new WP_Error(
					'atb_access_denied',
					sprintf( 'Access denied: API key %s... is blocked from accessing post %d.', self::$current_key_prefix, $post_id ),
					array( 'status' => 403 )
				);
			}
		}

		return true;
	}

	/**
	 * Filter an array of post IDs based on access rules.
	 * Returns only the IDs the current key is allowed to access.
	 */
	public static function filter_post_ids( array $post_ids ) {
		if ( self::$current_key_prefix === null ) {
			return $post_ids;
		}

		$rules = self::get_rules_for_key( self::$current_key_prefix );
		if ( empty( $rules ) || ( $rules['mode'] ?? 'unrestricted' ) === 'unrestricted' ) {
			return $post_ids;
		}

		return array_values( array_filter( $post_ids, function( $pid ) {
			return self::can_access_post( (int) $pid ) === true;
		} ) );
	}

	/**
	 * Get access rules for a specific key prefix.
	 */
	public static function get_rules_for_key( $key_prefix ) {
		$all_rules = get_option( self::OPTION_KEY, array() );

		// Check key-specific rules first
		if ( isset( $all_rules[ $key_prefix ] ) ) {
			return $all_rules[ $key_prefix ];
		}

		// Fall back to default rules
		if ( isset( $all_rules['__default__'] ) ) {
			return $all_rules['__default__'];
		}

		// No rules = unrestricted
		return array( 'mode' => 'unrestricted' );
	}

	/**
	 * Save access rules for a key prefix.
	 */
	public static function save_rules( $key_prefix, $rules ) {
		$all_rules = get_option( self::OPTION_KEY, array() );
		$all_rules[ $key_prefix ] = $rules;
		update_option( self::OPTION_KEY, $all_rules );
	}

	/**
	 * Delete access rules for a key prefix.
	 */
	public static function delete_rules( $key_prefix ) {
		$all_rules = get_option( self::OPTION_KEY, array() );
		unset( $all_rules[ $key_prefix ] );
		update_option( self::OPTION_KEY, $all_rules );
	}

	/**
	 * Get all access rules (for admin display).
	 */
	public static function get_all_rules() {
		return get_option( self::OPTION_KEY, array() );
	}
}
```

**Step 2: Load the class and wire it into auth**

In `agent-to-bricks.php`, add the require after the existing requires (before `class-rest-api.php`):
```php
require_once AGENT_BRICKS_PLUGIN_DIR . 'includes/class-access-control.php';
```

**Step 3: Wire access control into ATB_API_Auth::authenticate**

In `class-api-auth.php`, in the `authenticate` method, after `wp_set_current_user( $key_data['user_id'] );`:
```php
// Store key prefix for access control checks
if ( class_exists( 'ATB_Access_Control' ) ) {
    ATB_Access_Control::set_current_key( $key_data['key_prefix'] );
}
```

**Step 4: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-access-control.php plugin/agent-to-bricks/agent-to-bricks.php plugin/agent-to-bricks/includes/class-api-auth.php
git commit -m "feat(plugin): add per-key access control class with allow/deny list support"
```

---

### Task 9: Integrate Access Control Into All API Endpoints

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-elements-api.php`
- Modify: `plugin/agent-to-bricks/includes/class-snapshots-api.php`
- Modify: `plugin/agent-to-bricks/includes/class-search-api.php`
- Modify: `plugin/agent-to-bricks/includes/class-site-api.php`
- Modify: `plugin/agent-to-bricks/includes/class-templates-api.php`
- Modify: `plugin/agent-to-bricks/includes/class-components-api.php`

**Step 1: Update Elements API permission checks**

In `class-elements-api.php`, replace `check_read_permission` and `check_write_permission`:
```php
public static function check_read_permission( $request ) {
    $post_id = (int) $request->get_param( 'id' );
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return false;
    }
    $access = ATB_Access_Control::can_access_post( $post_id );
    if ( is_wp_error( $access ) ) {
        return $access;
    }
    return true;
}

public static function check_write_permission( $request ) {
    $post_id = (int) $request->get_param( 'id' );
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return false;
    }
    $access = ATB_Access_Control::can_access_post( $post_id );
    if ( is_wp_error( $access ) ) {
        return $access;
    }
    return true;
}
```

**Step 2: Update Snapshots API**

In `class-snapshots-api.php`, replace `check_permission`:
```php
public static function check_permission( $request ) {
    $post_id = (int) $request->get_param( 'id' );
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return false;
    }
    $access = ATB_Access_Control::can_access_post( $post_id );
    if ( is_wp_error( $access ) ) {
        return $access;
    }
    return true;
}
```

**Step 3: Update Search API**

In `class-search-api.php`, in the `search_elements` method, after `$post_ids = get_posts( $query_args );`, add:
```php
// Filter post IDs based on access control rules
$post_ids = ATB_Access_Control::filter_post_ids( $post_ids );
```

**Step 4: Update Site API**

In `class-site-api.php`, in the `get_pages` method, after building the `$pages` array in the foreach loop, add access control filtering. Replace the foreach with:
```php
foreach ( $query->posts as $post ) {
    // Filter by access control
    if ( ATB_Access_Control::can_access_post( $post->ID ) !== true ) {
        continue;
    }
    $pages[] = [
        'id'       => $post->ID,
        'title'    => $post->post_title ?: '(no title)',
        'slug'     => $post->post_name,
        'status'   => $post->post_status,
        'modified' => $post->post_modified,
    ];
}
```

**Step 5: Update Templates API with correct capabilities (I6) and access control**

In `class-templates-api.php`, replace the single `check_permission` with granular methods and update route registrations:
```php
public static function register_routes() {
    register_rest_route( 'agent-bricks/v1', '/templates', array(
        array(
            'methods'             => 'GET',
            'callback'            => array( __CLASS__, 'list_templates' ),
            'permission_callback' => array( __CLASS__, 'check_list_permission' ),
        ),
        array(
            'methods'             => 'POST',
            'callback'            => array( __CLASS__, 'create_template' ),
            'permission_callback' => array( __CLASS__, 'check_create_permission' ),
        ),
    ) );

    register_rest_route( 'agent-bricks/v1', '/templates/(?P<id>\d+)', array(
        array(
            'methods'             => 'GET',
            'callback'            => array( __CLASS__, 'get_template' ),
            'permission_callback' => array( __CLASS__, 'check_read_permission' ),
        ),
        array(
            'methods'             => 'PATCH',
            'callback'            => array( __CLASS__, 'update_template' ),
            'permission_callback' => array( __CLASS__, 'check_edit_permission' ),
        ),
        array(
            'methods'             => 'DELETE',
            'callback'            => array( __CLASS__, 'delete_template' ),
            'permission_callback' => array( __CLASS__, 'check_delete_permission' ),
        ),
    ) );
}

public static function check_list_permission() {
    return current_user_can( 'edit_posts' );
}

public static function check_create_permission() {
    return current_user_can( 'publish_posts' );
}

public static function check_read_permission( $request ) {
    $post_id = (int) $request->get_param( 'id' );
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return false;
    }
    $access = ATB_Access_Control::can_access_post( $post_id );
    if ( is_wp_error( $access ) ) {
        return $access;
    }
    return true;
}

public static function check_edit_permission( $request ) {
    $post_id = (int) $request->get_param( 'id' );
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return false;
    }
    $access = ATB_Access_Control::can_access_post( $post_id );
    if ( is_wp_error( $access ) ) {
        return $access;
    }
    return true;
}

public static function check_delete_permission( $request ) {
    $post_id = (int) $request->get_param( 'id' );
    if ( ! current_user_can( 'delete_post', $post_id ) ) {
        return false;
    }
    $access = ATB_Access_Control::can_access_post( $post_id );
    if ( is_wp_error( $access ) ) {
        return $access;
    }
    return true;
}
```

**Step 6: Update Components API**

In `class-components-api.php`, replace `check_permission`:
```php
public static function check_permission(): bool {
    return current_user_can( 'edit_posts' );
}

public static function check_single_permission( WP_REST_Request $request ): bool|WP_Error {
    $post_id = (int) $request->get_param( 'id' );
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return false;
    }
    $access = ATB_Access_Control::can_access_post( $post_id );
    if ( is_wp_error( $access ) ) {
        return $access;
    }
    return true;
}
```

Update the single component route registration to use `check_single_permission`:
```php
register_rest_route( 'agent-bricks/v1', '/components/(?P<id>\d+)', [
    'methods'             => 'GET',
    'callback'            => [ __CLASS__, 'get_component' ],
    'permission_callback' => [ __CLASS__, 'check_single_permission' ],
] );
```

**Step 7: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-elements-api.php plugin/agent-to-bricks/includes/class-snapshots-api.php plugin/agent-to-bricks/includes/class-search-api.php plugin/agent-to-bricks/includes/class-site-api.php plugin/agent-to-bricks/includes/class-templates-api.php plugin/agent-to-bricks/includes/class-components-api.php
git commit -m "feat(plugin): integrate access control into all API permission callbacks"
```

---

### Task 10: Add Element Data Sanitization (I2)

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-elements-api.php`

**Step 1: Add sanitize_elements method**

Add this method to the `ATB_Elements_API` class:
```php
/**
 * Sanitize elements before writing to post meta.
 * Validates structure and applies wp_kses_post to text content.
 */
private static function sanitize_elements( array $elements ) {
    $sanitized = array();
    foreach ( $elements as $el ) {
        if ( ! is_array( $el ) ) continue;
        if ( empty( $el['id'] ) || empty( $el['name'] ) ) continue;

        // Sanitize settings recursively
        if ( isset( $el['settings'] ) && is_array( $el['settings'] ) ) {
            $el['settings'] = self::sanitize_settings( $el['settings'] );
        }

        $sanitized[] = $el;
    }
    return $sanitized;
}

/**
 * Recursively sanitize element settings.
 */
private static function sanitize_settings( array $settings ) {
    $text_keys = array( '_content', 'text', 'title', 'subtitle', 'description', 'label', 'placeholder', 'alt' );

    foreach ( $settings as $key => &$value ) {
        if ( is_string( $value ) && in_array( $key, $text_keys, true ) ) {
            $value = wp_kses_post( $value );
        } elseif ( is_array( $value ) ) {
            $value = self::sanitize_settings( $value );
        }
    }
    unset( $value );

    return $settings;
}
```

**Step 2: Apply sanitization in write paths**

In `append_elements`, before `$elements = array_merge( $elements, $new_els );`:
```php
$new_els = self::sanitize_elements( $new_els );
```

In `replace_elements`, before the auto-snapshot:
```php
$elements = self::sanitize_elements( $elements );
```

In `batch_operations`, in the `case 'append':` block, before `$elements = array_merge(...)`:
```php
$new_els = self::sanitize_elements( $new_els );
```

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-elements-api.php
git commit -m "fix(plugin): sanitize element data with wp_kses_post on all write paths"
```

---

### Task 11: Fix Search API Memory Exhaustion (I3)

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-search-api.php`

**Step 1: Replace unbounded query with batched processing**

Replace the query and loop in `search_elements`:
```php
$meta_key = ATB_Bricks_Lifecycle::content_meta_key();
$max_posts = 500;
$batch_size = 50;
$offset = 0;

// Resolve global class name to ID if needed
$class_id = null;
if ( $global_class ) {
    $class_id = self::resolve_class_id( $global_class );
}

$all_results = [];

while ( $offset < $max_posts ) {
    $query_args = [
        'post_type'      => [ 'page', 'post', 'bricks_template' ],
        'posts_per_page' => $batch_size,
        'offset'         => $offset,
        'post_status'    => 'any',
        'meta_query'     => [
            [
                'key'     => $meta_key,
                'compare' => 'EXISTS',
            ],
        ],
        'fields' => 'ids',
    ];

    if ( $post_type ) {
        $query_args['post_type'] = $post_type;
    }

    $post_ids = get_posts( $query_args );
    if ( empty( $post_ids ) ) {
        break;
    }

    // Filter by access control
    $post_ids = ATB_Access_Control::filter_post_ids( $post_ids );

    foreach ( $post_ids as $pid ) {
        $post     = get_post( $pid );
        $elements = get_post_meta( $pid, $meta_key, true );
        if ( ! is_array( $elements ) ) continue;

        foreach ( $elements as $el ) {
            if ( ! self::element_matches( $el, $element_type, $setting_key, $setting_value, $class_id, $global_class ) ) {
                continue;
            }

            $all_results[] = [
                'postId'       => $pid,
                'postTitle'    => $post->post_title,
                'postType'     => $post->post_type,
                'elementId'    => $el['id'] ?? '',
                'elementType'  => $el['name'] ?? '',
                'elementLabel' => $el['label'] ?? '',
                'settings'     => $el['settings'] ?? new \stdClass(),
                'parentId'     => $el['parent'] ?? '',
            ];
        }
    }

    $offset += $batch_size;
}
```

Remove the old `$query_args` block, `$post_ids = get_posts(...)`, class resolution, and the old foreach loop (they're replaced above).

**Step 2: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-search-api.php
git commit -m "fix(plugin): batch search API queries to prevent memory exhaustion on large sites"
```

---

### Task 12: Fix URL Encoding in CLI Client (I4)

**Files:**
- Modify: `cli/internal/client/client.go`

**Step 1: Fix ListClasses**

Replace the `ListClasses` method:
```go
func (c *Client) ListClasses(framework string) (*ClassesResponse, error) {
	path := "/classes"
	if framework != "" {
		v := url.Values{}
		v.Set("framework", framework)
		path += "?" + v.Encode()
	}
	resp, err := c.do("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result ClassesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
```

**Step 2: Fix ListMedia**

Replace the `ListMedia` method:
```go
func (c *Client) ListMedia(search string) (*MediaListResponse, error) {
	path := "/media"
	if search != "" {
		v := url.Values{}
		v.Set("search", search)
		path += "?" + v.Encode()
	}
	resp, err := c.do("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result MediaListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
```

**Step 3: Run tests**

```bash
cd cli && go test ./internal/client/ -v
```

**Step 4: Commit**

```bash
git add cli/internal/client/client.go
git commit -m "fix(cli): URL-encode query parameters in ListClasses and ListMedia"
```

---

### Task 13: Fix Snapshot ID Predictability (I5)

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-snapshots-api.php`

**Step 1: Replace uniqid-based ID with cryptographic random**

In `take_snapshot`, replace the snapshot ID generation:
```php
'snapshotId'   => 'snap_' . bin2hex( random_bytes( 8 ) ),
```

**Step 2: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-snapshots-api.php
git commit -m "fix(plugin): use cryptographically random snapshot IDs"
```

---

### Task 14: Fix LLM Client Timeout (HP5)

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-llm-client.php`

**Step 1: Make timeout respect max_execution_time**

Replace `'timeout' => 60,` with:
```php
'timeout' => self::safe_timeout(),
```

Add this method to `ATB_LLM_Client`:
```php
/**
 * Calculate a safe timeout that respects the server's max_execution_time.
 */
private static function safe_timeout() {
    $max_exec = (int) ini_get( 'max_execution_time' );
    // 0 means unlimited (CLI or custom config)
    if ( $max_exec === 0 || $max_exec >= 65 ) {
        return 60;
    }
    // Leave 5 seconds for PHP to process the response
    return max( 10, $max_exec - 5 );
}
```

**Step 2: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-llm-client.php
git commit -m "fix(plugin): respect max_execution_time when setting LLM request timeout"
```

---

### Task 15: Add OpenSSL Check on Activation (HP1)

**Files:**
- Modify: `plugin/agent-to-bricks/agent-to-bricks.php`

**Step 1: Add OpenSSL check to activation hook**

Replace the `agent_bricks_activate` function:
```php
function agent_bricks_activate() {
    // HP1: Check for required PHP extensions
    if ( ! function_exists( 'openssl_encrypt' ) ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die(
            'Agent to Bricks requires the PHP OpenSSL extension. Please enable it in your PHP configuration.',
            'Plugin Activation Error',
            array( 'back_link' => true )
        );
    }

    $defaults = array(
        'provider'            => 'cerebras',
        'api_key'             => '',
        'model'               => '',
        'base_url'            => '',
        'temperature'         => 0.7,
        'max_tokens'          => 4000,
        'enable_editor_panel' => 0,
    );

    if ( ! get_option( 'agent_bricks_settings' ) ) {
        add_option( 'agent_bricks_settings', $defaults );
    }
}
```

**Step 2: Commit**

```bash
git add plugin/agent-to-bricks/agent-to-bricks.php
git commit -m "fix(plugin): check for OpenSSL extension on activation"
```

---

### Task 16: Mask API Key in CLI Config Output (M1)

**Files:**
- Modify: `cli/cmd/config.go`

**Step 1: Mask sensitive values in config set output**

Replace line 106 (`fmt.Printf("Set %s = %s\n", key, value)`):
```go
if key == "site.api_key" || key == "llm.api_key" {
    masked := value
    if len(value) > 8 {
        masked = value[:8] + "..."
    }
    fmt.Printf("Set %s = %s\n", key, masked)
} else {
    fmt.Printf("Set %s = %s\n", key, value)
}
```

**Step 2: Run tests**

```bash
cd cli && go test ./cmd/ -v -run TestConfig
```

**Step 3: Commit**

```bash
git add cli/cmd/config.go
git commit -m "fix(cli): mask API key values in config set output"
```

---

### Task 17: Add Access Control Admin UI

**Files:**
- Modify: `plugin/agent-to-bricks/includes/class-settings.php`
- Modify: `plugin/agent-to-bricks/includes/class-api-auth.php`

**Step 1: Add AJAX handlers for access rules**

Add to `ATB_API_Auth::init()`:
```php
add_action( 'wp_ajax_atb_save_access_rules', array( __CLASS__, 'ajax_save_access_rules' ) );
add_action( 'wp_ajax_atb_get_access_rules', array( __CLASS__, 'ajax_get_access_rules' ) );
```

Add these AJAX handlers to `ATB_API_Auth`:
```php
public static function ajax_save_access_rules() {
    check_ajax_referer( 'atb_api_key_nonce', 'nonce' );

    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Unauthorized' );
    }

    $prefix = sanitize_text_field( $_POST['prefix'] ?? '' );
    if ( empty( $prefix ) ) {
        wp_send_json_error( 'No key prefix' );
    }

    $mode = sanitize_text_field( $_POST['mode'] ?? 'unrestricted' );
    if ( ! in_array( $mode, array( 'unrestricted', 'allow', 'deny' ), true ) ) {
        $mode = 'unrestricted';
    }

    $post_ids = array();
    if ( ! empty( $_POST['post_ids'] ) ) {
        $post_ids = array_map( 'absint', explode( ',', sanitize_text_field( $_POST['post_ids'] ) ) );
        $post_ids = array_filter( $post_ids );
    }

    $post_types = array();
    if ( ! empty( $_POST['post_types'] ) ) {
        $post_types = array_map( 'sanitize_text_field', explode( ',', $_POST['post_types'] ) );
    }

    $rules = array(
        'mode'       => $mode,
        'post_ids'   => array_values( $post_ids ),
        'post_types' => array_values( $post_types ),
    );

    ATB_Access_Control::save_rules( $prefix, $rules );
    wp_send_json_success( $rules );
}

public static function ajax_get_access_rules() {
    check_ajax_referer( 'atb_api_key_nonce', 'nonce' );

    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Unauthorized' );
    }

    $prefix = sanitize_text_field( $_GET['prefix'] ?? '' );
    if ( empty( $prefix ) ) {
        wp_send_json_error( 'No key prefix' );
    }

    $rules = ATB_Access_Control::get_rules_for_key( $prefix );
    wp_send_json_success( $rules );
}
```

**Step 2: Add access rules UI to settings page**

In `class-settings.php`, after the API keys table (after the `</table>` on line 167 area), add a new section. Find the closing `</p>` tag after the Generate New Key button area and add after the `atb-new-key-display` div:

```php
<!-- Access Control Rules -->
<div id="atb-access-control" style="display:none; margin-top:20px; padding:16px; background:#fff; border:1px solid #c3c4c7; border-radius:4px;">
    <h3 style="margin-top:0;">Access Rules for <code id="atb-ac-prefix"></code></h3>
    <table class="form-table">
        <tr>
            <th scope="row">Access Mode</th>
            <td>
                <select id="atb-ac-mode">
                    <option value="unrestricted">Unrestricted (full access)</option>
                    <option value="allow">Allow List (only specified pages)</option>
                    <option value="deny">Deny List (block specified pages)</option>
                </select>
                <p class="description">Controls which pages this API key can read and modify.</p>
            </td>
        </tr>
        <tr id="atb-ac-ids-row" style="display:none;">
            <th scope="row">Page/Post IDs</th>
            <td>
                <input type="text" id="atb-ac-post-ids" class="regular-text" placeholder="e.g. 42, 99, 1338" />
                <p class="description">Comma-separated post/page IDs.</p>
            </td>
        </tr>
        <tr id="atb-ac-types-row" style="display:none;">
            <th scope="row">Post Types</th>
            <td>
                <label><input type="checkbox" class="atb-ac-type" value="page" /> Pages</label>
                <label><input type="checkbox" class="atb-ac-type" value="post" /> Posts</label>
                <label><input type="checkbox" class="atb-ac-type" value="bricks_template" /> Templates</label>
            </td>
        </tr>
    </table>
    <button type="button" class="button button-primary" id="atb-ac-save">Save Access Rules</button>
    <button type="button" class="button" id="atb-ac-cancel">Cancel</button>
</div>
```

Add the corresponding JavaScript at the bottom of the settings page JS (inside the existing IIFE):
```javascript
// Access Control UI
var acPanel = document.getElementById('atb-access-control');
var acPrefix = null;

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('atb-access-rules')) {
        acPrefix = e.target.dataset.prefix;
        document.getElementById('atb-ac-prefix').textContent = acPrefix + '...';
        acPanel.style.display = 'block';

        // Load existing rules
        fetch(ajaxUrl + '?action=atb_get_access_rules&nonce=' + nonce + '&prefix=' + acPrefix)
            .then(function(r) { return r.json(); })
            .then(function(resp) {
                if (!resp.success) return;
                var rules = resp.data;
                document.getElementById('atb-ac-mode').value = rules.mode || 'unrestricted';
                document.getElementById('atb-ac-post-ids').value = (rules.post_ids || []).join(', ');
                document.querySelectorAll('.atb-ac-type').forEach(function(cb) {
                    cb.checked = (rules.post_types || []).indexOf(cb.value) >= 0;
                });
                toggleAcFields();
            });
    }
});

document.getElementById('atb-ac-mode').addEventListener('change', toggleAcFields);

function toggleAcFields() {
    var mode = document.getElementById('atb-ac-mode').value;
    var show = mode !== 'unrestricted';
    document.getElementById('atb-ac-ids-row').style.display = show ? '' : 'none';
    document.getElementById('atb-ac-types-row').style.display = show ? '' : 'none';
}

document.getElementById('atb-ac-save').addEventListener('click', function() {
    var types = [];
    document.querySelectorAll('.atb-ac-type:checked').forEach(function(cb) { types.push(cb.value); });

    var data = new FormData();
    data.append('action', 'atb_save_access_rules');
    data.append('nonce', nonce);
    data.append('prefix', acPrefix);
    data.append('mode', document.getElementById('atb-ac-mode').value);
    data.append('post_ids', document.getElementById('atb-ac-post-ids').value);
    data.append('post_types', types.join(','));

    fetch(ajaxUrl, { method: 'POST', body: data })
        .then(function(r) { return r.json(); })
        .then(function(resp) {
            if (resp.success) {
                acPanel.style.display = 'none';
                alert('Access rules saved.');
            } else {
                alert('Error: ' + (resp.data || 'Unknown'));
            }
        });
});

document.getElementById('atb-ac-cancel').addEventListener('click', function() {
    acPanel.style.display = 'none';
});
```

Also update the key table row HTML to include an "Access" button. In the existing key table rows (both in PHP and in the JS that adds new rows), add an "Access" button after the "Revoke" button:
```html
<button type="button" class="button button-small atb-access-rules" data-prefix="<?php echo esc_attr( $k['prefix'] ); ?>">Access</button>
```

**Step 3: Commit**

```bash
git add plugin/agent-to-bricks/includes/class-settings.php plugin/agent-to-bricks/includes/class-api-auth.php
git commit -m "feat(plugin): add admin UI for per-key access control rules"
```

---

### Task 18: Run All Tests

**Step 1: Run Go tests**

```bash
cd cli && go test ./... -v
```

Expected: All 93 tests pass.

**Step 2: Run version check**

```bash
./scripts/sync-version.sh --check
```

Expected: All versions in sync.

**Step 3: Build CLI to verify it compiles**

```bash
make build
```

Expected: `bin/bricks` binary created successfully.

**Step 4: Commit any test fixes if needed**

---

### Task 19: Final Commit — Update Memory

**Step 1: Update MEMORY.md with new version info**

Update the "Key Facts" section to reflect:
- Version: 1.4.0 (unified, single VERSION file)
- PHP requirement: 8.0+ (not 7.4+)
- New file: `plugin/agent-to-bricks/includes/class-access-control.php`

**Step 2: Final verification commit**

```bash
git add -A
git status
# Review and commit any remaining changes
```
