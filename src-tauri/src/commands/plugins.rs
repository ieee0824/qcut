use sha2::{Sha256, Digest};
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::Manager;

/// import_plugin のインポート結果
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPluginResult {
    pub plugin_id: String,
    /// 同一 ID のプラグインが既にインストール済みの場合 true
    pub conflict: bool,
}

/// プラグインディレクトリを app_data_dir/plugins/{id}/ にインポートする
/// force=false かつ既存プラグインがある場合は conflict=true を返すだけでコピーしない
/// force=true の場合は上書きする
#[tauri::command]
pub fn import_plugin(
    app_handle: tauri::AppHandle,
    src_path: String,
    force: bool,
) -> Result<ImportPluginResult, String> {
    let src = Path::new(&src_path);

    // plugin.json を読み込んで id を取得する
    let manifest_path = src.join("plugin.json");
    if !manifest_path.exists() {
        return Err("plugin.json が見つかりません。プラグインディレクトリを選択してください。".to_string());
    }
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("plugin.json の読み込みに失敗: {}", e))?;
    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("plugin.json のパースに失敗: {}", e))?;

    let plugin_id = manifest
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "plugin.json に id フィールドがありません".to_string())?;

    // id にパストラバーサル文字が含まれていないことを確認
    if plugin_id.is_empty()
        || plugin_id.contains('/')
        || plugin_id.contains('\\')
        || plugin_id.contains("..")
    {
        return Err(format!("不正なプラグイン ID: {}", plugin_id));
    }

    // 必須フィールドの存在チェック（フロント側 PluginLoader.validateManifest と同等）
    for field in &["name", "version", "type", "entry", "description", "author", "minAppVersion", "category", "permissions"] {
        if manifest.get(field).is_none() {
            return Err(format!("plugin.json に必須フィールド \"{}\" がありません", field));
        }
    }

    // 文字列フィールドの型チェック
    for field in &["name", "version", "type", "description", "author", "minAppVersion", "category"] {
        if manifest.get(field).and_then(|v| v.as_str()).is_none() {
            return Err(format!("plugin.json の \"{}\" フィールドは文字列である必要があります", field));
        }
    }

    // permissions: 文字列配列であること
    let permissions = manifest.get("permissions").unwrap();
    if !permissions.is_array() {
        return Err("plugin.json の \"permissions\" フィールドは配列である必要があります".to_string());
    }
    if !permissions.as_array().unwrap().iter().all(|p| p.is_string()) {
        return Err("plugin.json の \"permissions\" 配列の要素はすべて文字列である必要があります".to_string());
    }

    // category の許可リストチェック
    let valid_categories = ["effect", "filter", "export", "import", "ui", "tool"];
    let category = manifest.get("category").and_then(|v| v.as_str()).unwrap();
    if !valid_categories.contains(&category) {
        return Err(format!("plugin.json の \"category\" が不正です: {} (許可値: {:?})", category, valid_categories));
    }

    // type と entry の整合性チェック
    let plugin_type = manifest.get("type").and_then(|v| v.as_str()).unwrap();
    let entry = manifest.get("entry").unwrap();
    match plugin_type {
        "typescript" => {
            let ok = entry.as_str().is_some()
                || entry.as_object().and_then(|o| o.get("js")).and_then(|v| v.as_str()).is_some();
            if !ok {
                return Err("type=\"typescript\" の場合、entry に js フィールドまたは文字列が必要です".to_string());
            }
        }
        "wasm" => {
            let ok = entry.as_str().is_some()
                || entry.as_object().and_then(|o| o.get("wasm")).and_then(|v| v.as_str()).is_some();
            if !ok {
                return Err("type=\"wasm\" の場合、entry に wasm フィールドまたは文字列が必要です".to_string());
            }
        }
        "hybrid" => {
            let obj = entry.as_object().ok_or("type=\"hybrid\" の場合、entry はオブジェクトである必要があります")?;
            let has_js = obj.get("js").and_then(|v| v.as_str()).is_some();
            let has_wasm = obj.get("wasm").and_then(|v| v.as_str()).is_some();
            if !has_js || !has_wasm {
                return Err("type=\"hybrid\" の場合、entry に js と wasm の両フィールドが必要です".to_string());
            }
        }
        other => {
            return Err(format!("plugin.json の \"type\" が不正です: {} (許可値: typescript, wasm, hybrid)", other));
        }
    }

    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
    let plugins_dir = app_data.join("plugins");
    let dest = plugins_dir.join(plugin_id);

    // 既存プラグインとの衝突チェック
    if dest.exists() && !force {
        return Ok(ImportPluginResult {
            plugin_id: plugin_id.to_string(),
            conflict: true,
        });
    }

    // コピー先ディレクトリを作成（上書きの場合は一旦削除）
    if dest.exists() {
        fs::remove_dir_all(&dest)
            .map_err(|e| format!("既存プラグインの削除に失敗: {}", e))?;
    }
    fs::create_dir_all(&dest)
        .map_err(|e| format!("インポート先ディレクトリの作成に失敗: {}", e))?;

    // src_path 内のファイル・サブディレクトリを再帰的にコピーする
    copy_dir_recursive(src, &dest)?;

    Ok(ImportPluginResult {
        plugin_id: plugin_id.to_string(),
        conflict: false,
    })
}

