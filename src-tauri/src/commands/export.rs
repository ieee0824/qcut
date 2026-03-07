use regex::Regex;
use serde::{Deserialize, Serialize};
use std::io::BufReader;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

// --- フォーマット定義テーブル ---

struct FormatProfile {
    key: &'static str,
    video_codec: &'static str,
    video_preset: Option<&'static str>,
    audio_codec: &'static str,
    audio_bitrate: &'static str,
    container: Option<&'static str>,
    extra_flags: &'static [&'static str],
}

const FORMAT_PROFILES: &[FormatProfile] = &[
    FormatProfile {
        key: "mp4",
        video_codec: "libx264",
        video_preset: Some("medium"),
        audio_codec: "aac",
        audio_bitrate: "128k",
        container: None,
        extra_flags: &["-movflags", "+faststart"],
    },
    FormatProfile {
        key: "mov",
        video_codec: "libx264",
        video_preset: Some("medium"),
        audio_codec: "aac",
        audio_bitrate: "128k",
        container: Some("mov"),
        extra_flags: &[],
    },
    FormatProfile {
        key: "avi",
        video_codec: "libx264",
        video_preset: Some("medium"),
        audio_codec: "mp3",
        audio_bitrate: "192k",
        container: Some("avi"),
        extra_flags: &[],
    },
    FormatProfile {
        key: "webm",
        video_codec: "libvpx-vp9",
        video_preset: None,
        audio_codec: "libopus",
        audio_bitrate: "128k",
        container: None,
        extra_flags: &[],
    },
];

fn get_format_profile(key: &str) -> &'static FormatProfile {
    FORMAT_PROFILES
        .iter()
        .find(|p| p.key == key)
        .unwrap_or(&FORMAT_PROFILES[0]) // mp4 をデフォルトにフォールバック
}

