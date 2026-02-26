mod config;

use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Shared HTTP client for connection pooling across all API calls.
struct HttpClient(Arc<reqwest::Client>);

#[derive(Serialize)]
struct ToolDetection {
    command: String,
    installed: bool,
    version: Option<String>,
    path: Option<String>,
    /// How the tool was found: "shell", "direct", or "not_found"
    found_via: String,
}

#[derive(Serialize)]
struct EnvironmentInfo {
    os: String,
    arch: String,
    shell_path: String,
    shell_kind: String,
    extra_dirs: Vec<String>,
}

#[derive(Serialize)]
struct ConnectionResult {
    success: bool,
    status: u16,
    message: String,
    site_name: Option<String>,
}

/// Get the user's login shell with platform-appropriate fallbacks.
fn user_shell() -> String {
    if cfg!(target_os = "windows") {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

/// Classify a shell path to decide command syntax and flags.
#[derive(Debug, PartialEq)]
enum ShellKind {
    /// POSIX-compatible: bash, zsh, sh, dash, ash, ksh, etc.
    Posix,
    /// Fish shell — uses `set -gx`, no `-i` with `-c`.
    Fish,
    /// PowerShell (pwsh on Unix, powershell.exe on Windows).
    Pwsh,
    /// Nushell — different syntax, but `which` and `-l -c` work.
    Nu,
    /// Windows cmd.exe.
    Cmd,
}

fn detect_shell_kind(shell_path: &str) -> ShellKind {
    let name = std::path::Path::new(shell_path)
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();
    match name.as_str() {
        "fish" => ShellKind::Fish,
        "pwsh" | "powershell" => ShellKind::Pwsh,
        "nu" | "nushell" => ShellKind::Nu,
        "cmd" => ShellKind::Cmd,
        // bash, zsh, sh, dash, ash, ksh, etc.
        _ => ShellKind::Posix,
    }
}

/// Build extra PATH directories for the current platform.
/// These cover common install locations that may not be in PATH when a GUI
/// app is launched outside a terminal (Finder/Dock, desktop shortcut, etc.).
fn extra_path_dirs_unix() -> Vec<String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| String::new());
    let mut dirs = Vec::new();
    if !home.is_empty() {
        dirs.push(format!("{}/go/bin", home));        // Go binaries
        dirs.push(format!("{}/.local/bin", home));     // pip / pipx / user-local
        dirs.push(format!("{}/.cargo/bin", home));     // Rust / cargo
        dirs.push(format!("{}/.bun/bin", home));       // Bun
    }
    dirs.push("/opt/homebrew/bin".to_string());        // Homebrew (Apple Silicon)
    dirs.push("/usr/local/bin".to_string());           // Homebrew (Intel) / system
    dirs.push("/usr/local/go/bin".to_string());        // Go system install
    dirs.push("/snap/bin".to_string());                // Snap packages (Ubuntu/Linux)
    dirs
}

fn extra_path_dirs_windows() -> Vec<String> {
    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    let mut dirs = Vec::new();
    if !userprofile.is_empty() {
        dirs.push(format!("{}\\go\\bin", userprofile));     // Go binaries
        dirs.push(format!("{}\\.cargo\\bin", userprofile)); // Rust / cargo
        dirs.push(format!("{}\\.bun\\bin", userprofile));   // Bun
    }
    if !appdata.is_empty() {
        dirs.push(format!("{}\\npm", appdata));             // npm global
    }
    dirs
}

/// Run a command inside the user's login shell so we inherit PATH.
///
/// Detects the user's shell (bash, zsh, fish, pwsh, nushell, cmd) and uses
/// appropriate syntax for each.  Also prepends common tool directories as a
/// fallback for tools installed in standard locations.
fn shell_exec(cmd: &str) -> Option<String> {
    let output = if cfg!(target_os = "windows") {
        shell_exec_windows(cmd)
    } else {
        shell_exec_unix(cmd)
    };

    output.and_then(|o| {
        if o.status.success() {
            let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if stdout.is_empty() {
                let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
                if stderr.is_empty() { None } else { Some(stderr) }
            } else {
                Some(stdout)
            }
        } else {
            None
        }
    })
}

