use crate::commands::ffmpeg_path::ffmpeg_path;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Stdio;
use tauri::Manager;

#[derive(Deserialize)]
pub struct HlsClip {
    pub file_path: String,
    pub source_start_time: f64,
    pub source_end_time: f64,
    pub timeline_start: f64,
}

/// HLS 上の時刻区間とタイムライン上の時刻区間の対応
#[derive(Serialize)]
pub struct HlsSegment {
    pub hls_start: f64,
    pub timeline_start: f64,
    pub duration: f64,
}

#[derive(Serialize)]
pub struct HlsResult {
    pub playlist_path: String,
    pub segments: Vec<HlsSegment>,
}

#[tauri::command]
pub async fn generate_preview_hls(
    app: tauri::AppHandle,
    mut clips: Vec<HlsClip>,
) -> Result<HlsResult, String> {
    if clips.is_empty() {
        return Err("クリップが指定されていません".to_string());
    }

    // timeline_start で昇順ソート（呼び出し元のソート順に依存しない）
    clips.sort_by(|a, b| a.timeline_start.partial_cmp(&b.timeline_start).unwrap_or(std::cmp::Ordering::Equal));

    // ファイルパスのバリデーション（改行文字を含む場合は concat 行注入のおそれがあるため拒否）
    for clip in &clips {
        if clip.file_path.contains('\n') || clip.file_path.contains('\r') {
            return Err(format!(
                "ファイルパスに無効な文字が含まれています: {}",
                clip.file_path
            ));
        }
        if !Path::new(&clip.file_path).exists() {
            return Err(format!(
                "ファイルが見つかりません: {}",
                clip.file_path
            ));
        }
    }

    // 出力先ディレクトリを app_data_dir 配下に作成（入れ替え方式でクリーン）
    let output_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("preview_hls");
    if output_dir.exists() {
        std::fs::remove_dir_all(&output_dir)
            .map_err(|e| format!("出力ディレクトリの削除に失敗しました: {}", e))?;
    }
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("出力ディレクトリの作成に失敗しました: {}", e))?;

    // FFmpeg concat demuxer 用のリストファイルを生成
    let concat_path = output_dir.join("concat.txt");
    let mut concat_content = String::new();
    let mut segments: Vec<HlsSegment> = Vec::new();
    let mut hls_cursor = 0.0_f64;

    for clip in &clips {
        let duration = clip.source_end_time - clip.source_start_time;
        if duration <= 0.0 {
            continue;
        }
        // シングルクォートをエスケープ（concat demuxer の file 行）
        let escaped = clip.file_path.replace('\'', "'\\''");
        concat_content.push_str(&format!("file '{}'\n", escaped));
        concat_content.push_str(&format!("inpoint {}\n", clip.source_start_time));
        concat_content.push_str(&format!("outpoint {}\n", clip.source_end_time));

        segments.push(HlsSegment {
            hls_start: hls_cursor,
            timeline_start: clip.timeline_start,
            duration,
        });
        hls_cursor += duration;
    }

    if segments.is_empty() {
        return Err("有効なクリップがありません".to_string());
    }

    std::fs::write(&concat_path, &concat_content)
        .map_err(|e| format!("concat ファイルの書き込みに失敗しました: {}", e))?;

    let playlist_path = output_dir.join("preview.m3u8");
    let segment_pattern = output_dir.join("seg%03d.ts");

    // FFmpeg の実行（ブロッキング操作を spawn_blocking でオフロード）
    let ffmpeg_exe = ffmpeg_path().to_owned();
    let concat_path_str = concat_path
        .to_str()
        .ok_or("concat パスが無効です")?
        .to_owned();
    let segment_pattern_str = segment_pattern
        .to_str()
        .ok_or("セグメントパスが無効です")?
        .to_owned();
    let playlist_path_str = playlist_path
        .to_str()
        .ok_or("プレイリストパスが無効です")?
        .to_owned();

    let output = tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new(&ffmpeg_exe)
            .args([
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                &concat_path_str,
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-hls_time",
                "2",
                "-hls_list_size",
                "0",
                "-hls_segment_filename",
                &segment_pattern_str,
                "-y",
                &playlist_path_str,
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
    })
    .await
    .map_err(|e| format!("FFmpeg タスクの起動に失敗しました: {}", e))?
    .map_err(|e| format!("FFmpeg の実行に失敗しました: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "FFmpeg HLS 生成に失敗しました（コーデックが非互換の可能性があります）: {}",
            stderr.lines().last().unwrap_or("詳細不明")
        ));
    }

    let result_path = playlist_path
        .to_str()
        .ok_or("プレイリストパスが無効です")?
        .to_owned();

    Ok(HlsResult {
        playlist_path: result_path,
        segments,
    })
}
