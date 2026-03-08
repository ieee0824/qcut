use regex::Regex;
use std::io::BufReader;
use std::process::ChildStdout;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use super::export::ExportProgress;

pub(crate) struct ProgressParser {
    time_regex: Regex,
    total_duration: f64,
}

impl ProgressParser {
    pub(crate) fn new(total_duration: f64) -> Self {
        Self {
            time_regex: Regex::new(r"out_time_ms=(\d+)").unwrap(),
            total_duration,
        }
    }

    /// stdoutからの進捗行をパースし、進捗情報を返す
    pub(crate) fn parse_line(&self, line: &str) -> Option<(f64, f64)> {
        self.time_regex.captures(line).map(|caps| {
            let microseconds: f64 = caps[1].parse().unwrap_or(0.0);
            let current_time = microseconds / 1_000_000.0;
            let progress = if self.total_duration > 0.0 {
                (current_time / self.total_duration).min(1.0)
            } else {
                0.0
            };
            (progress, current_time)
        })
    }

    /// FFmpegのstdoutを読み取り、進捗をTauriイベントとして発行する
    pub(crate) fn run(
        &self,
        app_handle: &AppHandle,
        stdout: ChildStdout,
        cancel_flag: &Arc<AtomicBool>,
    ) {
        let reader = BufReader::new(stdout);

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

        loop {
            if cancel_flag.load(Ordering::SeqCst) {
                break;
            }

            match rx.recv_timeout(std::time::Duration::from_millis(200)) {
                Ok(line) => {
                    if let Some((progress, current_time)) = self.parse_line(&line) {
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
                    continue;
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    }
}
