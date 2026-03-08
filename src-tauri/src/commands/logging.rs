#[tauri::command]
pub fn log_action(action: String, detail: String) {
    log::info!("[action] {} | {}", action, detail);
}
