use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{Emitter, Manager, WindowEvent, menu::{MenuBuilder, CheckMenuItemBuilder, SubmenuBuilder, PredefinedMenuItem}};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_store::StoreExt;
use uuid::Uuid;
use std::fs;

mod note_store;
use note_store::{store_temp_note, get_temp_note, remove_temp_note, get_all_temp_notes, clear_temp_notes};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    id: String,
    content: String,
    title: Option<String>,
    tags: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    version: u32,
    parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteVersion {
    id: String,
    note_id: String,
    content: String,
    version: u32,
    created_at: DateTime<Utc>,
}

#[tauri::command]
async fn toggle_window(window: tauri::Window) -> Result<(), String> {
    if window.is_visible().unwrap_or(false) {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn create_note(
    content: String,
    title: Option<String>,
    tags: Vec<String>,
) -> Result<Note, String> {
    let note = Note {
        id: Uuid::new_v4().to_string(),
        content,
        title,
        tags,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        version: 1,
        parent_id: None,
    };
    
    // TODO: Save to database
    
    Ok(note)
}

#[tauri::command]
async fn get_recent_notes(_days: u32) -> Result<Vec<Note>, String> {
    // TODO: Fetch from database
    Ok(Vec::new())
}

#[tauri::command]
async fn resume_note(_note_id: String) -> Result<Note, String> {
    // TODO: Fetch note and update timestamp
    Err("Not implemented".to_string())
}

#[tauri::command]
async fn branch_note(_note_id: String) -> Result<Note, String> {
    // TODO: Create a new version/branch of the note
    Err("Not implemented".to_string())
}

#[tauri::command]
async fn get_note_history(_note_id: String) -> Result<Vec<NoteVersion>, String> {
    // TODO: Fetch version history from database
    Ok(Vec::new())
}

#[tauri::command]
async fn generate_title_and_tags(content: String) -> Result<(String, Vec<String>), String> {
    // TODO: Integrate with LLM API
    // For now, extract title from first line (matching web behavior)
    let first_line = content
        .lines()
        .next()
        .unwrap_or("")
        .chars()
        .take(50)
        .collect::<String>();

    let title = if first_line.is_empty() {
        "Untitled Note".to_string()
    } else {
        first_line
    };

    let tags = if content.contains('#') {
        vec!["markdown".to_string()]
    } else {
        vec!["text".to_string()]
    };

    Ok((title, tags))
}

#[tauri::command]
async fn open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        window.open_devtools();
        Ok(())
    }
    
    #[cfg(not(debug_assertions))]
    {
        Err("Developer tools are only available in debug builds".to_string())
    }
}

