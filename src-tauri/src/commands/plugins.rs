use sha2::{Sha256, Digest};
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::Manager;

/// プラグインディレクトリ内のサブディレクトリ一覧を返す
#[tauri::command]
pub fn list_plugin_dirs(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;

    let plugins_dir = app_data.join("plugins");

    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir)
            .map_err(|e| format!("プラグインディレクトリの作成に失敗: {}", e))?;
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&plugins_dir)
        .map_err(|e| format!("プラグインディレクトリの読み込みに失敗: {}", e))?;

    let dirs: Vec<String> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            if entry.file_type().ok()?.is_dir() {
                entry.path().to_str().map(|s| s.to_string())
            } else {
                None
            }
        })
        .collect();

    Ok(dirs)
}

/// プラグインディレクトリ内の plugin.json を読み込む
#[tauri::command]
pub fn read_plugin_manifest(app_handle: tauri::AppHandle, plugin_dir: String) -> Result<String, String> {
    let manifest_path = Path::new(&plugin_dir).join("plugin.json");

    if !manifest_path.exists() {
        return Err(format!(
            "plugin.json が見つかりません: {}",
            manifest_path.display()
        ));
    }

    // セキュリティ: プラグインディレクトリ外のアクセスを防止
    let canonical = manifest_path
        .canonicalize()
        .map_err(|e| format!("パスの正規化に失敗: {}", e))?;
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
    let plugins_dir = app_data.join("plugins");
    let plugins_canonical = plugins_dir.canonicalize().unwrap_or(plugins_dir);
    if !canonical.starts_with(&plugins_canonical) {
        return Err("プラグインディレクトリ外のファイルにはアクセスできません".to_string());
    }

    fs::read_to_string(&canonical)
        .map_err(|e| format!("plugin.json の読み込みに失敗: {}", e))
}

/// プラグインファイルをバイト列として読み込む（JS/WASM 等）
#[tauri::command]
pub fn read_plugin_file(app_handle: tauri::AppHandle, file_path: String) -> Result<Vec<u8>, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("ファイルが見つかりません: {}", path.display()));
    }

    // セキュリティ: プラグインディレクトリ外のファイルへのアクセスを防止
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("パスの正規化に失敗: {}", e))?;

    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
    let plugins_dir = app_data.join("plugins");
    let plugins_canonical = plugins_dir
        .canonicalize()
        .unwrap_or(plugins_dir);

    if !canonical.starts_with(&plugins_canonical) {
        return Err("プラグインディレクトリ外のファイルにはアクセスできません".to_string());
    }

    fs::read(&canonical).map_err(|e| format!("ファイルの読み込みに失敗: {}", e))
}

/// プラグイン設定ファイルを読み込む
#[tauri::command]
pub fn read_plugin_settings(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;

    let settings_path = app_data.join("plugin-settings.json");

    if !settings_path.exists() {
        return Ok("{}".to_string());
    }

    fs::read_to_string(&settings_path)
        .map_err(|e| format!("設定ファイルの読み込みに失敗: {}", e))
}

/// プラグイン設定ファイルを書き込む
#[tauri::command]
pub fn write_plugin_settings(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;

    let settings_path = app_data.join("plugin-settings.json");

    // 親ディレクトリが存在することを確認
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("ディレクトリの作成に失敗: {}", e))?;
    }

    fs::write(&settings_path, content)
        .map_err(|e| format!("設定ファイルの書き込みに失敗: {}", e))
}

/// プラグインファイルの整合性を検証する
/// マニフェストに checksums フィールドがある場合、SHA-256 ハッシュを検証する
/// checksums が未定義の場合は警告を返す
#[tauri::command]
pub fn verify_plugin_integrity(app_handle: tauri::AppHandle, plugin_dir: String) -> Result<String, String> {
    let dir_path = Path::new(&plugin_dir);
    let manifest_path = dir_path.join("plugin.json");

    // セキュリティ: プラグインディレクトリ外のアクセスを防止
    let canonical = dir_path
        .canonicalize()
        .map_err(|e| format!("パスの正規化に失敗: {}", e))?;
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
    let plugins_dir = app_data.join("plugins");
    let plugins_canonical = plugins_dir.canonicalize().unwrap_or(plugins_dir);
    if !canonical.starts_with(&plugins_canonical) {
        return Err("プラグインディレクトリ外のファイルにはアクセスできません".to_string());
    }

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("plugin.json の読み込みに失敗: {}", e))?;
    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("plugin.json のパースに失敗: {}", e))?;

    let checksums = match manifest.get("checksums") {
        Some(serde_json::Value::Object(map)) => map,
        _ => {
            return Ok("no_checksums".to_string());
        }
    };

    for (filename, expected_hash) in checksums {
        let expected = expected_hash.as_str()
            .ok_or_else(|| format!("チェックサム値が文字列ではありません: {}", filename))?;

        let file_path = dir_path.join(filename);
        let file_canonical = file_path
            .canonicalize()
            .map_err(|e| format!("{} の正規化に失敗: {}", filename, e))?;

        if !file_canonical.starts_with(&canonical) {
            return Err(format!("不正なチェックサム対象パス: {}", filename));
        }

        let mut file = fs::File::open(&file_canonical)
            .map_err(|e| format!("{} の読み込みに失敗: {}", filename, e))?;
        let mut hasher = Sha256::new();
        let mut buf = [0u8; 8192];
        loop {
            let n = file.read(&mut buf).map_err(|e| format!("読み込みエラー: {}", e))?;
            if n == 0 { break; }
            hasher.update(&buf[..n]);
        }
        let actual = format!("{:x}", hasher.finalize());

        if actual != expected {
            return Err(format!(
                "{} のチェックサムが不一致: expected={}, actual={}",
                filename, expected, actual
            ));
        }
    }

    Ok("verified".to_string())
}
