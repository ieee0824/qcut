use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::Path;

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
