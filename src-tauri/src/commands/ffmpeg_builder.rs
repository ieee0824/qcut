use super::export::{ExportClip, ExportSettings, ExportTrack};

// --- フォーマット定義テーブル ---

pub(crate) struct FormatProfile {
    key: &'static str,
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

pub(crate) fn get_format_profile(key: &str) -> &'static FormatProfile {
    FORMAT_PROFILES
        .iter()
        .find(|p| p.key == key)
        .unwrap_or(&FORMAT_PROFILES[0]) // mp4 をデフォルトにフォールバック
}

// --- ヘルパー関数 ---

pub(crate) struct VideoTrackClip<'a> {
    pub clip: &'a ExportClip,
    pub track_volume: f64,
    pub track_muted: bool,
}

pub(crate) fn collect_video_clips(tracks: &[ExportTrack]) -> Result<Vec<VideoTrackClip<'_>>, String> {
    let has_solo = tracks.iter().any(|t| t.solo);
    let mut clips: Vec<VideoTrackClip> = tracks
        .iter()
        .filter(|t| t.track_type == "video")
        .flat_map(|t| {
            let is_muted = t.mute || (has_solo && !t.solo);
            t.clips.iter().map(move |c| VideoTrackClip {
                clip: c,
                track_volume: t.volume,
                track_muted: is_muted,
            })
        })
        .collect();
    clips.sort_by(|a, b| {
        a.clip.start_time
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

// --- FFmpegコマンド構築 ---

pub(crate) fn build_ffmpeg_args(
    settings: &ExportSettings,
    video_clips: &[VideoTrackClip],
    text_clips: &[&ExportClip],
    audio_track_clips: &[AudioTrackClip],
) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = vec!["-y".into(), "-progress".into(), "pipe:1".into()];
    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut input_args: Vec<String> = Vec::new();
    let mut input_index: usize = 0;

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
        v_label: String,
        a_label: String,
        duration: f64,
        transition: Option<(String, f64)>,
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
                    afilter.push_str(&format!(",aecho=0.8:0.9:{:.0}:{:.2}", effects.echo_delay, decay));
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

                prev.v_label = new_v_label;
                prev.a_label = new_a_label;
                prev.duration = prev.duration + seg.duration - trans_dur;
                continue;
            }
        }
        combined.push(CombinedSegment {
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
            let idx = input_map
                .get(&clip.file_path)
                .ok_or_else(|| format!("音声入力インデックスが見つかりません: {}", clip.file_path))?;

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
                    afilter.push_str(&format!(",afade=t=out:st={:.3}:d={:.3}", fade_out_start, effects.fade_out));
                }
                // イコライザー
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
                    afilter.push_str(&format!(",aecho=0.8:0.9:{:.0}:{:.2}", effects.echo_delay, decay));
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
            let fontcolor = format!("{}@0x{:02x}", tp.font_color.trim_start_matches('#'), alpha);

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