// --- データ構造 ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ClipEffects {
    pub brightness: f64,
    pub contrast: f64,
    pub saturation: f64,
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
    let output = Command::new("ffmpeg")
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

    // ソースファイルの存在チェック
    for clip in &video_clips {
        if !clip.file_path.is_empty() && !Path::new(&clip.file_path).exists() {
            return Err(format!(
                "ソースファイルが見つかりません: {}",
                clip.file_path
            ));
        }
    }

    let text_clips = collect_text_clips(&settings.tracks);

    // FFmpegコマンドを構築
    let args = build_ffmpeg_args(&settings, &video_clips, &text_clips)?;
    log::info!("FFmpeg command: ffmpeg {}", args.join(" "));

    // FFmpegをサブプロセスとして起動
    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("FFmpegの起動に失敗しました: {}", e))?;

    // stderrをドレインするスレッド（バッファ詰まり防止）
    let stderr = child.stderr.take();
    std::thread::spawn(move || {
        if let Some(stderr) = stderr {
            use std::io::Read;
            let mut buf = [0u8; 4096];
            let mut reader = stderr;
            while reader.read(&mut buf).unwrap_or(0) > 0 {}
        }
    });

    let stdout = child.stdout.take().ok_or("stdoutの取得に失敗")?;
    let reader = BufReader::new(stdout);
    let time_regex = Regex::new(r"out_time_ms=(\d+)").unwrap();
    // totalDuration が 0 または未設定の場合、クリップから出力時間を自動計算
    let total_duration = if settings.total_duration > 0.0 {
        settings.total_duration
    } else {
        video_clips
            .iter()
            .map(|c| c.start_time + c.duration)
            .fold(0.0_f64, f64::max)
    };
    log::info!("Export total_duration: {:.3}s", total_duration);

    // stdoutを別スレッドで読み取り、チャネル経由で受信
    // -progress pipe:1 の出力はstdoutに key=value 形式で行ごとに出力される
    let (tx, rx) = std::sync::mpsc::channel::<String>();
    std::thread::spawn(move || {
        use std::io::BufRead;
        for line in reader.lines() {
            match line {
                Ok(l) => {
                    if tx.send(l).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    // メインループ: チャネルからタイムアウト付きで受信し、キャンセルフラグを定期チェック
    loop {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = child.kill();
            break;
        }

        match rx.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(line) => {
                if let Some(caps) = time_regex.captures(&line) {
                    let microseconds: f64 = caps[1].parse().unwrap_or(0.0);
                    let current_time = microseconds / 1_000_000.0;
                    let progress = if total_duration > 0.0 {
                        (current_time / total_duration).min(1.0)
                    } else {
                        0.0
                    };

                    let _ = app_handle.emit(
                        "export-progress",
                        ExportProgress {
                            progress,
                            current_time,
                            status: "encoding".to_string(),
                            message: format!("エンコード中... {:.1}%", progress * 100.0),
                        },
                    );
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                // タイムアウト → ループ先頭でキャンセルフラグを再チェック
                continue;
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                // stderrが閉じた = FFmpegプロセス終了
                break;
            }
        }
    }

    // プロセスの完了を待つ
    let status = child
        .wait()
        .map_err(|e| format!("FFmpegの終了待ちに失敗: {}", e))?;

    // エンコード完了後のキャンセルフラグチェック:
    // キャンセルが押されていてもプロセスが正常完了していれば complete として扱う
    if status.success() {
        // cancel_flag が立っていても、実際にはエンコード完了しているので complete を送信
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
        // プロセスが異常終了 + キャンセルフラグが立っている → キャンセルとして扱う
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

// --- ヘルパー関数 ---

fn collect_video_clips(tracks: &[ExportTrack]) -> Result<Vec<&ExportClip>, String> {
    let mut clips: Vec<&ExportClip> = tracks
        .iter()
        .filter(|t| t.track_type == "video")
        .flat_map(|t| &t.clips)
        .collect();
    clips.sort_by(|a, b| {
        a.start_time
            .partial_cmp(&b.start_time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    Ok(clips)
}

fn collect_text_clips(tracks: &[ExportTrack]) -> Vec<&ExportClip> {
    let mut clips: Vec<&ExportClip> = tracks
        .iter()
        .filter(|t| t.track_type == "text")
        .flat_map(|t| &t.clips)
        .collect();
    clips.sort_by(|a, b| {
        a.start_time
            .partial_cmp(&b.start_time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    clips
}

fn transition_to_xfade(t: &str) -> &str {
    match t {
        "crossfade" => "fade",
        "dissolve" => "dissolve",
        "wipe-left" => "wipeleft",
        "wipe-right" => "wiperight",
        "wipe-up" => "wipeup",
        "wipe-down" => "wipedown",
        _ => "fade",
    }
}

fn build_ffmpeg_args(
    settings: &ExportSettings,
    video_clips: &[&ExportClip],
    text_clips: &[&ExportClip],
) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = vec!["-y".into(), "-progress".into(), "pipe:1".into()];
    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut input_args: Vec<String> = Vec::new();
    let mut input_index: usize = 0;

    // 入力ファイルの重複排除とインデックスマッピング
    for clip in video_clips {
        if !clip.file_path.is_empty() && !input_map.contains_key(&clip.file_path) {
            input_map.insert(clip.file_path.clone(), input_index);
            input_args.push("-i".into());
            input_args.push(clip.file_path.clone());
            input_index += 1;
        }
    }

    // 入力がない場合はエラー
    if input_map.is_empty() {
        return Err("有効な動画ファイルがありません".to_string());
    }

    args.extend(input_args);

    let w = settings.width;
    let h = settings.height;

    // 各動画クリップのフィルターチェーン構築
    // セグメント情報: (v_label, a_label, duration, transition)
    // transition: 前セグメントとの間のトランジション (xfade名, duration)
    struct SegmentInfo {
        v_label: String,
        a_label: String,
        duration: f64,
        transition: Option<(String, f64)>,
    }
    let mut segments: Vec<SegmentInfo> = Vec::new();
    let mut current_time = 0.0;

    for (i, clip) in video_clips.iter().enumerate() {
        // クリップ前のギャップを黒フレームで埋める
        if clip.start_time > current_time + 0.01 {
            let gap_duration = clip.start_time - current_time;
            let gap_v_label = format!("gapv{}", i);
            let gap_a_label = format!("gapa{}", i);
            filter_parts.push(format!(
                "color=black:s={}x{}:d={:.3}:r={},format=yuv420p[{}]",
                w, h, gap_duration, settings.fps, gap_v_label
            ));
            filter_parts.push(format!(
                "anullsrc=r=44100:cl=stereo,atrim=0:{:.3}[{}]",
                gap_duration, gap_a_label
            ));
            segments.push(SegmentInfo {
                v_label: gap_v_label,
                a_label: gap_a_label,
                duration: gap_duration,
                transition: None,
            });
        }

        let idx = input_map
            .get(&clip.file_path)
            .ok_or_else(|| format!("入力インデックスが見つかりません: {}", clip.file_path))?;

        let v_label = format!("v{}", i);
        let a_label = format!("a{}", i);

        // 映像フィルターチェーン
        let mut vfilter = format!(
            "[{}:v]trim=start={:.3}:end={:.3},setpts=PTS-STARTPTS",
            idx, clip.source_start_time, clip.source_end_time
        );

        // エフェクト適用
        if let Some(ref effects) = clip.effects {
            let brightness = effects.brightness - 1.0;
            if (brightness).abs() > 0.01
                || (effects.contrast - 1.0).abs() > 0.01
                || (effects.saturation - 1.0).abs() > 0.01
            {
                vfilter.push_str(&format!(
                    ",eq=brightness={:.2}:contrast={:.2}:saturation={:.2}",
                    brightness, effects.contrast, effects.saturation
                ));
            }

            // スケール
            if (effects.scale_x - 1.0).abs() > 0.01 || (effects.scale_y - 1.0).abs() > 0.01 {
                vfilter.push_str(&format!(
                    ",scale=iw*{:.2}:ih*{:.2}",
                    effects.scale_x, effects.scale_y
                ));
            }

            // 回転
            if effects.rotation.abs() > 0.1 {
                let radians = effects.rotation * std::f64::consts::PI / 180.0;
                vfilter.push_str(&format!(
                    ",rotate={:.4}:c=black:ow=rotw({:.4}):oh=roth({:.4})",
                    radians, radians, radians
                ));
            }

            // フェードイン/フェードアウト
            let seg_duration = clip.source_end_time - clip.source_start_time;
            if effects.fade_in > 0.01 {
                vfilter.push_str(&format!(",fade=t=in:st=0:d={:.3}", effects.fade_in));
            }
            if effects.fade_out > 0.01 {
                let fade_out_start = (seg_duration - effects.fade_out).max(0.0);
                vfilter.push_str(&format!(",fade=t=out:st={:.3}:d={:.3}", fade_out_start, effects.fade_out));
            }
        }

        // 最終的にターゲット解像度にスケール + パディング
        vfilter.push_str(&format!(
            ",scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
            w, h, w, h
        ));

        vfilter.push_str(&format!("[{}]", v_label));
        filter_parts.push(vfilter);

        // 音声フィルターチェーン
        let audio_duration = clip.source_end_time - clip.source_start_time;
        let mut afilter = format!(
            "[{}:a]atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS",
            idx, clip.source_start_time, clip.source_end_time
        );
        if let Some(ref effects) = clip.effects {
            if (effects.volume - 1.0).abs() > 0.01 {
                afilter.push_str(&format!(",volume={:.2}", effects.volume));
            }
            if effects.fade_in > 0.01 {
                afilter.push_str(&format!(",afade=t=in:st=0:d={:.3}", effects.fade_in));
            }
            if effects.fade_out > 0.01 {
                let fade_out_start = (audio_duration - effects.fade_out).max(0.0);
                afilter.push_str(&format!(",afade=t=out:st={:.3}:d={:.3}", fade_out_start, effects.fade_out));
            }
            // イコライザー (3バンド: Low 100Hz shelf, Mid 1kHz peaking, High 10kHz shelf)
            if effects.eq_low.abs() > 0.1 || effects.eq_mid.abs() > 0.1 || effects.eq_high.abs() > 0.1 {
                let mut eq_parts: Vec<String> = Vec::new();
                if effects.eq_low.abs() > 0.1 {
                    eq_parts.push(format!("equalizer=f=100:t=h:w=200:g={:.1}", effects.eq_low));
                }
                if effects.eq_mid.abs() > 0.1 {
                    eq_parts.push(format!("equalizer=f=1000:t=q:w=1.0:g={:.1}", effects.eq_mid));
                }
                if effects.eq_high.abs() > 0.1 {
                    eq_parts.push(format!("equalizer=f=10000:t=h:w=200:g={:.1}", effects.eq_high));
                }
                afilter.push_str(&format!(",{}", eq_parts.join(",")));
            }
        }
        afilter.push_str(&format!("[{}]", a_label));
        filter_parts.push(afilter);

        // トランジション情報
        let clip_duration = clip.source_end_time - clip.source_start_time;
        let trans_info = clip.transition.as_ref().map(|t| {
            (transition_to_xfade(&t.transition_type).to_string(), t.duration)
        });

        segments.push(SegmentInfo {
            v_label,
            a_label,
            duration: clip_duration,
            transition: trans_info,
        });
        current_time = clip.start_time + clip.duration;
    }

    // タイムライン末尾のギャップ（必要な場合）
    if settings.total_duration > current_time + 0.01 {
        let gap_duration = settings.total_duration - current_time;
        let gap_v_label = "gapend_v".to_string();
        let gap_a_label = "gapend_a".to_string();
        filter_parts.push(format!(
            "color=black:s={}x{}:d={:.3}:r={},format=yuv420p[{}]",
            w, h, gap_duration, settings.fps, gap_v_label
        ));
        filter_parts.push(format!(
            "anullsrc=r=44100:cl=stereo,atrim=0:{:.3}[{}]",
            gap_duration, gap_a_label
        ));
        segments.push(SegmentInfo {
            v_label: gap_v_label,
            a_label: gap_a_label,
            duration: gap_duration,
            transition: None,
        });
    }

    // セグメント結合: xfade + concat
    // トランジション付きの隣接セグメントは xfade で結合し、残りは concat で結合
    struct CombinedSegment {
        v_label: String,
        a_label: String,
        duration: f64,
    }
    let mut combined: Vec<CombinedSegment> = Vec::new();
    let mut xfade_counter = 0;

    for seg in segments.iter() {
        if let Some((ref xfade_name, trans_dur)) = seg.transition {
            if let Some(prev) = combined.last_mut() {
                // xfade で前セグメントと結合
                let offset = prev.duration - trans_dur;
                let offset = if offset < 0.0 { 0.0 } else { offset };

                let new_v_label = format!("xv{}", xfade_counter);
                let new_a_label = format!("xa{}", xfade_counter);
                xfade_counter += 1;

                // 映像: xfade
                filter_parts.push(format!(
                    "[{}][{}]xfade=transition={}:duration={:.3}:offset={:.3}[{}]",
                    prev.v_label, seg.v_label, xfade_name, trans_dur, offset, new_v_label
                ));

                // 音声: acrossfade
                filter_parts.push(format!(
                    "[{}][{}]acrossfade=d={:.3}:c1=tri:c2=tri[{}]",
                    prev.a_label, seg.a_label, trans_dur, new_a_label
                ));

                // 結合後の時間 = 前の時間 + 現セグメント時間 - トランジション時間
                prev.v_label = new_v_label;
                prev.a_label = new_a_label;
                prev.duration = prev.duration + seg.duration - trans_dur;
                continue;
            }
        }
        // トランジションなし or 前セグメントなし: そのまま追加
        combined.push(CombinedSegment {
            v_label: seg.v_label.clone(),
            a_label: seg.a_label.clone(),
            duration: seg.duration,
        });
    }

    let mut final_v_label = "outv".to_string();
    let final_a_label = "outa".to_string();
    let n = combined.len();

    if n == 1 {
        // 1セグメントの場合はconcatを省略
        filter_parts.push(format!("[{}]copy[{}]", combined[0].v_label, final_v_label));
        filter_parts.push(format!("[{}]acopy[{}]", combined[0].a_label, final_a_label));
    } else {
        let concat_inputs: String = combined
            .iter()
            .map(|s| format!("[{}][{}]", s.v_label, s.a_label))
            .collect::<Vec<_>>()
            .join("");
        filter_parts.push(format!(
            "{}concat=n={}:v=1:a=1[{}][{}]",
            concat_inputs, n, final_v_label, final_a_label
        ));
    }

    // テキストオーバーレイ（drawtext）
    for (i, clip) in text_clips.iter().enumerate() {
        if let Some(ref tp) = clip.text_properties {
            let prev_label = final_v_label.clone();
            let new_label = format!("text{}", i);

            let escaped_text = tp
                .text
                .replace('\\', "\\\\")
                .replace('\'', "'\\\\\\''")
                .replace(':', "\\:");

            // fontcolor にopacityを含める（hex @AA形式）
            let alpha = (tp.opacity * 255.0) as u8;
            let fontcolor = format!("{}@0x{:02x}", tp.font_color.trim_start_matches('#'), alpha);

            // 位置計算: positionX/Y は 0-100% なので画面サイズに変換
            let x_expr = format!("(w*{:.2}/100-tw/2)", tp.position_x);
            let y_expr = format!("(h*{:.2}/100-th/2)", tp.position_y);

            let start = clip.start_time;
            let end = clip.start_time + clip.duration;

            let mut drawtext = format!(
                "[{}]drawtext=text='{}':fontsize={}:fontcolor={}:x={}:y={}:enable='between(t,{:.3},{:.3})'",
                prev_label, escaped_text, tp.font_size, fontcolor, x_expr, y_expr, start, end
            );

            if tp.bold {
                // borderw で太字を模倣
                drawtext.push_str(":borderw=1:bordercolor=white@0x00");
            }

            if tp.background_color != "transparent" && !tp.background_color.is_empty() {
                let bg = tp.background_color.trim_start_matches('#');
                drawtext.push_str(&format!(":box=1:boxcolor={}@0x80:boxborderw=5", bg));
            }

            drawtext.push_str(&format!("[{}]", new_label));
            filter_parts.push(drawtext);
            final_v_label = new_label;
        }
    }

    // フィルターグラフを結合
    let filter_complex = filter_parts.join(";");
    args.push("-filter_complex".into());
    args.push(filter_complex);

    // 出力マッピング
    args.push("-map".into());
    args.push(format!("[{}]", final_v_label));
    args.push("-map".into());
    args.push(format!("[{}]", final_a_label));

    // フォーマットプロファイルから出力設定を生成
    let profile = get_format_profile(&settings.format);

    args.extend(["-c:v".into(), profile.video_codec.into()]);
    if let Some(preset) = profile.video_preset {
        args.extend(["-preset".into(), preset.into()]);
    }
    args.extend([
        "-b:v".into(),
        settings.bitrate.clone(),
        "-r".into(),
        settings.fps.to_string(),
        "-c:a".into(),
        profile.audio_codec.into(),
        "-b:a".into(),
        profile.audio_bitrate.into(),
    ]);
    if let Some(container) = profile.container {
        args.extend(["-f".into(), container.into()]);
    }
    for flag in profile.extra_flags {
        args.push((*flag).into());
    }
    args.push(settings.output_path.clone());

    Ok(args)
}
