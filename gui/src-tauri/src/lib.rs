mod config;

use serde::Serialize;

#[derive(Serialize)]
struct ToolDetection {
    command: String,
    installed: bool,
    version: Option<String>,
    path: Option<String>,
}

#[tauri::command]
async fn detect_tool(command: String) -> ToolDetection {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    let path = std::process::Command::new(which_cmd)
        .arg(&command)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        });

    let version = if path.is_some() {
        std::process::Command::new(&command)
            .arg("--version")
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    if stdout.is_empty() {
                        let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
                        if stderr.is_empty() {
                            None
                        } else {
                            Some(stderr)
                        }
                    } else {
                        Some(stdout)
                    }
                } else {
                    None
                }
            })
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            detect_tool,
            config::read_config,
            config::write_config,
            config::config_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
