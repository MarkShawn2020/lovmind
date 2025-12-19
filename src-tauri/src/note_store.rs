use chrono::{DateTime, Local, Utc};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempNote {
    pub id: String,
    pub text: String,
    pub title: String,
    pub time: String,
    pub tags: Vec<String>,
    pub favorite: Option<bool>,
    pub pinned: Option<bool>,
    pub archived: Option<bool>,
    #[serde(rename = "richContent")]
    pub rich_content: Option<serde_json::Value>,
    pub rank: Option<i32>,
    #[serde(rename = "manualTitle")]
    pub manual_title: Option<bool>,
    #[serde(rename = "isDraft")]
    pub is_draft: Option<bool>,
    #[serde(rename = "submittedAt")]
    pub submitted_at: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
}

#[tauri::command]
pub fn store_temp_note(app: AppHandle, note: TempNote) -> Result<(), String> {
    let store = app.store("notes.json").map_err(|e| e.to_string())?;

    // Get existing notes
    let mut notes: Vec<TempNote> = store
        .get("notes")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    // Update or insert note
    if let Some(pos) = notes.iter().position(|n| n.id == note.id) {
        notes[pos] = note;
    } else {
        notes.push(note);
    }

    // Save back to store
    store.set(
        "notes",
        serde_json::to_value(&notes).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_temp_note(app: AppHandle, id: String) -> Result<Option<TempNote>, String> {
    let store = app.store("notes.json").map_err(|e| e.to_string())?;
    let notes: Vec<TempNote> = store
        .get("notes")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    Ok(notes.into_iter().find(|n| n.id == id))
}

#[tauri::command]
pub fn remove_temp_note(app: AppHandle, id: String) -> Result<(), String> {
    let store = app.store("notes.json").map_err(|e| e.to_string())?;
    let mut notes: Vec<TempNote> = store
        .get("notes")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    notes.retain(|n| n.id != id);

    store.set(
        "notes",
        serde_json::to_value(&notes).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_all_temp_notes(app: AppHandle) -> Result<Vec<TempNote>, String> {
    let store = app.store("notes.json").map_err(|e| e.to_string())?;
    let notes: Vec<TempNote> = store
        .get("notes")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    Ok(notes)
}

#[tauri::command]
pub fn clear_temp_notes(app: AppHandle) -> Result<(), String> {
    let store = app.store("notes.json").map_err(|e| e.to_string())?;
    store.set("notes", serde_json::json!([]));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Check if an ISO date string (UTC) matches today's local date
fn is_today_local(iso_str: &str) -> bool {
    // Parse ISO string as UTC, convert to local, compare date
    if let Ok(utc_time) = iso_str.parse::<DateTime<Utc>>() {
        let local_time = utc_time.with_timezone(&Local);
        let today = Local::now().date_naive();
        return local_time.date_naive() == today;
    }
    false
}

/// Count notes submitted today (non-draft notes with submitted_at date matching today)
pub fn count_today_notes(app: &AppHandle) -> usize {
    let store = match app.store("notes.json") {
        Ok(s) => s,
        Err(_) => return 0,
    };

    let notes: Vec<TempNote> = store
        .get("notes")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    notes
        .iter()
        .filter(|n| {
            // Only count non-draft notes
            if n.is_draft.unwrap_or(false) {
                return false;
            }
            // Check submitted_at date
            if let Some(ref submitted) = n.submitted_at {
                return is_today_local(submitted);
            }
            // Fallback to created_at
            if let Some(ref created) = n.created_at {
                return is_today_local(created);
            }
            false
        })
        .count()
}
