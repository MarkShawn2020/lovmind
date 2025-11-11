use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempNote {
    pub id: String,
    pub text: String,
    pub title: String,
    pub time: String,
    pub tags: Vec<String>,
    pub favorite: Option<bool>,
    pub pinned: Option<bool>,
    #[serde(rename = "richContent")]
    pub rich_content: Option<serde_json::Value>,
}

// 全局临时存储，用于在窗口间传递数据
pub static TEMP_NOTE_STORE: Lazy<Mutex<HashMap<String, TempNote>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

#[tauri::command]
pub fn store_temp_note(note: TempNote) -> Result<(), String> {
    let mut store = TEMP_NOTE_STORE.lock().map_err(|e| e.to_string())?;
    store.insert(note.id.clone(), note);
    Ok(())
}

#[tauri::command]
pub fn get_temp_note(id: String) -> Result<Option<TempNote>, String> {
    let store = TEMP_NOTE_STORE.lock().map_err(|e| e.to_string())?;
    Ok(store.get(&id).cloned())
}

#[tauri::command]
pub fn remove_temp_note(id: String) -> Result<(), String> {
    let mut store = TEMP_NOTE_STORE.lock().map_err(|e| e.to_string())?;
    store.remove(&id);
    Ok(())
}

#[tauri::command]
pub fn get_all_temp_notes() -> Result<Vec<TempNote>, String> {
    let store = TEMP_NOTE_STORE.lock().map_err(|e| e.to_string())?;
    Ok(store.values().cloned().collect())
}

#[tauri::command]
pub fn clear_temp_notes() -> Result<(), String> {
    let mut store = TEMP_NOTE_STORE.lock().map_err(|e| e.to_string())?;
    store.clear();
    Ok(())
}