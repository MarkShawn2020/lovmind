# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lovmind is a floating notes app with global hotkey access, built as a Tauri v2 + React + TypeScript desktop application. It features:
- **Global Hotkey**: `⌘N` (Mac) / `Ctrl+N` (Windows/Linux) to toggle the app from anywhere
- **Floating Window**: Always-on-top, frameless window with transparency support
- **Rich Text Editor**: Powered by Plate.js (Slate-based) with WYSIWYG editing
- **Multi-Window Architecture**: Main window + separate float windows for each note
- **Stack**: React 19, TypeScript, Tauri v2, Rust backend
- **Package Manager**: pnpm

## Essential Commands

### Development
```bash
pnpm tauri dev        # Start Tauri app (runs frontend + backend)
pnpm dev             # Start only frontend dev server (Vite on :1420)
pnpm typecheck       # Type check TypeScript without building
pnpm build           # Type check + build frontend for production
pnpm tauri build     # Build complete application binary
pnpm build:dmg       # Build macOS .dmg installer only
```

### Version Management
```bash
pnpm version:patch   # Bump version and sync to Cargo.toml
pnpm version:minor   # Bump minor version
pnpm version:major   # Bump major version
pnpm release         # Run semantic-release
```

### Rust Backend
```bash
cd src-tauri && cargo build   # Build Rust backend
cd src-tauri && cargo test    # Run Rust tests
cd src-tauri && cargo fmt     # Format Rust code
```

## Architecture

### Multi-Window System
The app uses **two window types**:
1. **Main Window** (`index.html` → `App.tsx`): Floating quick-capture UI
   - Always-on-top, frameless, transparent
   - Shows input area + recent notes list
   - Toggled via `⌘N` global shortcut
2. **Float Windows** (`editor.html` → `editor.tsx`): Full note editing
   - Dynamically created via `new WebviewWindow()`
   - Each note opens in its own window
   - Uses Plate.js rich text editor

### Frontend Structure
- **src/App.tsx**: Main floating window component (quick capture + notes list)
- **src/editor.tsx**: Standalone float window component
- **src/components/RenderingWysiwygEditor.tsx**: Plate.js editor integration
- **src/components/editor/plugins/**: Plate.js plugin configurations (markdown, lists, code blocks, etc.)
- **src/components/ui/**: Plate.js node renderers and Radix UI components

### Backend Structure (Rust)
- **src-tauri/src/lib.rs**: Tauri setup, global shortcut registration, and command handlers
- **src-tauri/src/note_store.rs**: In-memory note storage using `Mutex<HashMap>` for inter-window communication
  - `TEMP_NOTE_STORE`: Global static store for sharing notes between windows
  - Commands: `store_temp_note`, `get_temp_note`, `get_all_temp_notes`, etc.
- **src-tauri/tauri.conf.json**: Window configuration (size: 420×640, alwaysOnTop, frameless)

### Inter-Window Communication
Notes are synchronized between windows using:
1. **Rust Global Store**: `TEMP_NOTE_STORE` (Mutex-protected HashMap)
2. **Tauri Events**: `broadcast_note_update` emits `global-note-updated` events
3. **Event Listeners**: Windows listen via `listen("global-note-updated", ...)`

### Frontend-Backend Communication
- Frontend calls Rust via `invoke("command_name", { args })` from `@tauri-apps/api/core`
- All Tauri commands are marked with `#[tauri::command]` and registered in `lib.rs:128-143`
- Available commands: `toggle_window`, `create_note`, `store_temp_note`, `get_all_temp_notes`, `broadcast_note_update`, etc.

## Key Configuration

### Window Behavior (tauri.conf.json)
- Main window: 420×640, always-on-top, frameless, transparent
- `macOSPrivateApi: true` enables advanced window features on macOS
- Global shortcut registered in `lib.rs:149` using `tauri-plugin-global-shortcut`

### Multi-Page Build (vite.config.ts)
```typescript
rollupOptions: {
  input: {
    main: 'index.html',    // Main window
    editor: 'editor.html'  // Float windows
  }
}
```

### Code Inspector (Development Tool)
- **Plugin**: `@neurora/code-inspector-plugin` in `vite.config.ts`
- **Usage**: Press `Option + Shift` (Mac) or `Alt + Shift` (Windows), then click any element to open its source in the IDE
- **Enabled**: Development mode only

## Semantic Versioning & Git
- Uses **semantic-release** with conventional commits
- **Commitizen** configured for standardized commit messages
- Version syncing: `scripts/sync-version.js` keeps package.json and Cargo.toml versions in sync
- **Husky** hooks enforce commit message format

## Important Technical Details
- App identifier: `dev.neurora.lovpen-notes`
- Frontend dev server: `http://localhost:1420`
- Tauri plugins: `global-shortcut`, `opener`, `store`
- Rust dependencies: `serde`, `chrono`, `uuid`, `once_cell` for global state