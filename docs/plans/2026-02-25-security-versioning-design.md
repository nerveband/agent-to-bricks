# Security Hardening, Unified Versioning & Access Control

Date: 2026-02-25

## Problem

Code review identified 5 critical, 6 important, and 6 minor issues across the CLI (Go) and Plugin (PHP). There is no unified versioning across CLI, GUI, and plugin. There is no access control mechanism to restrict which pages an AI agent can access.

## Design

### 1. Unified Versioning

Single source of truth: `VERSION` file at project root containing `1.4.0`.

**How each component reads it:**

- **Makefile**: reads `VERSION` file, passes via `-ldflags -X main.version=$(VERSION)` to Go CLI
- **GoReleaser**: uses git tags (tags are cut matching VERSION file value)
- **Plugin** (`agent-to-bricks.php`): header `Version:` and `AGENT_BRICKS_VERSION` constant both set to value from VERSION
- **GUI**: `package.json`, `tauri.conf.json`, `Cargo.toml` set to value from VERSION; `SettingsDialog.tsx` reads from package.json import instead of hardcoding
- **Build script** (`scripts/sync-version.sh`): reads VERSION and patches all component files

### 2. Critical Security Fixes

**C1: Config file permissions (CLI)**
- Change `config.Save()` to use `0700` for directory, `0600` for file
- Same for `styles/profile.go` and `updater/updater.go` cache writes

**C2: Self-update checksum verification (CLI)**
- Download `checksums.txt` alongside binary archive
- Parse SHA256 checksum for the target archive
- Verify downloaded archive matches before extracting
- Abort with clear error if checksum mismatch

**C3: Strict version format in plugin update API**
- Validate version parameter with `preg_match('/^\d+\.\d+\.\d+$/', $version)`
- Reject non-conforming version strings with 400 error

**C4: Rate limiting on API authentication (Plugin)**
- Use WordPress transients for IP-based rate limiting
- Key: `atb_auth_fail_{ip_hash}`, value: failure count, expiry: 5 minutes
- Block after 10 failed attempts per IP per 5-minute window
- Return 429 Too Many Requests with Retry-After header
- Debounce `touch_key()` to update only every 5 minutes per key

**C5: Random IV for encryption (Plugin)**
- Generate random IV with `random_bytes(16)` for each encryption
- Prepend IV to ciphertext before base64 encoding
- Extract IV from first 16 bytes during decryption
- Migrate existing encrypted values on first decrypt attempt (fallback to old static IV if new method fails)

### 3. Important Fixes

**I1: Access Control (Allow/Deny List)**
- New class: `ATB_Access_Control` in `class-access-control.php`
- Data model in `wp_options` key `agent_bricks_access_rules`:
  ```php
  [
    'atb_wZGm' => [  // keyed by API key prefix
      'mode' => 'allow',  // 'unrestricted' | 'allow' | 'deny'
      'post_ids' => [1338, 42],
      'post_types' => ['page'],
    ],
    '__default__' => ['mode' => 'unrestricted'],
  ]
  ```
- Static method `ATB_Access_Control::can_access_post($post_id)` returns true/WP_Error
- Called from every permission_callback that deals with post-level access
- Current API key prefix stored in static property after authentication
- Admin UI: per-key settings in the settings page

**I2: Element data sanitization**
- Apply `wp_kses_post` to text-type settings in all write paths
- Validate element structure (require `id` and `name` fields)
- Add `ATB_Elements_API::sanitize_elements()` static method

**I3: Search API memory fix**
- Change `posts_per_page` from `-1` to batched processing (50 at a time)
- Hard limit of 500 posts scanned total
- Early termination when result limit reached

**I4: URL encoding in CLI client**
- Use `url.QueryEscape` for `ListClasses` framework parameter
- Use `url.QueryEscape` for `ListMedia` search parameter

**I5: Cryptographic snapshot IDs**
- Replace `md5(uniqid())` with `bin2hex(random_bytes(8))`

**I6: Correct capabilities for templates**
- DELETE: check `delete_post` capability with post_id
- POST/create: check `publish_posts` capability
- PATCH/update: check `edit_post` capability with post_id
- GET: check `edit_post` capability with post_id (for single) or `edit_posts` (for list)

### 4. Hosting/Platform Fixes

**HP1**: OpenSSL check on plugin activation hook
**HP3**: Check `DISALLOW_FILE_MODS` before plugin self-update
**HP5**: LLM timeout respects `max_execution_time`
**HP6**: `opcache_reset()` after plugin self-update

### 5. Minor Fixes

**M1**: Mask API key values in `config set` output
**M5**: Handle `os.UserHomeDir()` errors with fallback to current directory

## Files Modified

### New files
- `VERSION` (project root)
- `scripts/sync-version.sh`
- `plugin/agent-to-bricks/includes/class-access-control.php`

### CLI (Go)
- `cli/internal/config/config.go` — file permissions
- `cli/internal/updater/selfupdate.go` — checksum verification
- `cli/internal/updater/updater.go` — home dir error handling, file permissions
- `cli/internal/styles/profile.go` — file permissions, home dir error handling
- `cli/internal/client/client.go` — URL encoding
- `cli/cmd/config.go` — mask API key output
- `Makefile` — read VERSION file

### Plugin (PHP)
- `plugin/agent-to-bricks/agent-to-bricks.php` — version, load access control, activation hook
- `plugin/agent-to-bricks/includes/class-api-auth.php` — rate limiting, random IV, store key prefix
- `plugin/agent-to-bricks/includes/class-settings.php` — random IV with migration
- `plugin/agent-to-bricks/includes/class-update-api.php` — version validation, DISALLOW_FILE_MODS, opcache
- `plugin/agent-to-bricks/includes/class-elements-api.php` — element sanitization, access control
- `plugin/agent-to-bricks/includes/class-search-api.php` — batch processing, access control
- `plugin/agent-to-bricks/includes/class-templates-api.php` — correct capabilities, access control
- `plugin/agent-to-bricks/includes/class-snapshots-api.php` — random IDs, access control
- `plugin/agent-to-bricks/includes/class-llm-client.php` — timeout handling

### GUI
- `gui/package.json` — version
- `gui/src-tauri/tauri.conf.json` — version
- `gui/src-tauri/Cargo.toml` — version
- `gui/src/components/SettingsDialog.tsx` — dynamic version