fn shell_exec_windows(cmd: &str) -> Option<std::process::Output> {
    let extra = extra_path_dirs_windows();
    let extra_str = extra.join(";");

    // Always use cmd.exe for tool detection on Windows.
    // COMSPEC is always cmd.exe; PowerShell is the *terminal*, not COMSPEC.
    let augmented = if extra_str.is_empty() {
        cmd.to_string()
    } else {
        format!("set \"PATH={};%PATH%\" && {}", extra_str, cmd)
    };
    std::process::Command::new("cmd.exe")
        .args(["/C", &augmented])
        .output()
        .ok()
}

fn shell_exec_unix(cmd: &str) -> Option<std::process::Output> {
    let shell = user_shell();
    let kind = detect_shell_kind(&shell);
    let extra = extra_path_dirs_unix();
    let extra_colon = extra.join(":");

    match kind {
        ShellKind::Fish => {
            // Fish: config.fish is sourced on every startup (login or not).
            // PATH syntax: `set -gx PATH dir1 dir2 $PATH`
            // Fish does NOT support `-i` combined with `-c`.
            let path_args = extra.join(" ");
            let augmented = if path_args.is_empty() {
                cmd.to_string()
            } else {
                format!("set -gx PATH {} $PATH; {}", path_args, cmd)
            };
            std::process::Command::new(&shell)
                .args(["-l", "-c", &augmented])
                .output()
                .ok()
        }
        ShellKind::Pwsh => {
            // PowerShell on macOS/Linux: uses $env:PATH and -Login -Command.
            let augmented = if extra_colon.is_empty() {
                cmd.to_string()
            } else {
                format!(
                    "$env:PATH = '{}' + ':' + $env:PATH; {}",
                    extra_colon, cmd
                )
            };
            std::process::Command::new(&shell)
                .args(["-Login", "-Command", &augmented])
                .output()
                .ok()
        }
        ShellKind::Nu => {
            // Nushell: config is loaded automatically on startup.
            // `which` is a built-in.  PATH manipulation uses different syntax
            // ($env.PATH = ...) which is fragile to construct, so we try nu
            // first without PATH augmentation (its config should have it),
            // then fall back to /bin/sh with POSIX syntax.
            let result = std::process::Command::new(&shell)
                .args(["-l", "-c", cmd])
                .output()
                .ok();
            if result.as_ref().map_or(false, |o| o.status.success()) {
                return result;
            }
            // Fallback to /bin/sh for PATH augmentation
            let augmented = format!("export PATH=\"{}:$PATH\"; {}", extra_colon, cmd);
            std::process::Command::new("/bin/sh")
                .args(["-l", "-c", &augmented])
                .output()
                .ok()
        }
        _ => {
            // POSIX shells (bash, zsh, sh, dash, ash, ksh, etc.)
            // Use -l (login) + -i (interactive) to source both .zprofile AND
            // .zshrc / .bash_profile AND .bashrc.
            let augmented = format!("export PATH=\"{}:$PATH\"; {}", extra_colon, cmd);
            std::process::Command::new(&shell)
                .args(["-l", "-i", "-c", &augmented])
                .output()
                .ok()
        }
    }
}

/// Direct binary search using the `which` crate — a cross-platform Rust
/// implementation that handles Windows `.exe`/`.cmd`/`.bat` extensions,
/// Unix executable-permission checks, and PATH splitting natively.
///
/// We search the system PATH merged with our extra directories so that
/// recently-installed tools are found even if the current process PATH
/// hasn't been updated yet.
fn find_binary_direct(binary: &str) -> Option<String> {
    let sys_path = std::env::var("PATH").unwrap_or_default();
    let (extra, sep) = if cfg!(target_os = "windows") {
        (extra_path_dirs_windows().join(";"), ";")
    } else {
        (extra_path_dirs_unix().join(":"), ":")
    };
    let merged = format!("{}{}{}", extra, sep, sys_path);

    // which::which_in searches for `binary` in `merged`, using "." as cwd
    // for relative path resolution (not really needed here).
    which::which_in(binary, Some(merged), ".")
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

/// Get the user's full environment from their login shell (macOS/Linux GUI apps
/// don't inherit it). On Windows, the environment is already inherited by the
/// GUI process, so we return `std::env::vars()` directly.
///
/// Uses `env -0` (null-delimited) via the user's shell.  The shell-specific
/// PATH augmentation is handled by `shell_exec_unix`, which detects fish,
/// pwsh, nushell, and POSIX shells automatically.
#[tauri::command]
fn get_shell_env() -> std::collections::HashMap<String, String> {
    if cfg!(target_os = "windows") {
        return std::env::vars().collect();
    }

    // `env -0` is an external command (/usr/bin/env) that works in any shell.
    // shell_exec handles PATH augmentation with the correct syntax per shell.
    let raw = shell_exec("env -0");

    let mut env = std::collections::HashMap::new();
    if let Some(text) = raw {
        for entry in text.split('\0') {
            if let Some((key, value)) = entry.split_once('=') {
                if !key.is_empty() {
                    env.insert(key.to_string(), value.to_string());
                }
            }
        }
    }
    env
}

#[derive(Serialize)]
struct PlatformShell {
    os: String,
    shell: String,
    interactive_args: Vec<String>,
}

/// Return the platform OS, default shell path, and interactive shell arguments.
/// Used by the frontend PTY spawn to select the correct shell per platform.
#[tauri::command]
fn get_platform_shell() -> PlatformShell {
    let os = std::env::consts::OS.to_string();

    if cfg!(target_os = "windows") {
        let shell = std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string());
        let interactive_args = if shell.to_lowercase().contains("powershell")
            || shell.to_lowercase().contains("pwsh")
        {
            vec!["-NoLogo".to_string()]
        } else {
            vec![]
        };
        PlatformShell { os, shell, interactive_args }
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        PlatformShell {
            os,
            shell,
            interactive_args: vec!["--login".to_string()],
        }
    }
}

