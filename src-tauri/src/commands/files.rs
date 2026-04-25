use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;
use uuid::Uuid;

/// パスを正規化し、シンボリックリンクを解決する。
/// 存在しないファイルの場合は親ディレクトリを正規化してファイル名を結合する。
fn resolve_path(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    // ファイルが存在する場合はそのまま canonicalize
    if p.exists() {
        return p.canonicalize().map_err(|e| format!("パスの正規化に失敗: {}", e));
    }
    // 存在しない場合は親ディレクトリを正規化
    let parent = p.parent().ok_or("無効なパスです")?;
    let file_name = p.file_name().ok_or("ファイル名がありません")?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| format!("親ディレクトリの正規化に失敗: {}", e))?;
    Ok(canonical_parent.join(file_name))
}

/// プロジェクトファイルのパスを検証する（.qcut 拡張子のみ許可）
fn validate_project_path(path: &str) -> Result<PathBuf, String> {
    let resolved = resolve_path(path)?;
    match resolved.extension().and_then(|e| e.to_str()) {
        Some("qcut") => Ok(resolved),
        _ => Err("プロジェクトファイル (.qcut) のみ許可されています".to_string()),
    }
}

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
  /// 作成時刻（ミリ秒）、取得できない場合は last_modified と同値
  pub created: u64,
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

  let created = metadata
    .created()
    .ok()
    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
    .map(|d| d.as_millis() as u64)
    .unwrap_or(last_modified);

  Ok(FileInfo {
    name,
    path,
    size: metadata.len(),
    last_modified,
    created,
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

  // セキュリティ: プロジェクトファイル (.qcut) のみ保存を許可
  let validated = validate_project_path(&path)?;

  let mut file = fs::File::create(&validated)
    .map_err(|e| format!("ファイルの作成に失敗: {}", e))?;

  file.write_all(content.as_bytes())
    .map_err(|e| format!("ファイルの書き込みに失敗: {}", e))?;

  Ok(())
}

/// プロジェクトファイルを読み込む
#[tauri::command]
pub fn read_project(path: String) -> Result<String, String> {
  // セキュリティ: プロジェクトファイル (.qcut) のみ読み込みを許可
  let validated = validate_project_path(&path)?;
  fs::read_to_string(&validated)
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

/// app_data_dir と UUID 文字列から自動保存ファイルパスを組み立てる純粋関数
pub(crate) fn build_autosave_path(app_data_dir: &Path, uuid_str: &str) -> Result<String, String> {
  let filename = format!("autosave-{}.qcut", uuid_str);
  let autosave_path = app_data_dir.join(filename);
  autosave_path.to_str()
    .map(|s| s.to_string())
    .ok_or_else(|| "パスの変換に失敗".to_string())
}

/// UUIDベースの自動保存ファイルパスを生成する
#[tauri::command]
pub fn get_autosave_path(app_handle: tauri::AppHandle) -> Result<String, String> {
  let app_data = app_handle.path().app_data_dir()
    .map_err(|e| format!("app_data_dir の取得に失敗: {}", e))?;
  build_autosave_path(&app_data, &Uuid::new_v4().to_string())
}

/// 指定パスのファイルを削除する
#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
  // セキュリティ: パスを正規化してシンボリックリンク攻撃を防止
  let resolved = resolve_path(&path)?;

  // .qcut ファイルのみ削除を許可
  match resolved.extension().and_then(|e| e.to_str()) {
    Some("qcut") => {},
    _ => return Err("削除できるのはプロジェクトファイル (.qcut) のみです".to_string()),
  }

  if resolved.exists() {
    fs::remove_file(&resolved)
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn build_autosave_path_は同じ引数で同じ結果を返す() {
        let dir = PathBuf::from("/tmp/app_data");
        let uuid = "550e8400-e29b-41d4-a716-446655440000";

        let result1 = build_autosave_path(&dir, uuid).unwrap();
        let result2 = build_autosave_path(&dir, uuid).unwrap();

        assert_eq!(result1, result2);
    }

    #[test]
    fn build_autosave_path_はuuidをファイル名に含む() {
        let dir = PathBuf::from("/tmp/app_data");
        let uuid = "test-uuid-1234";

        let result = build_autosave_path(&dir, uuid).unwrap();

        assert!(result.contains("autosave-test-uuid-1234.qcut"));
        assert!(result.starts_with("/tmp/app_data"));
    }

    #[test]
    fn build_autosave_path_は異なるuuidで異なるパスを返す() {
        let dir = PathBuf::from("/tmp/app_data");

        let result1 = build_autosave_path(&dir, "uuid-a").unwrap();
        let result2 = build_autosave_path(&dir, "uuid-b").unwrap();

        assert_ne!(result1, result2);
    }
}
