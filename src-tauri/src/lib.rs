use std::sync::atomic::AtomicBool;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(commands::export::ExportState {
      cancel_flag: Arc::new(AtomicBool::new(false)),
    })
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::video::get_video_info,
      commands::files::get_file_info,
      commands::files::open_file_dialog,
      commands::plugins::list_plugin_dirs,
      commands::plugins::read_plugin_manifest,
      commands::plugins::read_plugin_file,
      commands::plugins::read_plugin_settings,
      commands::plugins::write_plugin_settings,
      commands::export::check_ffmpeg,
      commands::export::export_video,
      commands::export::cancel_export,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

mod commands;

