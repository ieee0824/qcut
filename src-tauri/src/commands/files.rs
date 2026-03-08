use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::Path;
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
  /// ファイル名
  pub name: String,
  /// ファイルパス
  pub path: String,
  /// ファイルサイズ（バイト）
  pub size: u64,
  /// 最終更新時刻（ミリ秒）
  pub last_modified: u64,
}

/// ファイル情報を取得
#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
  let file_path = Path::new(&path);

  let metadata = fs::metadata(file_path)
    .map_err(|e| format!("ファイルの取得に失敗: {}", e))?;

  let name = file_path
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("unknown")
    .to_string();

  let last_modified = metadata
    .modified()
    .map_err(|e| format!("更新時刻の取得に失敗: {}", e))?
    .duration_since(std::time::UNIX_EPOCH)
    .map_err(|e| format!("時刻計算エラー: {}", e))?
    .as_millis() as u64;

  Ok(FileInfo {
    name,
    path,
    size: metadata.len(),
    last_modified,
  })
}

/// ファイルダイアログを開く（ビデオファイル選択）
///
/// 注意: フロントエンド側で dialog API を直接使用するため、このコマンドは現在使用されていません。
#[tauri::command]
pub fn open_file_dialog() -> Result<Option<String>, String> {
  Ok(None)
}

/// プロジェクトファイルを保存する
#[tauri::command]
pub fn save_project(path: String, content: String) -> Result<(), String> {
  let file_path = Path::new(&path);

  if let Some(parent) = file_path.parent() {
    fs::create_dir_all(parent)
      .map_err(|e| format!("ディレクトリの作成に失敗: {}", e))?;
  }

  let mut file = fs::File::create(file_path)
    .map_err(|e| format!("ファイルの作成に失敗: {}", e))?;

  file.write_all(content.as_bytes())
    .map_err(|e| format!("ファイルの書き込みに失敗: {}", e))?;

  Ok(())
}

/// プロジェクトファイルを読み込む
#[tauri::command]
pub fn read_project(path: String) -> Result<String, String> {
  fs::read_to_string(&path)
    .map_err(|e| format!("ファイルの読み込みに失敗: {}", e))
}

/// 最近のプロジェクト一覧を読み込む
#[tauri::command]
pub fn read_recent_projects(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data = app_handle.path().app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
    let path = app_data.join("recent_projects.json");
    if !path.exists() {
        return Ok("[]".to_string());
    }
    fs::read_to_string(&path)
        .map_err(|e| format!("ファイルの読み込みに失敗: {}", e))
}

/// 最近のプロジェクト一覧を書き込む
#[tauri::command]
pub fn write_recent_projects(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    let app_data = app_handle.path().app_data_dir()
        .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
    let path = app_data.join("recent_projects.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("ディレクトリの作成に失敗: {}", e))?;
    }
    fs::write(&path, content)
        .map_err(|e| format!("ファイルの書き込みに失敗: {}", e))
}

/// UUIDベースの自動保存ファイルパスを生成する
#[tauri::command]
pub fn get_autosave_path(app_handle: tauri::AppHandle) -> Result<String, String> {
  let app_data = app_handle.path().app_data_dir()
    .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
  let filename = format!("autosave-{}.qcut", Uuid::new_v4());
  let autosave_path = app_data.join(filename);
  autosave_path.to_str()
    .map(|s| s.to_string())
    .ok_or_else(|| "パスの変換に失敗".to_string())
}

/// 指定パスのファイルを削除する
#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
  let file_path = Path::new(&path);
  if file_path.exists() {
    fs::remove_file(file_path)
      .map_err(|e| format!("ファイルの削除に失敗: {}", e))?;
  }
  Ok(())
}

/// app_data_dir 内の全自動保存ファイルのパス一覧を返す
#[tauri::command]
pub fn list_autosaves(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
  let app_data = app_handle.path().app_data_dir()
    .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
  if !app_data.exists() {
    return Ok(vec![]);
  }
  let entries = fs::read_dir(&app_data)
    .map_err(|e| format!("ディレクトリの読み取りに失敗: {}", e))?;
  let mut autosaves = vec![];
  for entry in entries {
    if let Ok(entry) = entry {
      let name = entry.file_name().to_string_lossy().to_string();
      if name.starts_with("autosave-") && name.ends_with(".qcut") {
        if let Some(path_str) = entry.path().to_str() {
          autosaves.push(path_str.to_string());
        }
      }
    }
  }
  Ok(autosaves)
}
