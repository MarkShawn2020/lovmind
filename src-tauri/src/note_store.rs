use chrono::{DateTime, Local, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

const NOTES_DIR_NAME: &str = "notes";
const INDEX_FILE_NAME: &str = "index.json";
const NOTE_FILE_PREFIX: &str = "note-";
const NOTE_FILE_SUFFIX: &str = ".json";
const INDEX_VERSION: u32 = 1;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NoteIndex {
    version: u32,
    notes: Vec<NoteIndexEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NoteIndexEntry {
    pub id: String,
    pub title: String,
    pub time: String,
    pub tags: Vec<String>,
    pub favorite: Option<bool>,
    pub pinned: Option<bool>,
    pub archived: Option<bool>,
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

impl Default for NoteIndex {
    fn default() -> Self {
        Self {
            version: INDEX_VERSION,
            notes: Vec::new(),
        }
    }
}

impl NoteIndexEntry {
    fn from_note(note: &TempNote) -> Self {
        Self {
            id: note.id.clone(),
            title: note.title.clone(),
            time: note.time.clone(),
            tags: note.tags.clone(),
            favorite: note.favorite,
            pinned: note.pinned,
            archived: note.archived,
            rank: note.rank,
            manual_title: note.manual_title,
            is_draft: note.is_draft,
            submitted_at: note.submitted_at.clone(),
            created_at: note.created_at.clone(),
            updated_at: note.updated_at.clone(),
        }
    }
}

fn notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let notes_dir = app_dir.join(NOTES_DIR_NAME);
    fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;
    Ok(notes_dir)
}

fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(notes_dir(app)?.join(INDEX_FILE_NAME))
}

fn note_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let filename = format!("{NOTE_FILE_PREFIX}{id}{NOTE_FILE_SUFFIX}");
    Ok(notes_dir(app)?.join(filename))
}

fn write_json_atomic(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");
    let data = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&tmp_path, data).map_err(|e| e.to_string())?;
    // On Windows, rename fails if target exists, so remove first.
    // On Unix, rename atomically replaces the target.
    #[cfg(target_os = "windows")]
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp_path, path).map_err(|e| e.to_string())?;
    Ok(())
}

fn write_note_file(app: &AppHandle, note: &TempNote) -> Result<(), String> {
    let path = note_path(app, &note.id)?;
    write_json_atomic(&path, note)
}

fn read_note_file(app: &AppHandle, id: &str) -> Result<Option<TempNote>, String> {
    let path = note_path(app, id)?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let note: TempNote = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(note))
}

fn remove_note_file(app: &AppHandle, id: &str) -> Result<(), String> {
    let path = note_path(app, id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn rebuild_index_from_files(app: &AppHandle) -> Result<NoteIndex, String> {
    let dir = notes_dir(app)?;
    let mut entries: HashMap<String, NoteIndexEntry> = HashMap::new();

    if dir.exists() {
        for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("");
            if file_name == INDEX_FILE_NAME {
                continue;
            }
            if !file_name.starts_with(NOTE_FILE_PREFIX) || !file_name.ends_with(NOTE_FILE_SUFFIX) {
                continue;
            }

            let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let note: TempNote = serde_json::from_str(&data).map_err(|e| e.to_string())?;
            entries.insert(note.id.clone(), NoteIndexEntry::from_note(&note));
        }
    }

    let notes = entries.into_values().collect();
    Ok(NoteIndex {
        version: INDEX_VERSION,
        notes,
    })
}

fn load_index_or_rebuild(app: &AppHandle) -> Result<NoteIndex, String> {
    let path = index_path(app)?;
    if !path.exists() {
        let index = rebuild_index_from_files(app)?;
        write_index(app, &index)?;
        return Ok(index);
    }

    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<NoteIndex>(&data) {
        Ok(index) if index.version == INDEX_VERSION => Ok(index),
        _ => {
            let index = rebuild_index_from_files(app)?;
            write_index(app, &index)?;
            Ok(index)
        }
    }
}

fn write_index(app: &AppHandle, index: &NoteIndex) -> Result<(), String> {
    let path = index_path(app)?;
    write_json_atomic(&path, index)
}

fn parse_notes_value(value: serde_json::Value) -> Option<Vec<TempNote>> {
    if value.is_array() {
        return serde_json::from_value(value).ok();
    }
    if let Some(raw) = value.as_str() {
        return serde_json::from_str(raw).ok();
    }
    None
}

fn load_notes_from_store(app: &AppHandle, store_name: &str, key: &str) -> Vec<TempNote> {
    let store = match app.store(store_name) {
        Ok(store) => store,
        Err(_) => return Vec::new(),
    };
    let value = match store.get(key) {
        Some(value) => value,
        None => return Vec::new(),
    };
    parse_notes_value(value).unwrap_or_default()
}

fn parse_iso_datetime(value: &Option<String>) -> Option<DateTime<Utc>> {
    value
        .as_ref()
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|dt| dt.with_timezone(&Utc))
}

fn note_last_updated(note: &TempNote) -> Option<DateTime<Utc>> {
    parse_iso_datetime(&note.updated_at)
        .or_else(|| parse_iso_datetime(&note.submitted_at))
        .or_else(|| parse_iso_datetime(&note.created_at))
}

