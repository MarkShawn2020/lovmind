/**
 * Window configuration constants
 * Shared between main window and editor windows
 *
 * NOTE: Main window configuration must be kept in sync with src-tauri/tauri.conf.json
 * Editor window configuration is used by useWindowOperations hook
 */

export const WINDOW_CONFIG = {
  // Main window (create mode)
  // Must match src-tauri/tauri.conf.json > app.windows[0]
  MAIN: {
    WIDTH: 360 as number,
    HEIGHT: 480 as number,
    MIN_WIDTH: 320 as number,
    MIN_HEIGHT: 240 as number,
  },
  // Editor window (edit mode)
  // Used by useWindowOperations.ts
  EDITOR: {
    WIDTH: 360 as number,
    HEIGHT: 480 as number,
    MIN_WIDTH: 320 as number,
    MIN_HEIGHT: 240 as number,
  },
};