#[tauri::command]
async fn broadcast_note_update(app: tauri::AppHandle, note: note_store::TempNote) -> Result<(), String> {
    // Emit specifically to the main window
    if let Some(main_window) = app.get_webview_window("main") {
        main_window.emit("global-note-updated", &note).map_err(|e| e.to_string())?;
        println!("Emitted note update to main window: {}", note.id);
    } else {
        println!("Main window not found, broadcasting to all windows");
        app.emit("global-note-updated", &note).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn save_uploaded_file(
    app: tauri::AppHandle,
    file_name: String,
    file_data: Vec<u8>,
) -> Result<String, String> {
    // Get app data directory
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let uploads_dir = app_dir.join("uploads");

    // Create uploads directory if it doesn't exist
    fs::create_dir_all(&uploads_dir).map_err(|e| e.to_string())?;

    // Generate unique filename
    let unique_name = format!("{}_{}", Uuid::new_v4(), file_name);
    let file_path = uploads_dir.join(&unique_name);

    // Write file
    fs::write(&file_path, file_data).map_err(|e| e.to_string())?;

    // Return the file path (frontend will use convertFileSrc to convert to asset:// URL)
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn is_ai_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let enabled = store.get("ai_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    Ok(enabled)
}

#[tauri::command]
async fn set_ai_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("ai_enabled", serde_json::json!(enabled));
    store.save().map_err(|e| e.to_string())?;

    // Broadcast to all windows
    app.emit("ai-enabled-changed", enabled).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn quit_app(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{Manager, WebviewWindowBuilder, WebviewUrl};

    // Check if settings window already exists
    if let Some(existing_window) = app.get_webview_window("settings") {
        let _ = existing_window.show();
        let _ = existing_window.set_focus();
        return Ok(());
    }

    // Determine URL based on environment
    #[cfg(debug_assertions)]
    let webview_url = {
        let url_str = "http://localhost:1420/?window=settings";
        WebviewUrl::External(url_str.parse().expect("Invalid URL format"))
    };

    #[cfg(not(debug_assertions))]
    let webview_url = {
        let url_str = "index.html?window=settings";
        WebviewUrl::App(url_str.into())
    };

    // Create settings window
    WebviewWindowBuilder::new(
        &app,
        "settings",
        webview_url
    )
    .title("Keyboard Shortcuts")
    .inner_size(750.0, 600.0)
    .min_inner_size(650.0, 500.0)
    .resizable(true)
    .center()
    .always_on_top(false)
    .focused(true)
    .skip_taskbar(false)
    .decorations(true)
    .transparent(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn toggle_float_windows(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{Manager, WebviewWindowBuilder, WebviewUrl};

    println!("[toggle_float_windows] Function called");

    // Get all windows
    let windows = app.webview_windows();
    println!("[toggle_float_windows] Total windows: {}", windows.len());

    // Filter for float windows (those starting with "note-editor-")
    let float_windows: Vec<_> = windows.iter()
        .filter(|(label, _)| label.starts_with("note-editor-"))
        .map(|(_, window)| window.clone())
        .collect();

    println!("[toggle_float_windows] Float windows count: {}", float_windows.len());

    if float_windows.is_empty() {
        println!("[toggle_float_windows] No float windows, creating new one...");
        // No float windows exist, create a new blank one
        let note_id = Uuid::new_v4().to_string();
        let window_label = format!("note-editor-{}", note_id);

        // Calculate rank: max existing rank + 1
        let all_notes = get_all_temp_notes(app.clone())?;
        let max_rank = all_notes.iter()
            .filter_map(|n| n.rank)
            .max()
            .unwrap_or(0);
        let new_rank = std::cmp::max(max_rank + 1, all_notes.len() as i32 + 1);

        // Create a blank note with rank
        let blank_note = note_store::TempNote {
            id: note_id.clone(),
            text: String::new(),
            title: "Untitled Note".to_string(),
            time: chrono::Utc::now().to_rfc3339(),
            tags: Vec::new(),
            favorite: Some(false),
            pinned: Some(false),
            rich_content: None,
            rank: Some(new_rank),
        };

        println!("[toggle_float_windows] Creating new note with rank: id={}, rank={}", note_id, new_rank);

        // Store the blank note
        store_temp_note(app.clone(), blank_note)?;

        // Determine URL and WebviewUrl type based on environment
        #[cfg(debug_assertions)]
        let webview_url = {
            let url_str = format!("http://localhost:1420/?window=editor&noteId={}", note_id);
            WebviewUrl::External(url_str.parse().expect("Invalid URL format"))
        };

        #[cfg(not(debug_assertions))]
        let webview_url = {
            let url_str = format!("index.html?window=editor&noteId={}", note_id);
            WebviewUrl::App(url_str.into())
        };

        // Create new float window
        WebviewWindowBuilder::new(
            &app,
            window_label,
            webview_url
        )
        .title("New Note")
        .inner_size(360.0, 480.0)
        .min_inner_size(320.0, 240.0)
        .resizable(true)
        .center()
        .always_on_top(false)
        .focused(true)
        .skip_taskbar(false)
        .decorations(false)
        .transparent(true)
        .build()
        .map_err(|e| e.to_string())?;

        return Ok(());
    }

    // Float windows exist, toggle their visibility
    let any_visible = float_windows.iter()
        .any(|w| w.is_visible().unwrap_or(false));

    // Toggle all float windows based on current state
    for window in float_windows {
        if any_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    nickname: Option<String>,
    avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    key: String,
    modifiers: Vec<String>,
    label: String,
    action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutSettings {
    shortcuts: HashMap<String, ShortcutConfig>,
}

impl Default for ShortcutSettings {
    fn default() -> Self {
        let mut shortcuts = HashMap::new();

        // Global shortcuts (system-wide)
        shortcuts.insert(
            "toggle_main_window".to_string(),
            ShortcutConfig {
                key: "KeyO".to_string(),
                modifiers: vec!["SUPER".to_string()],
                label: "Toggle Main Window".to_string(),
                action: "toggle_main_window".to_string(),
            },
        );
        shortcuts.insert(
            "toggle_float_windows".to_string(),
            ShortcutConfig {
                key: "KeyN".to_string(),
                modifiers: vec!["SUPER".to_string()],
                label: "Toggle Float Windows".to_string(),
                action: "toggle_float_windows".to_string(),
            },
        );

        // App-context shortcuts (display only, handled in frontend)
        shortcuts.insert(
            "submit_note".to_string(),
            ShortcutConfig {
                key: "Enter".to_string(),
                modifiers: vec!["SUPER".to_string()],
                label: "Submit Note".to_string(),
                action: "submit_note".to_string(),
            },
        );
        shortcuts.insert(
            "close_window".to_string(),
            ShortcutConfig {
                key: "KeyW".to_string(),
                modifiers: vec!["SUPER".to_string()],
                label: "Close Window".to_string(),
                action: "close_window".to_string(),
            },
        );
        shortcuts.insert(
            "open_devtools".to_string(),
            ShortcutConfig {
                key: "KeyI".to_string(),
                modifiers: vec!["SUPER".to_string(), "SHIFT".to_string()],
                label: "Open Developer Tools".to_string(),
                action: "open_devtools".to_string(),
            },
        );

        ShortcutSettings { shortcuts }
    }
}

#[tauri::command]
async fn get_user_profile(app: tauri::AppHandle) -> Result<Option<UserProfile>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let profile = store.get("user_profile")
        .and_then(|v| serde_json::from_value::<UserProfile>(v.clone()).ok());
    Ok(profile)
}

#[tauri::command]
async fn save_user_profile(app: tauri::AppHandle, profile: UserProfile) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("user_profile", serde_json::to_value(&profile).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_shortcut_settings(app: tauri::AppHandle) -> Result<ShortcutSettings, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let settings = store.get("shortcut_settings")
        .and_then(|v| serde_json::from_value::<ShortcutSettings>(v.clone()).ok())
        .unwrap_or_default();
    Ok(settings)
}

#[tauri::command]
async fn save_shortcut_settings(app: tauri::AppHandle, settings: ShortcutSettings) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("shortcut_settings", serde_json::to_value(&settings).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;

    // Broadcast settings change to all windows
    app.emit("shortcut-settings-changed", &settings).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn reset_shortcut_settings(app: tauri::AppHandle) -> Result<ShortcutSettings, String> {
    let default_settings = ShortcutSettings::default();
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("shortcut_settings", serde_json::to_value(&default_settings).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;

    // Broadcast settings change to all windows
    app.emit("shortcut-settings-changed", &default_settings).map_err(|e| e.to_string())?;
    Ok(default_settings)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            toggle_window,
            create_note,
            get_recent_notes,
            resume_note,
            branch_note,
            get_note_history,
            generate_title_and_tags,
            store_temp_note,
            get_temp_note,
            remove_temp_note,
            get_all_temp_notes,
            clear_temp_notes,
            open_devtools,
            broadcast_note_update,
            save_uploaded_file,
            is_ai_enabled,
            set_ai_enabled,
            quit_app,
            get_user_profile,
            save_user_profile,
            toggle_float_windows,
            get_shortcut_settings,
            save_shortcut_settings,
            reset_shortcut_settings,
            open_settings_window,
        ])
        .setup(|app| {
            // Create menu with AI toggle
            let store = app.store("settings.json").unwrap();
            let ai_enabled = store.get("ai_enabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            let ai_toggle = CheckMenuItemBuilder::new("Enable AI Features")
                .id("ai_toggle")
                .checked(ai_enabled)
                .build(app)?;

            // Get version from Cargo.toml
            let version = env!("CARGO_PKG_VERSION");

            // Create Settings menu item
            let settings_item = tauri::menu::MenuItemBuilder::new("Keyboard Shortcuts...")
                .id("keyboard_shortcuts")
                .build(app)?;

            // Create App menu with Quit option (macOS standard)
            let app_menu = SubmenuBuilder::new(app, "Lovmind")
                .text("version", format!("Version {}", version))
                .separator()
                .item(&settings_item)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            // Create Edit menu with standard clipboard operations for macOS
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            // Create Window menu with custom items for frameless window support
            // PredefinedMenuItem doesn't work reliably with decorations:false
            let close_window_item = tauri::menu::MenuItemBuilder::new("Close Window")
                .id("close_window")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;

            let minimize_window_item = tauri::menu::MenuItemBuilder::new("Minimize")
                .id("minimize_window")
                .accelerator("CmdOrCtrl+M")
                .build(app)?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&minimize_window_item)
                .item(&close_window_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .item(&ai_toggle)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app, event| {
                if event.id() == "ai_toggle" {
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        // Toggle the state
                        let store = app_clone.store("settings.json").unwrap();
                        let current = store.get("ai_enabled")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        let _ = set_ai_enabled(app_clone, !current).await;
                    });
                } else if event.id() == "keyboard_shortcuts" {
                    // Open settings window
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = open_settings_window(app_clone).await;
                    });
                } else if event.id() == "close_window" {
                    // Close the currently focused window
                    // Find focused window by iterating through all windows
                    for (_, window) in app.webview_windows() {
                        if window.is_focused().unwrap_or(false) {
                            let _ = window.close();
                            break;
                        }
                    }
                } else if event.id() == "minimize_window" {
                    // Minimize the currently focused window
                    for (_, window) in app.webview_windows() {
                        if window.is_focused().unwrap_or(false) {
                            let _ = window.minimize();
                            break;
                        }
                    }
                }
            });

            // Load and register global shortcuts from settings
            let window = app.get_webview_window("main").unwrap();
            let window_clone_main = window.clone();
            let app_handle_editors = app.handle().clone();

            // Setup main window close behavior: hide instead of destroy
            // This allows the window to be reopened via Dock icon or Cmd+Tab
            let main_window_for_close = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    println!("[Main Window] Close requested - hiding instead of destroying");
                    // Hide window instead of closing (destroying) it
                    let _ = main_window_for_close.hide();
                    api.prevent_close();
                    println!("[Main Window] Window hidden successfully");
                }
            });

            // Load shortcut settings
            let shortcut_settings = store.get("shortcut_settings")
                .and_then(|v| serde_json::from_value::<ShortcutSettings>(v.clone()).ok())
                .unwrap_or_default();

            // Parse shortcuts from settings - only register GLOBAL shortcuts
            let mut shortcuts_to_register = Vec::new();
            let global_actions = vec!["toggle_main_window", "toggle_float_windows"];

            for (action, config) in &shortcut_settings.shortcuts {
                // Skip non-global shortcuts (handled in frontend)
                if !global_actions.contains(&action.as_str()) {
                    continue;
                }

                // Parse modifiers
                let mut mods = Modifiers::empty();
                for m in &config.modifiers {
                    match m.as_str() {
                        "SUPER" | "Super" => mods |= Modifiers::SUPER,
                        "CONTROL" | "Control" => mods |= Modifiers::CONTROL,
                        "ALT" | "Alt" => mods |= Modifiers::ALT,
                        "SHIFT" | "Shift" => mods |= Modifiers::SHIFT,
                        _ => {}
                    }
                }

                // Parse key code
                if let Ok(code) = config.key.parse::<Code>() {
                    let shortcut = if mods.is_empty() {
                        Shortcut::new(None, code)
                    } else {
                        Shortcut::new(Some(mods), code)
                    };
                    shortcuts_to_register.push((action.clone(), shortcut));
                }
            }

            // Build shortcuts vec for registration
            let shortcuts_vec: Vec<Shortcut> = shortcuts_to_register.iter().map(|(_, s)| s.clone()).collect();

            app.global_shortcut().on_shortcuts(
                shortcuts_vec,
                move |_app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        // Find which action this shortcut corresponds to
                        for (action, registered_shortcut) in &shortcuts_to_register {
                            if shortcut == registered_shortcut {
                                match action.as_str() {
                                    "toggle_float_windows" => {
                                        let app_clone = app_handle_editors.clone();
                                        tauri::async_runtime::spawn(async move {
                                            let _ = toggle_float_windows(app_clone).await;
                                        });
                                    }
                                    "toggle_main_window" => {
                                        let _ = window_clone_main.emit("toggle-window", ());
                                        if window_clone_main.is_visible().unwrap_or(false) {
                                            let _ = window_clone_main.hide();
                                        } else {
                                            let _ = window_clone_main.show();
                                            let _ = window_clone_main.set_focus();
                                        }
                                    }
                                    _ => {}
                                }
                                break;
                            }
                        }
                    }
                }
            )?;
            
            // Handle window events for proper floating behavior
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::Focused(_focused) => {
                        // Optional: hide window when it loses focus
                        // if !focused {
                        //     window.hide().unwrap();
                        // }
                    }
                    _ => {}
                }
            });
            
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match event {
                // Prevent app from exiting when last window is closed (macOS behavior)
                // Only Cmd+Q (Quit menu) should exit the app
                tauri::RunEvent::ExitRequested { api, code, .. } => {
                    // If code is None, it's triggered by closing all windows
                    // If code is Some(0), it's an explicit quit (Cmd+Q)
                    if code.is_none() {
                        api.prevent_exit();
                    }
                }
                // Reopen main window when user clicks Dock icon or Cmd+Tab (macOS)
                tauri::RunEvent::Reopen { .. } => {
                    println!("[Reopen Event] Triggered - attempting to show main window");
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        println!("[Reopen Event] Main window found, showing...");
                        let _ = main_window.show();
                        let _ = main_window.set_focus();
                        println!("[Reopen Event] Main window shown and focused");
                    } else {
                        println!("[Reopen Event] ERROR: Main window not found!");
                    }
                }
                _ => {}
            }
        });
}