fn is_note_newer(candidate: &TempNote, existing: &TempNote) -> bool {
    match (note_last_updated(candidate), note_last_updated(existing)) {
        (Some(candidate_ts), Some(existing_ts)) => candidate_ts > existing_ts,
        (Some(_), None) => true,
        _ => false,
    }
}

fn merge_notes(primary: Vec<TempNote>, secondary: Vec<TempNote>) -> Vec<TempNote> {
    let mut order: Vec<String> = Vec::new();
    let mut map: HashMap<String, TempNote> = HashMap::new();

    for note in primary {
        order.push(note.id.clone());
        map.insert(note.id.clone(), note);
    }

    for note in secondary {
        match map.get(&note.id) {
            Some(existing) => {
                if is_note_newer(&note, existing) {
                    map.insert(note.id.clone(), note);
                }
            }
            None => {
                order.push(note.id.clone());
                map.insert(note.id.clone(), note);
            }
        }
    }

    let mut merged = Vec::new();
    for id in order {
        if let Some(note) = map.remove(&id) {
            merged.push(note);
        }
    }

    merged
}

fn migrate_from_store_if_needed(app: &AppHandle) -> Result<(), String> {
    let dir = notes_dir(app)?;
    let index_path = index_path(app)?;

    if index_path.exists() {
        return Ok(());
    }

    let mut has_note_files = false;
    if dir.exists() {
        for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("");
            if file_name == INDEX_FILE_NAME {
                continue;
            }
            if file_name.starts_with(NOTE_FILE_PREFIX) && file_name.ends_with(NOTE_FILE_SUFFIX) {
                has_note_files = true;
                break;
            }
        }
    }

    if has_note_files {
        let index = rebuild_index_from_files(app)?;
        write_index(app, &index)?;
        return Ok(());
    }

    let notes_primary = load_notes_from_store(app, "notes.json", "notes");
    let notes_secondary = load_notes_from_store(app, "lovpen-notes.json", "lovpen-notes");
    let notes = merge_notes(notes_primary, notes_secondary);

    let mut index = NoteIndex::default();
    for note in notes {
        write_note_file(app, &note)?;
        index.notes.push(NoteIndexEntry::from_note(&note));
    }

    write_index(app, &index)?;
    Ok(())
}

#[tauri::command]
pub fn store_temp_note(app: AppHandle, note: TempNote) -> Result<(), String> {
    migrate_from_store_if_needed(&app)?;

    write_note_file(&app, &note)?;

    let mut index = load_index_or_rebuild(&app)?;
    if let Some(pos) = index.notes.iter().position(|n| n.id == note.id) {
        index.notes[pos] = NoteIndexEntry::from_note(&note);
    } else {
        index.notes.push(NoteIndexEntry::from_note(&note));
    }
    write_index(&app, &index)?;
    Ok(())
}

#[tauri::command]
pub fn get_temp_note(app: AppHandle, id: String) -> Result<Option<TempNote>, String> {
    migrate_from_store_if_needed(&app)?;
    read_note_file(&app, &id)
}

#[tauri::command]
pub fn remove_temp_note(app: AppHandle, id: String) -> Result<(), String> {
    migrate_from_store_if_needed(&app)?;

    remove_note_file(&app, &id)?;

    let mut index = load_index_or_rebuild(&app)?;
    index.notes.retain(|note| note.id != id);
    write_index(&app, &index)?;
    Ok(())
}

#[tauri::command]
pub fn get_all_temp_notes(app: AppHandle) -> Result<Vec<TempNote>, String> {
    migrate_from_store_if_needed(&app)?;

    let mut index = load_index_or_rebuild(&app)?;
    let mut missing_ids: HashSet<String> = HashSet::new();
    let mut notes: Vec<TempNote> = Vec::new();

    for entry in &index.notes {
        match read_note_file(&app, &entry.id) {
            Ok(Some(note)) => notes.push(note),
            Ok(None) => {
                missing_ids.insert(entry.id.clone());
            }
            Err(_) => {
                missing_ids.insert(entry.id.clone());
            }
        }
    }

    if !missing_ids.is_empty() {
        index.notes.retain(|entry| !missing_ids.contains(&entry.id));
        write_index(&app, &index)?;
    }

    Ok(notes)
}

#[tauri::command]
pub fn clear_temp_notes(app: AppHandle) -> Result<(), String> {
    migrate_from_store_if_needed(&app)?;

    let dir = notes_dir(&app)?;
    if dir.exists() {
        for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("");
            if file_name == INDEX_FILE_NAME {
                continue;
            }
            if file_name.starts_with(NOTE_FILE_PREFIX) && file_name.ends_with(NOTE_FILE_SUFFIX) {
                fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
        }
    }

    let index = NoteIndex::default();
    write_index(&app, &index)?;
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
    if migrate_from_store_if_needed(app).is_err() {
        return 0;
    }

    let index = match load_index_or_rebuild(app) {
        Ok(index) => index,
        Err(_) => return 0,
    };

    index
        .notes
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
