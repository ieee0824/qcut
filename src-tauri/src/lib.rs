use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Manager;

mod sqlite_logger;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(commands::export::ExportState {
      cancel_flag: Arc::new(AtomicBool::new(false)),
    })
    .manage(commands::waveform::WaveformCache {
      cache: std::sync::Mutex::new(HashMap::new()),
    })
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let app_version = app.config().version.clone().unwrap_or_else(|| "unknown".to_string());

      if cfg!(debug_assertions) {
        let mut log_builder = tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info);

        let app_data_dir = app.path().app_data_dir().expect("failed to get app_data_dir");
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("logs.db");

        if let Ok(sqlite_logger) = sqlite_logger::SqliteLogger::new(&db_path) {
          log_builder = log_builder.target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::Dispatch(sqlite_logger.to_fern_dispatch(app_version)),
          ));
        }

        app.handle().plugin(log_builder.build())?;
        log::info!("qcut started (debug build)");
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::video::get_video_info,
      commands::files::get_file_info,
      commands::files::open_file_dialog,
      commands::files::save_project,
      commands::files::read_project,
      commands::files::get_autosave_path,
      commands::files::delete_file,
      commands::files::list_autosaves,
      commands::files::read_recent_projects,
      commands::files::write_recent_projects,
      commands::plugins::list_plugin_dirs,
      commands::plugins::read_plugin_manifest,
      commands::plugins::read_plugin_file,
      commands::plugins::read_plugin_settings,
      commands::plugins::write_plugin_settings,
      commands::export::check_ffmpeg,
      commands::export::export_video,
      commands::export::cancel_export,
      commands::presets::read_transition_presets,
      commands::presets::write_transition_presets,
      commands::presets::read_color_presets,
      commands::presets::write_color_presets,
      commands::waveform::get_waveform,
      commands::logging::log_action,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

mod commands;

