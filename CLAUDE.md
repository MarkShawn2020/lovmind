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
pnpm check:type      # Type check TypeScript without building
pnpm build           # Type check + build frontend for production
pnpm tauri build     # Build complete application binary
pnpm build:dmg       # Build macOS .dmg installer only
```

### Testing
```bash
pnpm test            # Run tests in watch mode
pnpm test:run        # Run tests once
pnpm test:ui         # Open Vitest UI
pnpm test:coverage   # Run tests with coverage report
```

### Version Management
```bash
pnpm version:patch   # Bump version and sync to Cargo.toml
pnpm version:minor   # Bump minor version
pnpm version:major   # Bump major version
pnpm release         # Run semantic-release
```

### Platform-Specific Builds
```bash
pnpm build:mac-universal  # Build macOS universal binary (Intel + Apple Silicon)
pnpm build:mac-intel      # Build macOS Intel binary (x86_64-apple-darwin)
pnpm build:mac-arm        # Build macOS Apple Silicon binary (aarch64-apple-darwin)
pnpm build:win-x64        # Build Windows x64 binary
pnpm build:win-arm        # Build Windows ARM64 binary
```

### Rust Backend
```bash
cd src-tauri && cargo build   # Build Rust backend
cd src-tauri && cargo test    # Run Rust tests
cd src-tauri && cargo fmt     # Format Rust code
```

## Architecture

### Multi-Window System
The app uses **single-page routing** with different window types:
1. **Main Window** (`index.html` → `App.tsx`): Floating quick-capture UI
   - Always-on-top, frameless, transparent
   - Shows input area + recent notes list
   - Toggled via global shortcut
2. **Float Windows** (`index.html?window=editor` → `FloatWindow.tsx`): Full note editing
   - Dynamically created via `new WebviewWindow()` with `?window=editor&noteId=...` URL params
   - Each note opens in its own window
   - Uses Plate.js rich text editor
3. **Settings Window** (`index.html?window=settings` → `SettingsWindow.tsx`): App settings
   - Accessed via main window settings button

### Frontend Structure
- **src/main.tsx**: Entry point with window-type routing logic (`?window=editor|settings|main`)
- **src/App.tsx**: Main window component (quick capture + notes list)
- **src/FloatWindow.tsx**: Float editor window component
- **src/SettingsWindow.tsx**: Settings window component
- **src/components/RenderingWysiwygEditor.tsx**: Plate.js editor integration
- **src/components/editor/plugins/**: Plate.js plugin configurations (markdown, lists, code blocks, etc.)
- **src/components/ui/**: Plate.js node renderers and Radix UI components
- **src/hooks/useNoteEditorController.ts**: Shared editing state and logic
- **src/store.ts**: Jotai global state management

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
- All Tauri commands are marked with `#[tauri::command]` and registered in `lib.rs`
- Key commands:
  - **Window**: `toggle_window`, `open_devtools`
  - **Notes**: `create_note`, `get_recent_notes`, `store_temp_note`, `get_temp_note`, `get_all_temp_notes`, `remove_temp_note`, `clear_temp_notes`, `broadcast_note_update`
  - **Settings**: `get_tag_merge_strategy`, `save_tag_merge_strategy`, `is_ai_enabled`, `set_ai_enabled`
  - **Files**: `save_uploaded_file` (stores files in `$APPDATA/uploads`)

## Key Configuration

### Window Behavior (tauri.conf.json)
- Main window: 420×640, resizable (min 320×300), frameless, transparent
- `macOSPrivateApi: true` enables advanced window features on macOS
- Global shortcut registered in `lib.rs` using `tauri-plugin-global-shortcut`

### Window Routing (main.tsx)
- Single `index.html` entry point
- URL parameters control which component renders:
  - `?window=main` or no params → `App.tsx`
  - `?window=editor&noteId=...` → `FloatWindow.tsx`
  - `?window=settings` → `SettingsWindow.tsx`
- StrictMode disabled for editor windows to improve perceived performance

### Code Inspector (Development Tool)
- **Plugin**: `code-inspector-plugin` in `vite.config.ts`
- **Behavior**: Copy mode for AI workflow (defaultAction: 'copy')
- **Enabled**: Development mode only (`NODE_ENV !== 'production'`)

## Semantic Versioning & Git
- Uses **semantic-release** with conventional commits
- **Commitizen** configured for standardized commit messages (`pnpm cz` or `git cz`)
- **Automated version bumping** via git hooks:
  1. `prepare-commit-msg` hook runs `scripts/bump-version.js` to analyze commit message
  2. Version bumped automatically: `feat:` → minor, `BREAKING CHANGE` or `!:` → major, others → patch
  3. Updates both `package.json` and `src-tauri/tauri.conf.json` versions
  4. `post-commit` hook auto-amends commit if version files changed
- **Husky** hooks: `prepare-commit-msg`, `post-commit`, `commit-msg` (commitlint)

## Important Technical Details
- **App identifier**: `app.lovpen.mind` (configured in `src-tauri/tauri.conf.json`)
- **Frontend dev server**: `http://localhost:1420` (fixed port, fails if unavailable)
- **Tauri plugins**: `global-shortcut`, `opener`, `store`, `dialog`
- **Rust dependencies**: `serde`, `serde_json`, `chrono`, `uuid`, `once_cell` (for global state)
- **Testing framework**: Vitest with jsdom, React Testing Library
- **File uploads**: Stored in `$APPDATA/uploads/` with UUID-prefixed filenames
- **Asset protocol**: Enabled for `$APPDATA/uploads/**` scope