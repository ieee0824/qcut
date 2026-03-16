use super::export::{
    CurvePoint, ExportClip, ExportSettings, ExportTimelineTransition, ExportTrack, ToneCurves,
};
use super::hsl_lut::{generate_hsl_lut, HslParams};
use regex::Regex;

/// 16進カラー値をバリデーションする（6桁または8桁の16進数）
fn validate_hex_color(color: &str) -> Result<String, String> {
    let c = color.trim_start_matches('#');
    let re = Regex::new(r"^[0-9a-fA-F]{6,8}$").unwrap();
    if re.is_match(c) {
        Ok(c.to_string())
    } else {
        Err(format!("不正なカラー値: {}", color))
    }
}

/// エクスポート設定の数値パラメータをバリデーションする
fn validate_export_settings(settings: &ExportSettings) -> Result<(), String> {
    if settings.width < 32 || settings.width > 7680 {
        return Err(format!("不正な幅: {} (32〜7680)", settings.width));
    }
    if settings.height < 32 || settings.height > 4320 {
        return Err(format!("不正な高さ: {} (32〜4320)", settings.height));
    }
    if settings.fps < 1 || settings.fps > 120 {
        return Err(format!("不正なFPS: {} (1〜120)", settings.fps));
    }
    Ok(())
}

// --- フォーマット定義テーブル ---

pub(crate) struct FormatProfile {
    pub(crate) key: &'static str,
    pub(crate) label: &'static str,
    pub(crate) ext: &'static str,
    pub(crate) filter_name: &'static str,
    pub(crate) video_codec: &'static str,
    pub(crate) video_preset: Option<&'static str>,
    pub(crate) audio_codec: &'static str,
    pub(crate) audio_bitrate: &'static str,
    pub(crate) container: Option<&'static str>,
    pub(crate) extra_flags: &'static [&'static str],
}

const FORMAT_PROFILES: &[FormatProfile] = &[
    FormatProfile {
        key: "mp4",
        label: "MP4 (H.264)",
        ext: "mp4",
        filter_name: "MP4",
        video_codec: "libx264",
        video_preset: Some("medium"),
        audio_codec: "aac",
        audio_bitrate: "128k",
        container: None,
        extra_flags: &["-movflags", "+faststart"],
    },
    FormatProfile {
        key: "mov",
        label: "MOV (H.264)",
        ext: "mov",
        filter_name: "MOV",
        video_codec: "libx264",
        video_preset: Some("medium"),
        audio_codec: "aac",
        audio_bitrate: "128k",
        container: Some("mov"),
        extra_flags: &[],
    },
    FormatProfile {
        key: "avi",
        label: "AVI (H.264)",
        ext: "avi",
        filter_name: "AVI",
        video_codec: "libx264",
        video_preset: Some("medium"),
        audio_codec: "mp3",
        audio_bitrate: "192k",
        container: Some("avi"),
        extra_flags: &[],
    },
    FormatProfile {
        key: "webm",
        label: "WebM (VP9)",
        ext: "webm",
        filter_name: "WebM",
        video_codec: "libvpx-vp9",
        video_preset: None,
        audio_codec: "libopus",
        audio_bitrate: "128k",
        container: None,
        extra_flags: &[],
    },
];

// --- コーデック許可リスト（コマンドインジェクション対策）---

const ALLOWED_VIDEO_CODECS: &[&str] = &["libx264", "libx265", "libvpx-vp9", "libaom-av1"];

const ALLOWED_AUDIO_CODECS: &[&str] = &["aac", "mp3", "libopus", "flac", "pcm_s16le", "libvorbis"];

/// プラグインから受け取ったカスタムフォーマットプロファイルを検証する
pub(crate) fn validate_custom_format_profile(
    video_codec: &str,
    audio_codec: &str,
    audio_bitrate: &str,
) -> Result<(), String> {
    if !ALLOWED_VIDEO_CODECS.contains(&video_codec) {
        return Err(format!("不正な videoCodec: {} (許可リスト外)", video_codec));
    }
    if !ALLOWED_AUDIO_CODECS.contains(&audio_codec) {
        return Err(format!("不正な audioCodec: {} (許可リスト外)", audio_codec));
    }
    if !audio_bitrate.ends_with('k') {
        return Err(format!("不正な audioBitrate: {} (例: 128k)", audio_bitrate));
    }
    let num_part = &audio_bitrate[..audio_bitrate.len() - 1];
    if num_part.is_empty() || !num_part.chars().all(|c| c.is_ascii_digit()) {
        return Err(format!("不正な audioBitrate: {} (例: 128k)", audio_bitrate));
    }
    Ok(())
}

/// フロントエンドへ返すフォーマット情報
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FormatInfo {
    pub key: String,
    pub label: String,
    pub ext: String,
    pub filter_name: String,
}

/// 利用可能なエクスポートフォーマット一覧を返す
pub(crate) fn list_format_infos() -> Vec<FormatInfo> {
    FORMAT_PROFILES
        .iter()
        .map(|p| FormatInfo {
            key: p.key.to_string(),
            label: p.label.to_string(),
            ext: p.ext.to_string(),
            filter_name: p.filter_name.to_string(),
        })
        .collect()
}

