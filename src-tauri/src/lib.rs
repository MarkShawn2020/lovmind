use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
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
async fn toggle_editor_windows(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{Manager, WebviewWindowBuilder, WebviewUrl};

    // Get all windows
    let windows = app.webview_windows();

    // Filter for editor windows (those starting with "note-editor-")
    let editor_windows: Vec<_> = windows.iter()
        .filter(|(label, _)| label.starts_with("note-editor-"))
        .map(|(_, window)| window.clone())
        .collect();

    if editor_windows.is_empty() {
        // No editor windows exist, create a new blank one
        let note_id = Uuid::new_v4().to_string();
        let window_label = format!("note-editor-{}", note_id);

        // Create a blank note
        let blank_note = note_store::TempNote {
            id: note_id.clone(),
            text: String::new(),
            title: "Untitled Note".to_string(),
            time: chrono::Utc::now().to_rfc3339(),
            tags: Vec::new(),
            favorite: Some(false),
            pinned: Some(false),
            rich_content: None,
        };

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

        // Create new editor window
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

    // Editor windows exist, toggle their visibility
    let any_visible = editor_windows.iter()
        .any(|w| w.is_visible().unwrap_or(false));

    // Toggle all editor windows based on current state
    for window in editor_windows {
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
            toggle_editor_windows,
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

            // Create App menu with Quit option (macOS standard)
            let app_menu = SubmenuBuilder::new(app, "Lovmind")
                .text("version", format!("Version {}", version))
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

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&ai_toggle)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            let app_handle = app.handle().clone();
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
                }
            });

            // Register global shortcuts
            let window = app.get_webview_window("main").unwrap();
            let window_clone_main = window.clone();
            let app_handle_editors = app.handle().clone();

            // Cmd+N: Toggle editor windows
            let shortcut_cmd_n = Shortcut::new(Some(Modifiers::SUPER), Code::KeyN);
            // Cmd+O: Toggle main window
            let shortcut_cmd_o = Shortcut::new(Some(Modifiers::SUPER), Code::KeyO);

            app.global_shortcut().on_shortcuts(
                vec![shortcut_cmd_n.clone(), shortcut_cmd_o.clone()],
                move |app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        // Cmd+N: Toggle editor windows
                        if shortcut == &Shortcut::new(Some(Modifiers::SUPER), Code::KeyN) {
                            let app_clone = app_handle_editors.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = toggle_editor_windows(app_clone).await;
                            });
                        }
                        // Cmd+O: Toggle main window
                        else if shortcut == &Shortcut::new(Some(Modifiers::SUPER), Code::KeyO) {
                            let _ = window_clone_main.emit("toggle-window", ());
                            if window_clone_main.is_visible().unwrap_or(false) {
                                let _ = window_clone_main.hide();
                            } else {
                                let _ = window_clone_main.show();
                                let _ = window_clone_main.set_focus();
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}