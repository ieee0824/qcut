use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tokio::sync::Notify;

pub struct WaveformCache {
    pub cache: Mutex<HashMap<String, Vec<[f32; 2]>>>,
    pub in_progress: Mutex<HashMap<String, Arc<Notify>>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformData {
    pub peaks: Vec<[f32; 2]>,
    pub sample_rate: u32,
    pub source_duration: f64,
}

type PeaksMap = HashMap<String, Vec<[f32; 2]>>;
type ProgressMap = HashMap<String, Arc<Notify>>;

const PEAKS_PER_SECOND: u32 = 1000;
const SAMPLES_PER_PEAK: u32 = 256;

impl WaveformCache {
    fn lock_cache(&self) -> Result<std::sync::MutexGuard<'_, PeaksMap>, String> {
        self.cache.lock().map_err(|e| e.to_string())
    }

    fn lock_in_progress(&self) -> Result<std::sync::MutexGuard<'_, ProgressMap>, String> {
        self.in_progress.lock().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn get_waveform(
    file_path: String,
    cache: tauri::State<'_, WaveformCache>,
) -> Result<WaveformData, String> {
    // キャッシュ確認
    {
        let c = cache.lock_cache()?;
        if let Some(peaks) = c.get(&file_path) {
            let duration = peaks.len() as f64 / PEAKS_PER_SECOND as f64;
            return Ok(WaveformData {
                peaks: peaks.clone(),
                sample_rate: PEAKS_PER_SECOND,
                source_duration: duration,
            });
        }
    }

    // 同一ファイルの並行処理を防止（生成中なら完了を待つ）
    let waiting_notify: Option<Arc<Notify>> = {
        let in_progress = cache.lock_in_progress()?;
        in_progress.get(&file_path).map(Arc::clone)
    };
    if let Some(notify) = waiting_notify {
        notify.notified().await;
        // 完了後はキャッシュに入っているはず
        let c = cache.lock_cache()?;
        if let Some(peaks) = c.get(&file_path) {
            let duration = peaks.len() as f64 / PEAKS_PER_SECOND as f64;
            return Ok(WaveformData {
                peaks: peaks.clone(),
                sample_rate: PEAKS_PER_SECOND,
                source_duration: duration,
            });
        }
        return Err("波形データの生成に失敗しました".to_string());
    }

    // 処理中フラグを設定
    let notify: Arc<Notify> = Arc::new(Notify::new());
    {
        let mut in_progress = cache.lock_in_progress()?;
        in_progress.insert(file_path.clone(), Arc::clone(&notify));
    }

    let file_path_clone = file_path.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        generate_waveform(&file_path_clone)
    })
    .await
    .map_err(|e| format!("spawn_blocking エラー: {}", e))?;

    // 処理中フラグを解除し、待機中のリクエストに通知
    {
        let mut in_progress = cache.lock_in_progress()?;
        in_progress.remove(&file_path);
    }
    notify.notify_waiters();

    let peaks = result?;

    // キャッシュに保存
    {
        let mut c = cache.lock_cache()?;
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
