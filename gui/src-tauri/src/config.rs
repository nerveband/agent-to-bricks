use std::path::PathBuf;

fn expand_tilde(path: &str) -> PathBuf {
    if path.starts_with("~/") || path.starts_with("~\\") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

#[tauri::command]
pub async fn read_config(path: String) -> Result<String, String> {
    let full_path = expand_tilde(&path);
    std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Could not read {}: {}", full_path.display(), e))
}

#[tauri::command]
pub async fn write_config(path: String, content: String) -> Result<(), String> {
    let full_path = expand_tilde(&path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create directory: {}", e))?;
    }
    std::fs::write(&full_path, &content)
        .map_err(|e| format!("Could not write {}: {}", full_path.display(), e))
}

#[tauri::command]
pub async fn config_exists(path: String) -> bool {
    expand_tilde(&path).exists()
}
