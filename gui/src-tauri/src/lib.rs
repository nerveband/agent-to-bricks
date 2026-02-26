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

/// Run a command inside the user's login shell so we inherit PATH.
/// Uses platform-appropriate shell flags (POSIX `-l -c` vs Windows `/C`).
fn shell_exec(cmd: &str) -> Option<String> {
    let output = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd.exe")
            .args(["/C", cmd])
            .output()
            .ok()
    } else {
        let shell = user_shell();
        std::process::Command::new(&shell)
            .args(["-l", "-c", cmd])
            .output()
            .ok()
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

/// Get the user's full environment from their login shell (macOS/Linux GUI apps
/// don't inherit it). On Windows, the environment is already inherited by the
/// GUI process, so we return `std::env::vars()` directly.
#[tauri::command]
fn get_shell_env() -> std::collections::HashMap<String, String> {
    if cfg!(target_os = "windows") {
        return std::env::vars().collect();
    }

    let shell = user_shell();
    // Use env -0 for null-delimited output (safe with multiline values)
    let output = std::process::Command::new(&shell)
        .args(["-l", "-c", "env -0"])
        .output()
        .ok();

    let mut env = std::collections::HashMap::new();
    if let Some(o) = output {
        let text = String::from_utf8_lossy(&o.stdout);
        // Split on null bytes
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

#[tauri::command]
async fn detect_tool(command: String) -> ToolDetection {
    // Use login shell so we get the user's full PATH
    let which_cmd = if cfg!(target_os = "windows") {
        format!("where {}", command)
    } else {
        format!("which {}", command)
    };

    // `where` on Windows can return multiple paths (one per line) — take only the first.
    let path = shell_exec(&which_cmd).map(|p| {
        p.lines().next().unwrap_or(&p).to_string()
    });

    let version = if path.is_some() {
        shell_exec(&format!("{} --version", command))
    } else {
        None
    };

    ToolDetection {
        command,
        installed: path.is_some(),
        version,
        path,
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
        .invoke_handler(tauri::generate_handler![
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
