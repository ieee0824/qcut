use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::Mutex;

pub struct WaveformCache {
    pub cache: Mutex<HashMap<String, Vec<[f32; 2]>>>,
    pub in_progress: Mutex<HashSet<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformData {
    pub peaks: Vec<[f32; 2]>,
    pub sample_rate: u32,
    pub source_duration: f64,
}

const PEAKS_PER_SECOND: u32 = 1000;
const SAMPLES_PER_PEAK: u32 = 256;

#[tauri::command]
pub async fn get_waveform(
    file_path: String,
    cache: tauri::State<'_, WaveformCache>,
) -> Result<WaveformData, String> {
    // キャッシュ確認
    {
        let c = cache.cache.lock().map_err(|e| e.to_string())?;
        if let Some(peaks) = c.get(&file_path) {
            let duration = peaks.len() as f64 / PEAKS_PER_SECOND as f64;
            return Ok(WaveformData {
                peaks: peaks.clone(),
                sample_rate: PEAKS_PER_SECOND,
                source_duration: duration,
            });
        }
    }

    // 同一ファイルの並行処理を防止
    {
        let mut in_progress = cache.in_progress.lock().map_err(|e| e.to_string())?;
        if in_progress.contains(&file_path) {
            return Err("このファイルの波形データは現在生成中です".to_string());
        }
        in_progress.insert(file_path.clone());
    }

    let result = generate_waveform(&file_path);

    // 処理中フラグを解除
    {
        let mut in_progress = cache.in_progress.lock().map_err(|e| e.to_string())?;
        in_progress.remove(&file_path);
    }

    let peaks = result?;

    // キャッシュに保存
    {
        let mut c = cache.cache.lock().map_err(|e| e.to_string())?;
        c.insert(file_path.clone(), peaks.clone());
    }

    let duration = peaks.len() as f64 / PEAKS_PER_SECOND as f64;
    Ok(WaveformData {
        peaks,
        sample_rate: PEAKS_PER_SECOND,
        source_duration: duration,
    })
}

fn generate_waveform(file_path: &str) -> Result<Vec<[f32; 2]>, String> {
    let decode_rate = PEAKS_PER_SECOND * SAMPLES_PER_PEAK;

    let mut child = Command::new("ffmpeg")
        .args([
            "-i",
            file_path,
            "-f",
            "f32le",
            "-ac",
            "1",
            "-ar",
            &decode_rate.to_string(),
            "-v",
            "quiet",
            "pipe:1",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("FFmpeg起動失敗: {}", e))?;

    let stdout = child.stdout.take().ok_or("stdout取得失敗")?;
    let mut reader = std::io::BufReader::new(stdout);

    let mut peaks: Vec<[f32; 2]> = Vec::new();
    let chunk_bytes = SAMPLES_PER_PEAK as usize * 4; // f32 = 4 bytes
    let mut buf = vec![0u8; chunk_bytes];

    loop {
        let mut total_read = 0;
        while total_read < buf.len() {
            match reader.read(&mut buf[total_read..]) {
                Ok(0) => break,
                Ok(n) => total_read += n,
                Err(_) => break,
            }
        }
        if total_read == 0 {
            break;
        }

        let sample_count = total_read / 4;
        let mut min_val: f32 = 0.0;
        let mut max_val: f32 = 0.0;

        for i in 0..sample_count {
            let bytes = [
                buf[i * 4],
                buf[i * 4 + 1],
                buf[i * 4 + 2],
                buf[i * 4 + 3],
            ];
            let sample = f32::from_le_bytes(bytes);
            if sample < min_val {
                min_val = sample;
            }
            if sample > max_val {
                max_val = sample;
            }
        }
        peaks.push([min_val, max_val]);
    }

    let _ = child.wait();

    Ok(peaks)
}
