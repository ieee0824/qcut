use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfo {
  /// ファイルパス
  pub path: String,
  /// 動画の長さ（秒）
  pub duration: f64,
  /// 幅（ピクセル）
  pub width: u32,
  /// 高さ（ピクセル）
  pub height: u32,
  /// フレームレート
  pub fps: f64,
}

/// 動画ファイルの情報を取得
/// 
/// # 注意
/// 現在は雛形の実装です。実装時には FFmpeg/GStreamer を使用して実際の情報取得を行います。
#[tauri::command]
pub fn get_video_info(path: String) -> Result<VideoInfo, String> {
  // TODO: FFmpeg または GStreamer を使用して実装
  // 現在は仮のレスポンスを返す
  Ok(VideoInfo {
    path,
    duration: 120.0,
    width: 1920,
    height: 1080,
    fps: 30.0,
  })
}