pub(crate) fn get_format_profile(key: &str) -> &'static FormatProfile {
    FORMAT_PROFILES
        .iter()
        .find(|p| p.key == key)
        .unwrap_or(&FORMAT_PROFILES[0]) // mp4 をデフォルトにフォールバック
}

// --- ヘルパー関数 ---

pub(crate) struct VideoTrackClip<'a> {
    pub track_id: &'a str,
    pub clip: &'a ExportClip,
    pub track_volume: f64,
    pub track_muted: bool,
}

pub(crate) fn collect_video_clips(
    tracks: &[ExportTrack],
) -> Result<Vec<VideoTrackClip<'_>>, String> {
    let has_solo = tracks.iter().any(|t| t.solo);
    let mut clips: Vec<VideoTrackClip> = tracks
        .iter()
        .filter(|t| t.track_type == "video")
        .flat_map(|t| {
            let is_muted = t.mute || (has_solo && !t.solo);
            t.clips.iter().map(move |c| VideoTrackClip {
                track_id: &t.id,
                clip: c,
                track_volume: t.volume,
                track_muted: is_muted,
            })
        })
        .collect();
    clips.sort_by(|a, b| {
        a.clip
            .start_time
            .partial_cmp(&b.clip.start_time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    Ok(clips)
}

pub(crate) struct AudioTrackClip<'a> {
    pub clip: &'a ExportClip,
    pub track_volume: f64,
}

pub(crate) fn collect_audio_clips(tracks: &[ExportTrack]) -> Vec<AudioTrackClip<'_>> {
    let has_solo = tracks.iter().any(|t| t.solo);
    let mut clips: Vec<AudioTrackClip> = Vec::new();
    for track in tracks {
        if track.track_type != "audio" {
            continue;
        }
        // ミュート判定: 明示ミュート or (ソロが存在 & 自トラックがソロでない)
        let is_muted = track.mute || (has_solo && !track.solo);
        if is_muted {
            continue;
        }
        for clip in &track.clips {
            clips.push(AudioTrackClip {
                clip,
                track_volume: track.volume,
            });
        }
    }
    clips.sort_by(|a, b| {
        a.clip
            .start_time
            .partial_cmp(&b.clip.start_time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    clips
}

pub(crate) fn collect_text_clips(tracks: &[ExportTrack]) -> Vec<&ExportClip> {
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

fn find_transition_between_segments<'a>(
    transitions: &'a [ExportTimelineTransition],
    out_track_id: &str,
    out_clip_id: &str,
    in_track_id: &str,
    in_clip_id: &str,
) -> Option<&'a ExportTimelineTransition> {
    transitions.iter().find(|transition| {
        transition.out_track_id == out_track_id
            && transition.in_track_id == in_track_id
            && transition.out_clip_id == out_clip_id
            && transition.in_clip_id == in_clip_id
            && transition.duration.is_finite()
            && transition.duration > 0.0
    })
}

// --- FFmpegコマンド構築 ---

/// FFmpegコマンド構築の戻り値
pub(crate) struct FfmpegBuildResult {
    pub args: Vec<String>,
    /// エクスポート完了後に削除すべき一時ファイル（LUT等）
    pub temp_files: Vec<std::path::PathBuf>,
}

pub(crate) fn build_ffmpeg_args(
    settings: &ExportSettings,
    video_clips: &[VideoTrackClip],
    text_clips: &[&ExportClip],
    audio_track_clips: &[AudioTrackClip],
) -> Result<FfmpegBuildResult, String> {
    // セキュリティ: 数値パラメータのバリデーション
    validate_export_settings(settings)?;

    let mut args: Vec<String> = vec!["-y".into(), "-progress".into(), "pipe:1".into()];
    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut input_args: Vec<String> = Vec::new();
    let mut input_index: usize = 0;
    let mut temp_files: Vec<std::path::PathBuf> = Vec::new();

    // 入力ファイルの重複排除とインデックスマッピング
    for vtc in video_clips {
        if !vtc.clip.file_path.is_empty() && !input_map.contains_key(&vtc.clip.file_path) {
            input_map.insert(vtc.clip.file_path.clone(), input_index);
            input_args.push("-i".into());
            input_args.push(vtc.clip.file_path.clone());
            input_index += 1;
        }
    }
    // 音声トラックの入力ファイルも追加
    for atc in audio_track_clips {
        if !atc.clip.file_path.is_empty() && !input_map.contains_key(&atc.clip.file_path) {
            input_map.insert(atc.clip.file_path.clone(), input_index);
            input_args.push("-i".into());
            input_args.push(atc.clip.file_path.clone());
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
    struct SegmentInfo {
        track_id: Option<String>,
        clip_id: Option<String>,
        v_label: String,
        a_label: String,
        duration: f64,
    }
    let mut segments: Vec<SegmentInfo> = Vec::new();
    let mut current_time = 0.0;

    for (i, vtc) in video_clips.iter().enumerate() {
        let clip = vtc.clip;
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
                track_id: None,
                clip_id: None,
                v_label: gap_v_label,
                a_label: gap_a_label,
                duration: gap_duration,
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

            // 色相シフト
            if effects.hue.abs() > 0.1 {
                vfilter.push_str(&format!(",hue=h={:.1}", effects.hue));
            }

            // 色温度（colorbalance フィルタで近似）
            if effects.color_temperature.abs() > 0.01 {
                let t = effects.color_temperature;
                if t > 0.0 {
                    let rs = t * 0.3;
                    let bs = -t * 0.3;
                    vfilter.push_str(&format!(
                        ",colorbalance=rs={:.2}:bs={:.2}:rm={:.2}:bm={:.2}",
                        rs,
                        bs,
                        rs * 0.5,
                        bs * 0.5
                    ));
                } else {
                    let bs = -t * 0.3;
                    let rs = t * 0.3;
                    vfilter.push_str(&format!(
                        ",colorbalance=rs={:.2}:bs={:.2}:rm={:.2}:bm={:.2}",
                        rs,
                        bs,
                        rs * 0.5,
                        bs * 0.5
                    ));
                }
            }

            // リフト/ガンマ/ゲイン（colorbalance フィルタでシャドウ/ミッドトーン/ハイライト）
            {
                let has_lift = effects.lift_r.abs() > 0.01
                    || effects.lift_g.abs() > 0.01
                    || effects.lift_b.abs() > 0.01;
                let has_gamma = effects.gamma_r.abs() > 0.01
                    || effects.gamma_g.abs() > 0.01
                    || effects.gamma_b.abs() > 0.01;
                let has_gain = effects.gain_r.abs() > 0.01
                    || effects.gain_g.abs() > 0.01
                    || effects.gain_b.abs() > 0.01;

                if has_lift || has_gamma || has_gain {
                    let mut parts: Vec<String> = Vec::new();
                    if has_lift {
                        parts.push(format!("rs={:.2}", effects.lift_r));
                        parts.push(format!("gs={:.2}", effects.lift_g));
                        parts.push(format!("bs={:.2}", effects.lift_b));
                    }
                    if has_gamma {
                        parts.push(format!("rm={:.2}", effects.gamma_r));
                        parts.push(format!("gm={:.2}", effects.gamma_g));
                        parts.push(format!("bm={:.2}", effects.gamma_b));
                    }
                    if has_gain {
                        parts.push(format!("rh={:.2}", effects.gain_r));
                        parts.push(format!("gh={:.2}", effects.gain_g));
                        parts.push(format!("bh={:.2}", effects.gain_b));
                    }
                    vfilter.push_str(&format!(",colorbalance={}", parts.join(":")));
                }
            }

            // HSL 色域別彩度調整（LUT3Dで WebGL シェーダーと同じロジックを再現）
            let hsl_params = HslParams {
                red_sat: effects.hsl_red_sat,
                yellow_sat: effects.hsl_yellow_sat,
                green_sat: effects.hsl_green_sat,
                cyan_sat: effects.hsl_cyan_sat,
                blue_sat: effects.hsl_blue_sat,
                magenta_sat: effects.hsl_magenta_sat,
            };
            if hsl_params.is_active() {
                let lut_path = std::env::temp_dir()
                    .join(format!("qcut_hsl_lut_{}.cube", uuid::Uuid::new_v4()));
                generate_hsl_lut(&hsl_params, &lut_path)?;
                let lut_path_str = lut_path
                    .to_string_lossy()
                    .replace('\\', "\\\\")
                    .replace('\'', "\\'");
                vfilter.push_str(&format!(",lut3d=file='{}'", lut_path_str));
                temp_files.push(lut_path);
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

            // ブラー
            if effects.blur_amount > 0.1 {
                let sigma = effects.blur_amount / 2.0;
                vfilter.push_str(&format!(",gblur=sigma={:.2}", sigma));
            }

            // シャープ (unsharp mask: luma 5x5 kernel)
            // WebGL プレビューではブラーとシャープは排他的なので、
            // ブラーが有効な場合は unsharp を適用しない
            if effects.sharpen_amount > 0.01 && effects.blur_amount <= 0.1 {
                vfilter.push_str(&format!(
                    ",unsharp=5:5:{:.2}:5:5:0.0",
                    effects.sharpen_amount
                ));
            }

            // モノクロ
            if effects.monochrome > 0.01 {
                if effects.monochrome >= 0.99 {
                    vfilter.push_str(",hue=s=0");
                } else {
                    let sat = 1.0 - effects.monochrome;
                    vfilter.push_str(&format!(",hue=s={:.2}", sat));
                }
            }
        }

        // トーンカーブ（effects ブロックの外。tone_curves は clip 直下）
        if let Some(ref tc) = clip.tone_curves {
            let curves_str = build_ffmpeg_curves_filter(tc);
            if !curves_str.is_empty() {
                vfilter.push_str(&format!(",{}", curves_str));
            }
        }

        if let Some(ref effects) = clip.effects {
            // フェードイン/フェードアウト
            let seg_duration = clip.source_end_time - clip.source_start_time;
            if effects.fade_in > 0.01 {
                vfilter.push_str(&format!(",fade=t=in:st=0:d={:.3}", effects.fade_in));
            }
            if effects.fade_out > 0.01 {
                let fade_out_start = (seg_duration - effects.fade_out).max(0.0);
                vfilter.push_str(&format!(
                    ",fade=t=out:st={:.3}:d={:.3}",
                    fade_out_start, effects.fade_out
                ));
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

        // トラックミュート時は音量0、それ以外はトラック音量 × クリップ音量
        if vtc.track_muted {
            afilter.push_str(",volume=0");
        } else {
            let clip_vol = clip.effects.as_ref().map(|e| e.volume).unwrap_or(1.0);
            let combined_volume = clip_vol * vtc.track_volume;
            if (combined_volume - 1.0).abs() > 0.01 {
                afilter.push_str(&format!(",volume={:.2}", combined_volume));
            }
            if let Some(ref effects) = clip.effects {
                if effects.fade_in > 0.01 {
                    afilter.push_str(&format!(",afade=t=in:st=0:d={:.3}", effects.fade_in));
                }
                if effects.fade_out > 0.01 {
                    let fade_out_start = (audio_duration - effects.fade_out).max(0.0);
                    afilter.push_str(&format!(
                        ",afade=t=out:st={:.3}:d={:.3}",
                        fade_out_start, effects.fade_out
                    ));
                }
                // イコライザー (3バンド: Low 100Hz shelf, Mid 1kHz peaking, High 10kHz shelf)
                if effects.eq_low.abs() > 0.1
                    || effects.eq_mid.abs() > 0.1
                    || effects.eq_high.abs() > 0.1
                {
                    let mut eq_parts: Vec<String> = Vec::new();
                    if effects.eq_low.abs() > 0.1 {
                        eq_parts.push(format!("equalizer=f=100:t=h:w=200:g={:.1}", effects.eq_low));
                    }
                    if effects.eq_mid.abs() > 0.1 {
                        eq_parts.push(format!(
                            "equalizer=f=1000:t=q:w=1.0:g={:.1}",
                            effects.eq_mid
                        ));
                    }
                    if effects.eq_high.abs() > 0.1 {
                        eq_parts.push(format!(
                            "equalizer=f=10000:t=h:w=200:g={:.1}",
                            effects.eq_high
                        ));
                    }
                    afilter.push_str(&format!(",{}", eq_parts.join(",")));
                }
                // ノイズリダクション (anlmdn)
                if effects.denoise_amount > 0.01 {
                    let sigma = effects.denoise_amount * 0.01;
                    afilter.push_str(&format!(",anlmdn=s={:.6}", sigma));
                }
                // ハイパスフィルター
                if effects.highpass_freq > 1.0 {
                    afilter.push_str(&format!(",highpass=f={:.0}", effects.highpass_freq));
                }
                // エコー
                if effects.echo_delay > 1.0 {
                    let decay = effects.echo_decay.clamp(0.01, 0.9);
                    afilter.push_str(&format!(
                        ",aecho=0.8:0.9:{:.0}:{:.2}",
                        effects.echo_delay, decay
                    ));
                }
                // リバーブ（マルチタップ aecho でシミュレート）
                if effects.reverb_amount > 0.01 {
                    let a = effects.reverb_amount;
                    afilter.push_str(&format!(
                        ",aecho=0.8:{:.2}:40|80|120:{:.2}|{:.2}|{:.2}",
                        1.0 - a * 0.15,
                        a * 0.4,
                        a * 0.3,
                        a * 0.2
                    ));
                }
            }
        }
        afilter.push_str(&format!("[{}]", a_label));
        filter_parts.push(afilter);

        let clip_duration = clip.source_end_time - clip.source_start_time;

        segments.push(SegmentInfo {
            track_id: Some(vtc.track_id.to_string()),
            clip_id: Some(clip.id.clone()),
            v_label,
            a_label,
            duration: clip_duration,
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
            track_id: None,
            clip_id: None,
            v_label: gap_v_label,
            a_label: gap_a_label,
            duration: gap_duration,
        });
    }

    // セグメント結合: xfade + concat
    struct CombinedSegment {
        tail_track_id: Option<String>,
        tail_clip_id: Option<String>,
        v_label: String,
        a_label: String,
        duration: f64,
    }
    let mut combined: Vec<CombinedSegment> = Vec::new();
    let mut xfade_counter = 0;

    for seg in segments.iter() {
        if let Some(prev) = combined.last_mut() {
            let out_track_id = prev.tail_track_id.as_deref();
            let out_clip_id = prev.tail_clip_id.as_deref();
            let in_track_id = seg.track_id.as_deref();
            let in_clip_id = seg.clip_id.as_deref();
            if let (Some(out_track_id), Some(out_clip_id), Some(in_track_id), Some(in_clip_id)) =
                (out_track_id, out_clip_id, in_track_id, in_clip_id)
            {
                if let Some(transition) = find_transition_between_segments(
                    &settings.transitions,
                    out_track_id,
                    out_clip_id,
                    in_track_id,
                    in_clip_id,
                ) {
                    let xfade_name = transition_to_xfade(&transition.transition_type);
                    let trans_dur = transition.duration;
                    let offset = (prev.duration - trans_dur).max(0.0);

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

                    prev.tail_track_id = seg.track_id.clone();
                    prev.tail_clip_id = seg.clip_id.clone();
                    prev.v_label = new_v_label;
                    prev.a_label = new_a_label;
                    prev.duration = prev.duration + seg.duration - trans_dur;
                    continue;
                }
            }
        }
        combined.push(CombinedSegment {
            tail_track_id: seg.track_id.clone(),
            tail_clip_id: seg.clip_id.clone(),
            v_label: seg.v_label.clone(),
            a_label: seg.a_label.clone(),
            duration: seg.duration,
        });
    }

    let mut final_v_label = "outv".to_string();
    let mut final_a_label = "outa".to_string();
    let n = combined.len();

    if n == 1 {
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

    // --- 音声トラッククリップのミキシング ---
    if !audio_track_clips.is_empty() {
        // 各音声クリップにフィルターチェーンを構築し、タイムライン上の位置に配置
        let mut audio_stream_labels: Vec<String> = Vec::new();

        for (i, atc) in audio_track_clips.iter().enumerate() {
            let clip = atc.clip;
            let idx = input_map.get(&clip.file_path).ok_or_else(|| {
                format!("音声入力インデックスが見つかりません: {}", clip.file_path)
            })?;

            let label = format!("at{}", i);

            let mut afilter = format!(
                "[{}:a]atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS",
                idx, clip.source_start_time, clip.source_end_time
            );

            // クリップレベルの音量エフェクト
            let clip_volume = clip.effects.as_ref().map(|e| e.volume).unwrap_or(1.0);
            let combined_volume = clip_volume * atc.track_volume;
            if (combined_volume - 1.0).abs() > 0.01 {
                afilter.push_str(&format!(",volume={:.2}", combined_volume));
            }

            // フェードイン/アウト
            if let Some(ref effects) = clip.effects {
                let audio_duration = clip.source_end_time - clip.source_start_time;
                if effects.fade_in > 0.01 {
                    afilter.push_str(&format!(",afade=t=in:st=0:d={:.3}", effects.fade_in));
                }
                if effects.fade_out > 0.01 {
                    let fade_out_start = (audio_duration - effects.fade_out).max(0.0);
                    afilter.push_str(&format!(
                        ",afade=t=out:st={:.3}:d={:.3}",
                        fade_out_start, effects.fade_out
                    ));
                }
                // イコライザー
                if effects.eq_low.abs() > 0.1
                    || effects.eq_mid.abs() > 0.1
                    || effects.eq_high.abs() > 0.1
                {
                    let mut eq_parts: Vec<String> = Vec::new();
                    if effects.eq_low.abs() > 0.1 {
                        eq_parts.push(format!("equalizer=f=100:t=h:w=200:g={:.1}", effects.eq_low));
                    }
                    if effects.eq_mid.abs() > 0.1 {
                        eq_parts.push(format!(
                            "equalizer=f=1000:t=q:w=1.0:g={:.1}",
                            effects.eq_mid
                        ));
                    }
                    if effects.eq_high.abs() > 0.1 {
                        eq_parts.push(format!(
                            "equalizer=f=10000:t=h:w=200:g={:.1}",
                            effects.eq_high
                        ));
                    }
                    afilter.push_str(&format!(",{}", eq_parts.join(",")));
                }
                // ノイズリダクション (anlmdn)
                if effects.denoise_amount > 0.01 {
                    let sigma = effects.denoise_amount * 0.01;
                    afilter.push_str(&format!(",anlmdn=s={:.6}", sigma));
                }
                // ハイパスフィルター
                if effects.highpass_freq > 1.0 {
                    afilter.push_str(&format!(",highpass=f={:.0}", effects.highpass_freq));
                }
                // エコー
                if effects.echo_delay > 1.0 {
                    let decay = effects.echo_decay.clamp(0.01, 0.9);
                    afilter.push_str(&format!(
                        ",aecho=0.8:0.9:{:.0}:{:.2}",
                        effects.echo_delay, decay
                    ));
                }
                // リバーブ（マルチタップ aecho でシミュレート）
                if effects.reverb_amount > 0.01 {
                    let a = effects.reverb_amount;
                    afilter.push_str(&format!(
                        ",aecho=0.8:{:.2}:40|80|120:{:.2}|{:.2}|{:.2}",
                        1.0 - a * 0.15,
                        a * 0.4,
                        a * 0.3,
                        a * 0.2
                    ));
                }
            }

            // adelay でタイムライン上の開始位置に配置（ミリ秒単位）
            let delay_ms = (clip.start_time * 1000.0).round() as i64;
            if delay_ms > 0 {
                afilter.push_str(&format!(",adelay={}|{}", delay_ms, delay_ms));
            }

            // apad で total_duration まで無音パディング
            afilter.push_str(&format!(",apad=whole_dur={:.3}", settings.total_duration));

            afilter.push_str(&format!("[{}]", label));
            filter_parts.push(afilter);
            audio_stream_labels.push(label);
        }

        // 映像音声と音声トラックを amix でミキシング
        let prev_a_label = final_a_label.clone();
        let mixed_label = "amixed".to_string();
        let total_inputs = 1 + audio_stream_labels.len();
        let mut amix_inputs = format!("[{}]", prev_a_label);
        for label in &audio_stream_labels {
            amix_inputs.push_str(&format!("[{}]", label));
        }
        filter_parts.push(format!(
            "{}amix=inputs={}:duration=longest:normalize=0[{}]",
            amix_inputs, total_inputs, mixed_label
        ));
        final_a_label = mixed_label;
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

            let alpha = (tp.opacity * 255.0) as u8;
            let validated_color = validate_hex_color(&tp.font_color)?;
            let fontcolor = format!("{}@0x{:02x}", validated_color, alpha);

            let x_expr = format!("(w*{:.2}/100-tw/2)", tp.position_x);
            let y_expr = format!("(h*{:.2}/100-th/2)", tp.position_y);

            let start = clip.start_time;
            let end = clip.start_time + clip.duration;

            // フォントサイズをプレビューコンテナ高さ → エクスポート解像度にスケーリング
            let scaled_fontsize = if settings.preview_height > 0.0 {
                ((tp.font_size as f64) * (h as f64) / settings.preview_height).round() as u32
            } else {
                tp.font_size
            };

            let mut drawtext = format!(
                "[{}]drawtext=text='{}':fontsize={}:fontcolor={}:x={}:y={}:enable='between(t,{:.3},{:.3})'",
                prev_label, escaped_text, scaled_fontsize, fontcolor, x_expr, y_expr, start, end
            );

            if tp.bold {
                drawtext.push_str(":borderw=1:bordercolor=white@0x00");
            }

            if tp.background_color != "transparent" && !tp.background_color.is_empty() {
                let bg = validate_hex_color(&tp.background_color)?;
                drawtext.push_str(&format!(":box=1:boxcolor={}@0x80:boxborderw=5", bg));
            }

            drawtext.push_str(&format!("[{}]", new_label));
            filter_parts.push(drawtext);
            final_v_label = new_label;
        }
    }

    // タイムコードオーバーレイ（drawtext）
    let mut timecode_idx = 0;
    for vtc in video_clips {
        if let Some(ref tc) = vtc.clip.timecode_overlay {
            if !tc.enabled {
                continue;
            }
            let prev_label = final_v_label.clone();
            let new_label = format!("tc{}", timecode_idx);
            timecode_idx += 1;

            let tc_validated_color = validate_hex_color(&tc.font_color)?;
            let fontcolor = format!("{}@0xff", tc_validated_color);
            let x_expr = format!("(w*{:.2}/100-tw/2)", tc.position_x);
            let y_expr = format!("(h*{:.2}/100-th/2)", tc.position_y);

            let scaled_fontsize = if settings.preview_height > 0.0 {
                ((tc.font_size as f64) * (h as f64) / settings.preview_height).round() as u32
            } else {
                tc.font_size
            };

            let clip_start = vtc.clip.start_time;
            let clip_end = vtc.clip.start_time + vtc.clip.duration;

            // basetime: epoch microseconds of start_date_time
            let basetime = (tc.start_date_time * 1000.0) as i64; // ms → μs

            // タイムコードフォーマット選択
            let time_fmt = match tc.format.as_str() {
                "ymd-hm" => "%Y年%m月%d日 %H\\:%M",
                "md-hm" => "%m月%d日 %H\\:%M",
                "hms" => "%H\\:%M\\:%S",
                "hm" | _ => "%H\\:%M",
            };

            let drawtext = format!(
                "[{}]drawtext=text='%{{pts\\:localtime\\:{}}}':basetime={}:fontsize={}:fontcolor={}:x={}:y={}:enable='between(t,{:.3},{:.3})':font=monospace:shadowx=1:shadowy=1:shadowcolor=black@0xcc[{}]",
                prev_label, time_fmt, basetime, scaled_fontsize, fontcolor, x_expr, y_expr, clip_start, clip_end, new_label
            );

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
    // カスタムプロファイルが指定されていれば allowlist 検証後に使用し、なければ静的プロファイルにフォールバック
    if let Some(custom) = &settings.custom_format_profile {
        validate_custom_format_profile(
            &custom.video_codec,
            &custom.audio_codec,
            &custom.audio_bitrate,
        )?;
        args.extend(["-c:v".into(), custom.video_codec.clone()]);
        if let Some(preset) = &custom.video_preset {
            args.extend(["-preset".into(), preset.clone()]);
        }
        args.extend([
            "-b:v".into(),
            settings.bitrate.clone(),
            "-r".into(),
            settings.fps.to_string(),
            "-c:a".into(),
            custom.audio_codec.clone(),
            "-b:a".into(),
            custom.audio_bitrate.clone(),
        ]);
        // 出力ファイルの拡張子からコンテナフラグ（-f, extra_flags）を適用する
        let out_ext = std::path::Path::new(&settings.output_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        if let Some(base_profile) = FORMAT_PROFILES.iter().find(|p| p.ext == out_ext) {
            if let Some(container) = base_profile.container {
                args.extend(["-f".into(), container.into()]);
            }
            for flag in base_profile.extra_flags {
                args.push((*flag).into());
            }
        }
    } else {
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
    }
    args.push(settings.output_path.clone());

    Ok(FfmpegBuildResult { args, temp_files })
}

/// トーンカーブが線形（デフォルト）かどうかを判定する
fn is_default_curve(points: &[CurvePoint]) -> bool {
    if points.len() != 2 {
        return false;
    }
    (points[0].x.abs() < 1e-6)
        && (points[0].y.abs() < 1e-6)
        && ((points[1].x - 1.0).abs() < 1e-6)
        && ((points[1].y - 1.0).abs() < 1e-6)
}

/// チャンネルの制御点が2点未満の場合、端点(0,0)と(1,1)を補完する
fn ensure_min_points(points: &[CurvePoint]) -> Vec<CurvePoint> {
    if points.len() >= 2 {
        return points.to_vec();
    }
    if points.len() == 1 {
        // 1点のみの場合、もう片方の端点を追加
        let p = &points[0];
        if p.x < 0.5 {
            return vec![p.clone(), CurvePoint { x: 1.0, y: 1.0 }];
        } else {
            return vec![CurvePoint { x: 0.0, y: 0.0 }, p.clone()];
        }
    }
    // 0点の場合はデフォルト線形
    vec![CurvePoint { x: 0.0, y: 0.0 }, CurvePoint { x: 1.0, y: 1.0 }]
}

/// FFmpeg の `curves` フィルター文字列を生成する
/// 例: curves=r='0/0 0.5/0.7 1/1':g='0/0 1/1':b='0/0 1/1':master='0/0 0.3/0.1 1/1'
fn build_ffmpeg_curves_filter(tc: &ToneCurves) -> String {
    let rgb = ensure_min_points(&tc.rgb);
    let r = ensure_min_points(&tc.r);
    let g = ensure_min_points(&tc.g);
    let b = ensure_min_points(&tc.b);

    let has_rgb = !is_default_curve(&rgb);
    let has_r = !is_default_curve(&r);
    let has_g = !is_default_curve(&g);
    let has_b = !is_default_curve(&b);

    if !has_rgb && !has_r && !has_g && !has_b {
        return String::new();
    }

    let mut parts: Vec<String> = Vec::new();

    if has_rgb {
        parts.push(format!("master='{}'", curve_points_to_str(&rgb)));
    }
    if has_r {
        parts.push(format!("r='{}'", curve_points_to_str(&r)));
    }
    if has_g {
        parts.push(format!("g='{}'", curve_points_to_str(&g)));
    }
    if has_b {
        parts.push(format!("b='{}'", curve_points_to_str(&b)));
    }

    format!("curves={}", parts.join(":"))
}

/// CurvePoint 配列を FFmpeg curves フィルターの制御点文字列に変換する
/// 例: "0/0 0.25/0.3 0.5/0.7 1/1"
fn curve_points_to_str(points: &[CurvePoint]) -> String {
    points
        .iter()
        .map(|p| format!("{:.4}/{:.4}", p.x, p.y))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::{
        build_ffmpeg_args, collect_audio_clips, collect_text_clips, collect_video_clips,
        find_transition_between_segments,
    };
    use crate::commands::export::{
        ExportClip, ExportSettings, ExportTimelineTransition, ExportTrack,
    };

    fn make_transition(
        out_track_id: &str,
        out_clip_id: &str,
        in_track_id: &str,
        in_clip_id: &str,
        duration: f64,
        transition_type: &str,
    ) -> ExportTimelineTransition {
        ExportTimelineTransition {
            id: format!("{}-{}", out_clip_id, in_clip_id),
            transition_type: transition_type.to_string(),
            duration,
            out_track_id: out_track_id.to_string(),
            out_clip_id: out_clip_id.to_string(),
            in_track_id: in_track_id.to_string(),
            in_clip_id: in_clip_id.to_string(),
        }
    }

    fn make_clip(id: &str, start_time: f64, duration: f64, file_path: &str) -> ExportClip {
        ExportClip {
            id: id.to_string(),
            name: id.to_string(),
            start_time,
            duration,
            file_path: file_path.to_string(),
            source_start_time: 0.0,
            source_end_time: duration,
            effects: None,
            tone_curves: None,
            text_properties: None,
            timecode_overlay: None,
        }
    }

    fn make_video_track(id: &str, clips: Vec<ExportClip>) -> ExportTrack {
        ExportTrack {
            id: id.to_string(),
            track_type: "video".to_string(),
            name: id.to_string(),
            clips,
            volume: 1.0,
            mute: false,
            solo: false,
        }
    }

    fn make_settings(
        tracks: Vec<ExportTrack>,
        transitions: Vec<ExportTimelineTransition>,
        total_duration: f64,
    ) -> ExportSettings {
        ExportSettings {
            format: "mp4".to_string(),
            width: 1920,
            height: 1080,
            bitrate: "8M".to_string(),
            fps: 30,
            output_path: "/tmp/out.mp4".to_string(),
            tracks,
            transitions,
            total_duration,
            preview_height: 1080.0,
            custom_format_profile: None,
        }
    }

    fn filter_complex_from_args(args: &[String]) -> String {
        let index = args
            .iter()
            .position(|arg| arg == "-filter_complex")
            .expect("missing -filter_complex flag");
        args[index + 1].clone()
    }

    #[test]
    fn finds_transition_for_exact_clip_pair() {
        let transitions = vec![
            make_transition("video-1", "clip-1", "video-1", "clip-2", 1.0, "crossfade"),
            make_transition("video-1", "clip-2", "video-1", "clip-3", 0.5, "crossfade"),
        ];

        let transition = find_transition_between_segments(
            &transitions,
            "video-1",
            "clip-2",
            "video-1",
            "clip-3",
        )
        .unwrap();

        assert_eq!(transition.id, "clip-2-clip-3");
        assert!((transition.duration - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn does_not_match_transition_by_incoming_clip_only() {
        let transitions = vec![make_transition(
            "video-1",
            "clip-1",
            "video-1",
            "clip-3",
            1.0,
            "crossfade",
        )];

        let transition = find_transition_between_segments(
            &transitions,
            "video-1",
            "clip-2",
            "video-1",
            "clip-3",
        );

        assert!(transition.is_none());
    }

    #[test]
    fn ignores_invalid_duration_transition() {
        let transitions = vec![make_transition(
            "video-1",
            "clip-1",
            "video-1",
            "clip-2",
            0.0,
            "crossfade",
        )];

        let transition = find_transition_between_segments(
            &transitions,
            "video-1",
            "clip-1",
            "video-1",
            "clip-2",
        );

        assert!(transition.is_none());
    }

    #[test]
    fn matches_cross_track_transition_by_track_and_clip_ids() {
        let transitions = vec![
            make_transition("video-1", "clip-1", "video-2", "clip-2", 1.0, "crossfade"),
            make_transition("video-9", "clip-1", "video-8", "clip-2", 1.0, "crossfade"),
        ];

        let transition = find_transition_between_segments(
            &transitions,
            "video-1",
            "clip-1",
            "video-2",
            "clip-2",
        )
        .unwrap();

        assert_eq!(transition.out_track_id, "video-1");
        assert_eq!(transition.in_track_id, "video-2");
    }

    #[test]
    fn builds_cross_track_transition_filters() {
        let tracks = vec![
            make_video_track("video-1", vec![make_clip("clip-1", 0.0, 5.0, "a.mp4")]),
            make_video_track("video-2", vec![make_clip("clip-2", 5.0, 5.0, "b.mp4")]),
        ];
        let settings = make_settings(
            tracks,
            vec![make_transition(
                "video-1",
                "clip-1",
                "video-2",
                "clip-2",
                1.0,
                "crossfade",
            )],
            10.0,
        );
        let video_clips = collect_video_clips(&settings.tracks).unwrap();
        let text_clips = collect_text_clips(&settings.tracks);
        let audio_track_clips = collect_audio_clips(&settings.tracks);

        let result =
            build_ffmpeg_args(&settings, &video_clips, &text_clips, &audio_track_clips).unwrap();
        let filter_complex = filter_complex_from_args(&result.args);

        assert!(filter_complex
            .contains("[v0][v1]xfade=transition=fade:duration=1.000:offset=4.000[xv0]"));
        assert!(filter_complex.contains("[a0][a1]acrossfade=d=1.000:c1=tri:c2=tri[xa0]"));
    }

    #[test]
    fn builds_mixed_single_track_and_cross_track_transitions() {
        let tracks = vec![
            make_video_track(
                "video-1",
                vec![
                    make_clip("clip-1", 0.0, 5.0, "a.mp4"),
                    make_clip("clip-2", 5.0, 5.0, "b.mp4"),
                ],
            ),
            make_video_track("video-2", vec![make_clip("clip-3", 10.0, 5.0, "c.mp4")]),
        ];
        let settings = make_settings(
            tracks,
            vec![
                make_transition("video-1", "clip-1", "video-1", "clip-2", 1.0, "dissolve"),
                make_transition("video-1", "clip-2", "video-2", "clip-3", 0.5, "wipe-left"),
            ],
            15.0,
        );
        let video_clips = collect_video_clips(&settings.tracks).unwrap();
        let text_clips = collect_text_clips(&settings.tracks);
        let audio_track_clips = collect_audio_clips(&settings.tracks);

        let result =
            build_ffmpeg_args(&settings, &video_clips, &text_clips, &audio_track_clips).unwrap();
        let filter_complex = filter_complex_from_args(&result.args);

        assert!(filter_complex.contains("xfade=transition=dissolve:duration=1.000:offset=4.000"));
        assert!(filter_complex.contains("xfade=transition=wipeleft:duration=0.500:offset=8.500"));
        assert!(filter_complex.contains("acrossfade=d=1.000:c1=tri:c2=tri"));
        assert!(filter_complex.contains("acrossfade=d=0.500:c1=tri:c2=tri"));
    }
}
