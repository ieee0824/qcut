use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use super::ffmpeg_builder::{build_ffmpeg_args, collect_audio_clips, collect_text_clips, collect_video_clips};
use super::progress_parser::ProgressParser;

// --- データ構造 ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ClipEffects {
    pub brightness: f64,
    pub contrast: f64,
    pub saturation: f64,
    #[serde(default)]
    pub color_temperature: f64,
    #[serde(default)]
    pub hue: f64,
    #[serde(default)]
    pub hsl_red_sat: f64,
    #[serde(default)]
    pub hsl_yellow_sat: f64,
    #[serde(default)]
    pub hsl_green_sat: f64,
    #[serde(default)]
    pub hsl_cyan_sat: f64,
    #[serde(default)]
    pub hsl_blue_sat: f64,
    #[serde(default)]
    pub hsl_magenta_sat: f64,
    #[serde(default)]
    pub lift_r: f64,
    #[serde(default)]
    pub lift_g: f64,
    #[serde(default)]
    pub lift_b: f64,
    #[serde(default)]
    pub gamma_r: f64,
    #[serde(default)]
    pub gamma_g: f64,
    #[serde(default)]
    pub gamma_b: f64,
    #[serde(default)]
    pub gain_r: f64,
    #[serde(default)]
    pub gain_g: f64,
    #[serde(default)]
    pub gain_b: f64,
    pub rotation: f64,
    pub scale_x: f64,
    pub scale_y: f64,
    pub position_x: f64,
    pub position_y: f64,
    #[serde(default)]
    pub fade_in: f64,
    #[serde(default)]
    pub fade_out: f64,
    #[serde(default = "default_volume")]
    pub volume: f64,
    #[serde(default)]
    pub eq_low: f64,
    #[serde(default)]
    pub eq_mid: f64,
    #[serde(default)]
    pub eq_high: f64,
    #[serde(default)]
    pub denoise_amount: f64,
    #[serde(default)]
    pub highpass_freq: f64,
    #[serde(default)]
    pub echo_delay: f64,
    #[serde(default = "default_echo_decay")]
    pub echo_decay: f64,
    #[serde(default)]
    pub reverb_amount: f64,
}

fn default_echo_decay() -> f64 {
    0.3
}