/// Extract a file path from shell output, accounting for shell startup noise.
fn extract_path(raw: &str, kind: &ShellKind) -> Option<String> {
    match kind {
        ShellKind::Cmd => {
            // `where` on Windows returns full paths like C:\Users\...; take the first.
            raw.lines()
                .find(|l| !l.trim().is_empty())
                .map(|l| l.trim().to_string())
        }
        ShellKind::Pwsh => {
            // PowerShell `Get-Command(...).Source` returns a single clean path.
            // On Unix it starts with `/`, on Windows with a drive letter.
            raw.lines()
                .rev()
                .find(|l| {
                    let t = l.trim();
                    t.starts_with('/') || (t.len() >= 3 && t.as_bytes().get(1) == Some(&b':'))
                })
                .map(|l| l.trim().to_string())
        }
        _ => {
            // POSIX / Fish / Nu: `which` outputs an absolute path.
            // The interactive flag may cause .bashrc/.zshrc to print noise to
            // stdout before the result, so find the last line starting with `/`.
            raw.lines()
                .rev()
                .find(|l| l.trim().starts_with('/'))
                .map(|l| l.trim().to_string())
        }
    }
}

/// Return information about the detected runtime environment.
/// Called once at startup so the frontend can display it in the detection log.
#[tauri::command]
fn detect_environment() -> EnvironmentInfo {
    let shell_path = if cfg!(target_os = "windows") {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        user_shell()
    };
    let kind = detect_shell_kind(&shell_path);
    let extra_dirs = if cfg!(target_os = "windows") {
        extra_path_dirs_windows()
    } else {
        extra_path_dirs_unix()
    };
    EnvironmentInfo {
        os: format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        arch: std::env::consts::ARCH.to_string(),
        shell_path,
        shell_kind: format!("{:?}", kind),
        extra_dirs,
    }
}

#[tauri::command]
async fn detect_tool(command: String) -> ToolDetection {
    // Build the "find binary" command appropriate for the user's shell.
    let shell = user_shell();
    let kind = if cfg!(target_os = "windows") {
        ShellKind::Cmd
    } else {
        detect_shell_kind(&shell)
    };

    let which_cmd = match kind {
        ShellKind::Cmd => format!("where {}", command),
        // PowerShell uses Get-Command; `which` is not available.
        ShellKind::Pwsh => format!(
            "(Get-Command {} -ErrorAction SilentlyContinue).Source",
            command
        ),
        // bash, zsh, fish, nushell all have `which` (built-in or external)
        _ => format!("which {}", command),
    };

    // Run detection via the user's shell.
    let shell_path = shell_exec(&which_cmd).and_then(|p| extract_path(&p, &kind));
    let mut found_via = if shell_path.is_some() { "shell" } else { "not_found" };

    // Fallback: direct Rust binary search if shell-based detection failed.
    let path = shell_path.or_else(|| {
        let direct = find_binary_direct(&command);
        if direct.is_some() {
            found_via = "direct";
        }
        direct
    });

    // Version output may contain shell startup noise.
    // Find the last line that contains digits (version-like).
    let version = if path.is_some() {
        shell_exec(&format!("{} --version", command)).map(|v| {
            v.lines()
                .rev()
                .find(|l| l.chars().any(|c| c.is_ascii_digit()))
                .unwrap_or(v.lines().last().unwrap_or(&v))
                .trim()
                .to_string()
        })
    } else {
        None
    };

    ToolDetection {
        command,
        installed: path.is_some(),
        version,
        path,
        found_via: found_via.to_string(),
    }
}