/// ディレクトリを再帰的にコピーする（シンボリックリンクは通常ファイル/ディレクトリとして追跡）
fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest)
        .map_err(|e| format!("ディレクトリ作成に失敗 {}: {}", dest.display(), e))?;

    let entries = fs::read_dir(src)
        .map_err(|e| format!("ディレクトリの読み込みに失敗 {}: {}", src.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("ディレクトリエントリの読み込みに失敗: {}", e))?;
        let file_type = entry.file_type()
            .map_err(|e| format!("ファイルタイプの取得に失敗: {}", e))?;
        let dest_path = dest.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            // 通常ファイルおよびシンボリックリンク（実体をコピー）
            fs::copy(entry.path(), &dest_path)
                .map_err(|e| format!("{} のコピーに失敗: {}", entry.file_name().to_string_lossy(), e))?;
        }
    }

    Ok(())
}

/// インストール済みプラグインを削除する
#[tauri::command]
pub fn delete_plugin(
    app_handle: tauri::AppHandle,
    plugin_id: String,
) -> Result<(), String> {
    // plugin_id のバリデーション
    if plugin_id.is_empty()
        || plugin_id.contains('/')
        || plugin_id.contains('\\')
        || plugin_id.contains("..")
    {
        return Err(format!("不正なプラグイン ID: {}", plugin_id));
    }

    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
    let plugin_dir = app_data.join("plugins").join(&plugin_id);

    if !plugin_dir.exists() {
        return Err(format!("プラグインが見つかりません: {}", plugin_id));
    }

    // セキュリティ: plugins/ ディレクトリ外へのアクセスを防止
    let canonical = plugin_dir
        .canonicalize()
        .map_err(|e| format!("パスの正規化に失敗: {}", e))?;
    let plugins_dir = app_data.join("plugins");
    let plugins_canonical = plugins_dir.canonicalize().unwrap_or(plugins_dir);
    if !canonical.starts_with(&plugins_canonical) {
        return Err("プラグインディレクトリ外のパスは削除できません".to_string());
    }

    fs::remove_dir_all(&canonical)
        .map_err(|e| format!("プラグインの削除に失敗: {}", e))?;

    Ok(())
}

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

    // plugin.json 自体もシンボリックリンクを含めて検証する
    let manifest_canonical = manifest_path
        .canonicalize()
        .map_err(|e| format!("plugin.json の正規化に失敗: {}", e))?;
    if !manifest_canonical.starts_with(&canonical) || !manifest_canonical.starts_with(&plugins_canonical) {
        return Err("プラグインディレクトリ外の plugin.json にはアクセスできません".to_string());
    }

    let manifest_content = fs::read_to_string(&manifest_canonical)
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

        let expected_normalized = expected.trim().to_lowercase();
        if actual != expected_normalized {
            return Err(format!(
                "{} のチェックサムが不一致: expected={}, actual={}",
                filename, expected, actual
            ));
        }
    }

    Ok("verified".to_string())
}
