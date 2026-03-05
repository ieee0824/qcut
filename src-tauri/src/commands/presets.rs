use std::fs;
use tauri::Manager;

/// トランジションプリセットファイルを読み込む
#[tauri::command]
pub fn read_transition_presets(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;

    let presets_path = app_data.join("transition-presets.json");

    if !presets_path.exists() {
        return Ok("[]".to_string());
    }

    fs::read_to_string(&presets_path)
        .map_err(|e| format!("プリセットファイルの読み込みに失敗: {}", e))
}

/// トランジションプリセットファイルを書き込む
#[tauri::command]
pub fn write_transition_presets(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;

    let presets_path = app_data.join("transition-presets.json");

    if let Some(parent) = presets_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("ディレクトリの作成に失敗: {}", e))?;
    }

    fs::write(&presets_path, content)
        .map_err(|e| format!("プリセットファイルの書き込みに失敗: {}", e))
}