#[derive(Serialize, Deserialize)]
struct PageInfo {
    id: u64,
    title: String,
    slug: String,
    status: String,
    modified: String,
}

/// Search pages on a WordPress site via the Agent to Bricks API.
#[tauri::command]
async fn search_pages(
    http: tauri::State<'_, HttpClient>,
    site_url: String,
    api_key: String,
    query: String,
    per_page: u32,
) -> Result<Vec<PageInfo>, String> {
    let path = format!(
        "/pages?search={}&per_page={}",
        urlencoding::encode(&query),
        per_page.min(50)
    );
    atb_get(&http.0, &site_url, &api_key, &path).await
}

#[derive(Serialize, Deserialize)]
struct ElementInfo {
    id: String,
    name: String,
    label: Option<String>,
    parent: Option<String>,
    children: Option<Vec<String>>,
    settings: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct PageElements {
    elements: Vec<ElementInfo>,
    count: u32,
    #[serde(rename = "contentHash")]
    content_hash: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct GlobalClass {
    id: serde_json::Value,
    name: String,
    settings: Option<serde_json::Value>,
    framework: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ComponentInfo {
    id: u64,
    title: String,
    #[serde(rename = "type")]
    component_type: Option<String>,
    status: Option<String>,
    #[serde(rename = "elementCount")]
    element_count: Option<u32>,
}

#[derive(Serialize, Deserialize)]
struct MediaItem {
    id: u64,
    title: String,
    url: String,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    filesize: Option<u64>,
}

#[derive(Serialize, Deserialize)]
struct SiteStyles {
    #[serde(rename = "themeStyles")]
    theme_styles: Option<Vec<serde_json::Value>>,
    #[serde(rename = "colorPalette")]
    color_palette: Option<Vec<serde_json::Value>>,
    #[serde(rename = "globalSettings")]
    global_settings: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct SiteVariables {
    variables: Option<Vec<serde_json::Value>>,
    #[serde(rename = "extractedFromCSS")]
    extracted_from_css: Option<Vec<serde_json::Value>>,
}

#[derive(Serialize, Deserialize)]
struct SearchResult {
    #[serde(rename = "postId")]
    post_id: u64,
    #[serde(rename = "postTitle")]
    post_title: String,
    #[serde(rename = "elementId")]
    element_id: String,
    #[serde(rename = "elementType")]
    element_type: String,
    #[serde(rename = "elementLabel")]
    element_label: Option<String>,
    settings: Option<serde_json::Value>,
}

/// Helper: build an authenticated GET request to the ATB API using the shared client.
async fn atb_get<T: serde::de::DeserializeOwned>(
    client: &reqwest::Client,
    site_url: &str,
    api_key: &str,
    path: &str,
) -> Result<T, String> {
    let url = format!("{}/wp-json/agent-bricks/v1{}", site_url.trim_end_matches('/'), path);
    let resp = client.get(&url).header("X-ATB-Key", api_key).send().await
        .map_err(|e| format!("Request failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Server responded with status {}", resp.status()));
    }
    resp.json::<T>().await.map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
async fn get_page_elements(
    http: tauri::State<'_, HttpClient>,
    site_url: String,
    api_key: String,
    page_id: u64,
) -> Result<PageElements, String> {
    atb_get(&http.0, &site_url, &api_key, &format!("/pages/{}/elements", page_id)).await
}

#[tauri::command]
async fn search_elements(
    http: tauri::State<'_, HttpClient>,
    site_url: String,
    api_key: String,
    element_type: Option<String>,
    global_class: Option<String>,
    per_page: Option<u32>,
) -> Result<serde_json::Value, String> {
    let mut path = "/search/elements?".to_string();
    if let Some(t) = element_type { path.push_str(&format!("element_type={}&", urlencoding::encode(&t))); }
    if let Some(c) = global_class { path.push_str(&format!("global_class={}&", urlencoding::encode(&c))); }
    path.push_str(&format!("per_page={}", per_page.unwrap_or(50).min(100)));
    atb_get(&http.0, &site_url, &api_key, &path).await
}

#[tauri::command]
async fn get_global_classes(
    http: tauri::State<'_, HttpClient>,
    site_url: String,
    api_key: String,
    framework: Option<String>,
) -> Result<serde_json::Value, String> {
    let path = match framework {
        Some(fw) => format!("/classes?framework={}", urlencoding::encode(&fw)),
        None => "/classes".to_string(),
    };
    atb_get(&http.0, &site_url, &api_key, &path).await
}

#[tauri::command]
async fn get_site_styles(http: tauri::State<'_, HttpClient>, site_url: String, api_key: String) -> Result<SiteStyles, String> {
    atb_get(&http.0, &site_url, &api_key, "/styles").await
}

#[tauri::command]
async fn get_site_variables(http: tauri::State<'_, HttpClient>, site_url: String, api_key: String) -> Result<SiteVariables, String> {
    atb_get(&http.0, &site_url, &api_key, "/variables").await
}

#[tauri::command]
async fn get_components(http: tauri::State<'_, HttpClient>, site_url: String, api_key: String) -> Result<serde_json::Value, String> {
    atb_get(&http.0, &site_url, &api_key, "/components").await
}

#[tauri::command]
async fn get_templates(http: tauri::State<'_, HttpClient>, site_url: String, api_key: String) -> Result<serde_json::Value, String> {
    atb_get(&http.0, &site_url, &api_key, "/templates").await
}

#[tauri::command]
async fn get_media(
    http: tauri::State<'_, HttpClient>,
    site_url: String,
    api_key: String,
    search: Option<String>,
) -> Result<serde_json::Value, String> {
    let path = match search {
        Some(q) => format!("/media?search={}", urlencoding::encode(&q)),
        None => "/media".to_string(),
    };
    atb_get(&http.0, &site_url, &api_key, &path).await
}

/// Test connection to a WordPress site's Agent to Bricks API.
/// Also fetches the WordPress site title from /wp-json/ root endpoint.
/// Runs from Rust to bypass webview CORS restrictions.
#[tauri::command]
async fn test_site_connection(http: tauri::State<'_, HttpClient>, site_url: String, api_key: String) -> Result<ConnectionResult, String> {
    let base = site_url.trim_end_matches('/');
    let url = format!("{}/wp-json/agent-bricks/v1/site/info", base);

    match http.0.get(&url).header("X-ATB-Key", &api_key).send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            if resp.status().is_success() {
                // Try to fetch the WP site name from the REST API root
                let site_name = fetch_wp_site_name(&http.0, base).await;
                Ok(ConnectionResult {
                    success: true,
                    status,
                    message: "Connected successfully".to_string(),
                    site_name,
                })
            } else if status == 401 || status == 403 {
                Ok(ConnectionResult {
                    success: false,
                    status,
                    message: "Invalid API key. Check your key in WordPress under Agent to Bricks.".to_string(),
                    site_name: None,
                })
            } else if status == 404 {
                Ok(ConnectionResult {
                    success: false,
                    status,
                    message: "Agent to Bricks plugin not found. Make sure it's installed and activated.".to_string(),
                    site_name: None,
                })
            } else {
                Ok(ConnectionResult {
                    success: false,
                    status,
                    message: format!("Server responded with status {}.", status),
                    site_name: None,
                })
            }
        }
        Err(e) => Ok(ConnectionResult {
            success: false,
            status: 0,
            message: format!("Could not reach the site: {}", e),
            site_name: None,
        }),
    }
}

/// Fetch the WordPress site name from the REST API root endpoint.
async fn fetch_wp_site_name(client: &reqwest::Client, base_url: &str) -> Option<String> {
    let url = format!("{}/wp-json/", base_url);
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() { return None; }
    let json: serde_json::Value = resp.json().await.ok()?;
    json.get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("Failed to create HTTP client");

    tauri::Builder::default()
        .manage(HttpClient(Arc::new(client)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            detect_environment,
            detect_tool,
            get_shell_env,
            get_platform_shell,
            search_pages,
            test_site_connection,
            get_page_elements,
            search_elements,
            get_global_classes,
            get_site_styles,
            get_site_variables,
            get_components,
            get_templates,
            get_media,
            config::read_config,
            config::write_config,
            config::config_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