fn default_volume() -> f64 {
    1.0
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct TextProperties {
    pub text: String,
    pub font_size: u32,
    pub font_color: String,
    pub font_family: String,
    pub bold: bool,
    pub italic: bool,
    pub text_align: String,
    pub position_x: f64,
    pub position_y: f64,
    pub opacity: f64,
    pub background_color: String,
    pub animation: String,
    pub animation_duration: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct TimecodeOverlay {
    pub enabled: bool,
    pub start_date_time: f64,  // epoch milliseconds
    pub format: String,        // "ymd-hm" | "md-hm" | "hms" | "hm"
    #[serde(default = "default_timecode_position_x")]
    pub position_x: f64,
    #[serde(default = "default_timecode_position_y")]
    pub position_y: f64,
    #[serde(default = "default_timecode_font_size")]
    pub font_size: u32,
    #[serde(default = "default_timecode_font_color")]
    pub font_color: String,
}

fn default_timecode_position_x() -> f64 { 50.0 }
fn default_timecode_position_y() -> f64 { 10.0 }
fn default_timecode_font_size() -> u32 { 24 }
fn default_timecode_font_color() -> String { "#ffffff".to_string() }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ExportTransition {
    #[serde(rename = "type")]
    pub transition_type: String,
    pub duration: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ExportClip {
    pub id: String,
    pub name: String,
    pub start_time: f64,
    pub duration: f64,
    pub file_path: String,
    pub source_start_time: f64,
    pub source_end_time: f64,
    pub effects: Option<ClipEffects>,
    pub text_properties: Option<TextProperties>,
    pub transition: Option<ExportTransition>,
    pub timecode_overlay: Option<TimecodeOverlay>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ExportTrack {
    pub id: String,
    #[serde(rename = "type")]
    pub track_type: String,
    pub name: String,
    pub clips: Vec<ExportClip>,
    #[serde(default = "default_volume")]
    pub volume: f64,
    #[serde(default)]
    pub mute: bool,
    #[serde(default)]
    pub solo: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSettings {
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub bitrate: String,
    pub fps: u32,
    pub output_path: String,
    pub tracks: Vec<ExportTrack>,
    pub total_duration: f64,
    pub preview_height: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub progress: f64,
    pub current_time: f64,
    pub status: String,
    pub message: String,
}

pub struct ExportState {
    pub cancel_flag: Arc<AtomicBool>,
}

// --- コマンド ---

#[tauri::command]
pub fn check_ffmpeg() -> Result<String, String> {
    let output = Command::new(super::ffmpeg_path::ffmpeg_path())
        .arg("-version")
        .output()
        .map_err(|_| {
            "FFmpegがインストールされていません。FFmpegをインストールしてください。".to_string()
        })?;

    if !output.status.success() {
        return Err("FFmpegの実行に失敗しました".to_string());
    }

    let version = String::from_utf8_lossy(&output.stdout);
    let first_line = version.lines().next().unwrap_or("unknown").to_string();
    Ok(first_line)
}

#[tauri::command]
pub async fn export_video(
    app_handle: AppHandle,
    settings: ExportSettings,
    state: tauri::State<'_, ExportState>,
) -> Result<(), String> {
    // キャンセルフラグをリセット
    state.cancel_flag.store(false, Ordering::SeqCst);
    let cancel_flag = state.cancel_flag.clone();

    // バリデーション
    let video_clips = collect_video_clips(&settings.tracks)?;
    if video_clips.is_empty() {
        return Err("タイムラインにクリップがありません".to_string());
    }

    let audio_track_clips = collect_audio_clips(&settings.tracks);
    let text_clips = collect_text_clips(&settings.tracks);

    // ソースファイルの存在チェック
    for vtc in &video_clips {
        if !vtc.clip.file_path.is_empty() && !Path::new(&vtc.clip.file_path).exists() {
            return Err(format!(
                "ソースファイルが見つかりません: {}",
                vtc.clip.file_path
            ));
        }
    }
    for atc in &audio_track_clips {
        if !atc.clip.file_path.is_empty() && !Path::new(&atc.clip.file_path).exists() {
            return Err(format!(
                "ソースファイルが見つかりません: {}",
                atc.clip.file_path
            ));
        }
    }

    // FFmpegコマンドを構築
    let build_result = build_ffmpeg_args(&settings, &video_clips, &text_clips, &audio_track_clips)?;
    let args = build_result.args;
    let temp_files = build_result.temp_files;
    log::info!("FFmpeg command: ffmpeg {}", args.join(" "));

    // FFmpegをサブプロセスとして起動
    let mut child = Command::new(super::ffmpeg_path::ffmpeg_path())
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("FFmpegの起動に失敗しました: {}", e))?;

    // stderrをドレインするスレッド（バッファ詰まり防止 + ログ出力）
    let stderr = child.stderr.take();
    let stderr_handle = std::thread::spawn(move || {
        let mut output = String::new();
        if let Some(stderr) = stderr {
            use std::io::Read;
            let mut reader = stderr;
            let _ = reader.read_to_string(&mut output);
        }
        output
    });

    // totalDuration が 0 または未設定の場合、クリップから出力時間を自動計算
    let total_duration = if settings.total_duration > 0.0 {
        settings.total_duration
    } else {
        video_clips
            .iter()
            .map(|c| c.clip.start_time + c.clip.duration)
            .fold(0.0_f64, f64::max)
    };
    log::info!("Export total_duration: {:.3}s", total_duration);

    // 進捗パーサーで stdout を監視
    let stdout = child.stdout.take().ok_or("stdoutの取得に失敗")?;
    let parser = ProgressParser::new(total_duration);
    parser.run(&app_handle, stdout, &cancel_flag);

    // キャンセルされた場合はプロセスを kill
    if cancel_flag.load(Ordering::SeqCst) {
        let _ = child.kill();
    }

    // プロセスの完了を待つ
    let status = child
        .wait()
        .map_err(|e| format!("FFmpegの終了待ちに失敗: {}", e))?;

    // stderrの内容をログに出力
    let stderr_output = stderr_handle.join().unwrap_or_default();
    if !stderr_output.is_empty() {
        log::info!("FFmpeg stderr:\n{}", stderr_output);
    }

    // 一時ファイル（LUT等）のクリーンアップ
    for path in &temp_files {
        if let Err(e) = std::fs::remove_file(path) {
            log::warn!("一時ファイルの削除に失敗: {:?} - {}", path, e);
        }
    }

    // エンコード完了後のキャンセルフラグチェック:
    // キャンセルが押されていてもプロセスが正常完了していれば complete として扱う
    if status.success() {
        let _ = app_handle.emit(
            "export-progress",
            ExportProgress {
                progress: 1.0,
                current_time: total_duration,
                status: "complete".to_string(),
                message: "エクスポート完了".to_string(),
            },
        );
        Ok(())
    } else if cancel_flag.load(Ordering::SeqCst) {
        let _ = app_handle.emit(
            "export-progress",
            ExportProgress {
                progress: 0.0,
                current_time: 0.0,
                status: "cancelled".to_string(),
                message: "エクスポートがキャンセルされました".to_string(),
            },
        );
        Ok(())
    } else {
        let _ = app_handle.emit(
            "export-progress",
            ExportProgress {
                progress: 0.0,
                current_time: 0.0,
                status: "error".to_string(),
                message: "FFmpegがエラーで終了しました".to_string(),
            },
        );
        Err("FFmpegがエラーで終了しました".to_string())
    }
}

#[tauri::command]
pub fn cancel_export(state: tauri::State<'_, ExportState>) -> Result<(), String> {
    state.cancel_flag.store(true, Ordering::SeqCst);
    Ok(())
}
