use std::process::Command;
use std::sync::OnceLock;

static FFMPEG_PATH: OnceLock<String> = OnceLock::new();

const SEARCH_PATHS: &[&str] = &[
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
];

pub fn ffmpeg_path() -> &'static str {
    FFMPEG_PATH.get_or_init(|| {
        // PATH 上で見つかればそれを使う
        if let Ok(output) = Command::new("which").arg("ffmpeg").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return path;
                }
            }
        }

        // よくあるインストール先を探索
        for path in SEARCH_PATHS {
            if std::path::Path::new(path).exists() {
                return path.to_string();
            }
        }

        // どこにも見つからなければフォールバック（エラーは呼び出し側で処理）
        "ffmpeg".to_string()
    })
}
