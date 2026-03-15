use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri::menu::{AboutMetadata, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};

/// カスタマイズ可能なメニューアイテムへの直接参照を保持する State
struct CustomMenuItems(Mutex<HashMap<String, MenuItem<tauri::Wry>>>);

mod sqlite_logger;

/// ユーザーが選択したファイルのテキスト内容を返す（字幕ファイル読み込み用）
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
  std::fs::read_to_string(&path)
    .map_err(|e| format!("ファイルの読み込みに失敗: {}", e))
}

/// テキストファイルを書き込む（字幕エクスポート用）
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
  std::fs::write(&path, content.as_bytes())
    .map_err(|e| format!("ファイルの書き込みに失敗: {}", e))
}

/// ネイティブメニューの accelerator を動的に更新する
#[tauri::command]
fn update_menu_accelerator(
  state: tauri::State<CustomMenuItems>,
  item_id: String,
  accelerator: Option<String>,
) -> Result<(), String> {
  let map = state.0.lock().map_err(|e| e.to_string())?;
  let mi = map.get(&item_id).ok_or_else(|| format!("item not found: {}", item_id))?;
  mi.set_accelerator(accelerator.as_deref())
    .map_err(|e| format!("set_accelerator failed: {}", e))
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
    .manage(CustomMenuItems(Mutex::new(HashMap::new())))
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
          tauri_plugin_log::TargetKind::Dispatch(sqlite_logger.to_fern_dispatch(app_version.clone())),
        ));
      }

      app.handle().plugin(log_builder.build())?;
      if cfg!(debug_assertions) {
        log::info!("qcut started (debug build)");
      } else {
        log::warn!("qcut started (release build)");
      }
      // OS ネイティブメニューバーを構築する
      // カスタマイズ可能な MenuItem は後で accelerator を更新できるよう変数に保持する
      let mi_open    = MenuItem::with_id(app, "file.openProject",    "Open Project...",    true, None::<&str>)?;
      let mi_save    = MenuItem::with_id(app, "file.saveProject",    "Save Project",       true, None::<&str>)?;
      let mi_save_as = MenuItem::with_id(app, "file.saveProjectAs",  "Save Project As...", true, None::<&str>)?;
      let mi_undo    = MenuItem::with_id(app, "edit.undo",  "Undo",  true, None::<&str>)?;
      let mi_redo    = MenuItem::with_id(app, "edit.redo",  "Redo",  true, None::<&str>)?;
      let mi_copy    = MenuItem::with_id(app, "edit.copy",  "Copy",  true, None::<&str>)?;
      let mi_paste   = MenuItem::with_id(app, "edit.paste", "Paste", true, None::<&str>)?;

      {
        let state = app.state::<CustomMenuItems>();
        let mut map = state.0.lock().unwrap();
        map.insert("file.openProject".into(),   mi_open.clone());
        map.insert("file.saveProject".into(),   mi_save.clone());
        map.insert("file.saveProjectAs".into(), mi_save_as.clone());
        map.insert("edit.undo".into(),  mi_undo.clone());
        map.insert("edit.redo".into(),  mi_redo.clone());
        map.insert("edit.copy".into(),  mi_copy.clone());
        map.insert("edit.paste".into(), mi_paste.clone());
      }

      let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
          &mi_open,
          &mi_save,
          &mi_save_as,
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
          &mi_undo,
          &mi_redo,
          &PredefinedMenuItem::separator(app)?,
          &mi_copy,
          &mi_paste,
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
      let product_name = app.config().product_name.clone().unwrap_or_else(|| "qcut".to_string());
      let app_menu = Submenu::with_items(
        app,
        &product_name,
        true,
        &[
          &PredefinedMenuItem::about(app, None, Some(AboutMetadata {
            name: Some(product_name.clone()),
            version: Some(format!("{} ({})", app_version, env!("GIT_DESCRIBE"))),
            ..Default::default()
          }))?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::services(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::hide(app, None)?,
          &PredefinedMenuItem::hide_others(app, None)?,
          &PredefinedMenuItem::show_all(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::quit(app, None)?,
        ],
      )?;
      let menu = Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &timeline_menu, &view_menu, &plugins_menu, &help_menu],
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
        if let Err(e) = app.emit("menu-event", id) {
          log::warn!("failed to emit 'menu-event' for menu id '{}': {}", id, e);
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      read_text_file,
      write_text_file,
      update_menu_accelerator,
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


