use serde::{Deserialize, Serialize};
use std::fs;
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
/// # 注意
/// 現在は雛形です。実装時に Tauri の dialog プラグインで実装
#[tauri::command]
pub fn open_file_dialog() -> Result<Option<String>, String> {
  // TODO: Tauri dialog プラグインで実装
  // let result = tauri::api::dialog::FileDialogBuilder::new()
  //   .add_filter("ビデオファイル", &["mp4", "mov", "avi", "mkv"])
  //   .add_filter("すべてのファイル", &["*"])
  //   .pick_file();
  Ok(None)
}
