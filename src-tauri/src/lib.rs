use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};

mod sqlite_logger;

/// ユーザーが選択したファイルのテキスト内容を返す（字幕ファイル読み込み用）
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
  std::fs::read_to_string(&path)
    .map_err(|e| format!("ファイルの読み込みに失敗: {}", e))
}

/// フロントエンドから現在の言語を受け取り、View メニューのチェック状態を同期する
#[tauri::command]
fn update_language_menu(app: tauri::AppHandle, lang: String) {
  if let Some(menu) = app.menu() {
    if let Some(item) = menu.get("view.languageJa") {
      item.as_check_menuitem().map(|i| i.set_checked(lang == "ja").ok());
    }
    if let Some(item) = menu.get("view.languageEn") {
      item.as_check_menuitem().map(|i| i.set_checked(lang == "en").ok());
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(commands::export::ExportState {
      cancel_flag: Arc::new(AtomicBool::new(false)),
    })
    .manage(commands::waveform::WaveformCache {
      cache: std::sync::Mutex::new(HashMap::new()),
      in_progress: std::sync::Mutex::new(HashMap::new()),
    })
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let app_version = app.config().version.clone().unwrap_or_else(|| "unknown".to_string());

      let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Info
      } else {
        log::LevelFilter::Warn
      };

      let mut log_builder = tauri_plugin_log::Builder::default()
        .level(log_level);

      let app_data_dir = app.path().app_data_dir().expect("failed to get app_data_dir");
      if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
        eprintln!("Failed to create app_data_dir {:?}: {}", app_data_dir, e);
      }
      let db_path = app_data_dir.join("logs.db");

      if let Ok(sqlite_logger) = sqlite_logger::SqliteLogger::new(&db_path) {
        log_builder = log_builder.target(tauri_plugin_log::Target::new(
          tauri_plugin_log::TargetKind::Dispatch(sqlite_logger.to_fern_dispatch(app_version)),
        ));
      }

      app.handle().plugin(log_builder.build())?;
      if cfg!(debug_assertions) {
        log::info!("qcut started (debug build)");
      } else {
        log::warn!("qcut started (release build)");
      }
      // OS ネイティブメニューバーを構築する
      let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
          &MenuItem::with_id(app, "file.openProject",    "Open Project...",    true, None::<&str>)?,
          &MenuItem::with_id(app, "file.saveProject",    "Save Project",       true, None::<&str>)?,
          &MenuItem::with_id(app, "file.saveProjectAs",  "Save Project As...", true, None::<&str>)?,
          &PredefinedMenuItem::separator(app)?,
          &MenuItem::with_id(app, "file.exportVideo",    "Export Video...",    true, None::<&str>)?,
          &PredefinedMenuItem::separator(app)?,
          &MenuItem::with_id(app, "file.importSubtitle", "Import Subtitle...", true, None::<&str>)?,
          &MenuItem::with_id(app, "file.exportSRT",      "Export SRT",         true, None::<&str>)?,
          &MenuItem::with_id(app, "file.exportASS",      "Export ASS",         true, None::<&str>)?,
        ],
      )?;
      let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
          &MenuItem::with_id(app, "edit.undo",  "Undo",  true, None::<&str>)?,
          &MenuItem::with_id(app, "edit.redo",  "Redo",  true, None::<&str>)?,
          &PredefinedMenuItem::separator(app)?,
          &MenuItem::with_id(app, "edit.copy",  "Copy",  true, None::<&str>)?,
          &MenuItem::with_id(app, "edit.paste", "Paste", true, None::<&str>)?,
        ],
      )?;
      let timeline_menu = Submenu::with_items(
        app,
        "Timeline",
        true,
        &[
          &MenuItem::with_id(app, "timeline.addAudioTrack", "Add Audio Track", true, None::<&str>)?,
          &MenuItem::with_id(app, "timeline.addTextTrack",  "Add Text Track",  true, None::<&str>)?,
        ],
      )?;
      // 言語選択は CheckMenuItem で現在選択中の言語をチェック状態で表示する
      // 初期値は ja（起動後にフロントエンドから update_language_menu で正確な状態に同期される）
      let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
          &CheckMenuItem::with_id(app, "view.languageJa", "日本語", true, true,  None::<&str>)?,
          &CheckMenuItem::with_id(app, "view.languageEn", "English", true, false, None::<&str>)?,
        ],
      )?;
      let plugins_menu = Submenu::with_items(
        app,
        "Plugins",
        true,
        &[
          &MenuItem::with_id(app, "plugins.manager", "Plugin Manager...", true, None::<&str>)?,
        ],
      )?;
      let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
          &MenuItem::with_id(app, "help.shortcuts", "Keyboard Shortcuts", true, None::<&str>)?,
        ],
      )?;
      let menu = Menu::with_items(
        app,
        &[&file_menu, &edit_menu, &timeline_menu, &view_menu, &plugins_menu, &help_menu],
      )?;
      app.set_menu(menu)?;
      app.on_menu_event(|app, event| {
        let id = event.id.as_ref();
        // 言語切替時はチェック状態をメニュー側でも更新する
        if id == "view.languageJa" || id == "view.languageEn" {
          if let Some(menu) = app.menu() {
            if let Some(item) = menu.get("view.languageJa") {
              item.as_check_menuitem().map(|i| i.set_checked(id == "view.languageJa").ok());
            }
            if let Some(item) = menu.get("view.languageEn") {
              item.as_check_menuitem().map(|i| i.set_checked(id == "view.languageEn").ok());
            }
          }
        }
        app.emit("menu-event", id).ok();
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      read_text_file,
      update_language_menu,
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
      commands::plugins::verify_plugin_integrity,
      commands::plugins::import_plugin,
      commands::plugins::delete_plugin,
      commands::export::check_ffmpeg,
      commands::export::export_video,
      commands::export::cancel_export,
      commands::export::get_export_formats,
      commands::presets::read_transition_presets,
      commands::presets::write_transition_presets,
      commands::presets::read_color_presets,
      commands::presets::write_color_presets,
      commands::presets::read_effect_presets,
      commands::presets::write_effect_presets,
      commands::waveform::get_waveform,
      commands::logging::log_action,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

mod commands;


