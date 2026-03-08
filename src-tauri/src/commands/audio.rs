use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[tauri::command]
pub async fn extract_audio(
    app_handle: tauri::AppHandle,
    file_path: String,
) -> Result<String, String> {
    let src = std::path::Path::new(&file_path);
    if !src.exists() {
        return Err(format!("ファイルが見つかりません: {}", file_path));
    }

    // 出力先: app_data_dir/extracted_audio/
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dirの取得に失敗: {}", e))?;
    let output_dir = app_data_dir.join("extracted_audio");
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("出力ディレクトリの作成に失敗: {}", e))?;

    // ファイル名: 元のファイル名 + タイムスタンプ + .m4a
    let stem = src.file_stem().unwrap_or_default().to_string_lossy();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let output_path: PathBuf = output_dir.join(format!("{}_{}.m4a", stem, timestamp));

    let output = Command::new("ffmpeg")
        .args([
            "-i",
            &file_path,
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-y",
            output_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| format!("FFmpegの起動に失敗: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("音声抽出に失敗しました: {}", stderr));
    }

    log::info!(
        "[action] extractAudio | src={} out={}",
        file_path,
        output_path.display()
    );

    Ok(output_path.to_string_lossy().to_string())
}
