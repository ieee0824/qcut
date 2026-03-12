use crate::commands::ffmpeg_path::ffmpeg_path;
use serde::{Deserialize, Serialize};
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
    clips: Vec<HlsClip>,
) -> Result<HlsResult, String> {
    if clips.is_empty() {
        return Err("No clips provided".to_string());
    }

    // 出力先ディレクトリを app_data_dir 配下に作成
    let output_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("preview_hls");
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    // 古いセグメントを削除
    if let Ok(entries) = std::fs::read_dir(&output_dir) {
        for entry in entries.flatten() {
            let _ = std::fs::remove_file(entry.path());
        }
    }

    // FFmpeg concat demuxer 用のリストファイルを生成
    // clips はタイムライン順にソート済みであることを前提とする
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
        return Err("No valid clips to process".to_string());
    }

    std::fs::write(&concat_path, &concat_content).map_err(|e| e.to_string())?;

    let playlist_path = output_dir.join("preview.m3u8");
    let segment_pattern = output_dir.join("seg%03d.ts");

    let status = std::process::Command::new(ffmpeg_path())
        .args([
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_path.to_str().ok_or("invalid concat path")?,
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-hls_time",
            "2",
            "-hls_list_size",
            "0",
            "-hls_segment_filename",
            segment_pattern.to_str().ok_or("invalid segment path")?,
            "-y",
            playlist_path.to_str().ok_or("invalid playlist path")?,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !status.success() {
        return Err(
            "FFmpeg HLS generation failed. Clips may use incompatible codecs.".to_string(),
        );
    }

    Ok(HlsResult {
        playlist_path: playlist_path
            .to_str()
            .ok_or("Invalid output path")?
            .to_string(),
        segments,
    })
}
