import { useCallback } from 'react';
import {
  WebviewWindow,
  getAllWebviewWindows,
} from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Note } from '../store';
import { isTauri } from '../utils/tauri';
import { WINDOW_CONFIG } from '../constants/window';

/**
 * Custom hook for window operations
 * Handles window dragging and opening editor windows
 */
export const useWindowOperations = (notes: Note[], setNotes: (notes: Note[] | ((prev: Note[]) => Note[])) => void) => {
  /**
   * Handle window dragging by header
   */
  const handleHeaderMouseDown = useCallback(async () => {
    if (!isTauri()) return;

    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      console.error('Failed to start dragging:', error);
    }
  }, []);

  /**
   * Open a note in a new editor window
   */
  const openNoteInNewWindow = useCallback(
    async (note: Note) => {
      if (!isTauri()) {
        // Browser environment: use window.open
        console.log('Opening in browser environment:', note.id);
        const url = `/?window=editor&noteId=${note.id}`;
        window.open(url, `note-editor-${note.id}`, 'width=600,height=500');
        return;
      }

      try {
        // Check if window already exists
        const windowLabel = `note-editor-${note.id}`;
        const existingWindows = await getAllWebviewWindows();
        const existingWindow = existingWindows.find(
          (w) => w.label === windowLabel
        );

        if (existingWindow) {
          // Focus existing window
          await existingWindow.setFocus();
          console.log('Focusing existing window for note:', note.id);
          return;
        }

        // Check backend for existing note data
        let noteToOpen: Note;
        try {
          const backendNote = await invoke<Note | null>('get_temp_note', {
            id: note.id,
          });
          if (backendNote) {
            console.log('Found existing note in backend:', note.id);
            noteToOpen = backendNote;
            // Sync state with backend data
            setNotes((prevNotes) =>
              prevNotes.map((n) => (n.id === note.id ? backendNote : n))
            );
          } else {
            // Use current note data if not in backend
            noteToOpen = notes.find((n) => n.id === note.id) || note;
            await invoke('store_temp_note', { note: noteToOpen });
            console.log('Stored new note to backend:', note.id);
          }
        } catch (error) {
          console.error('Error checking backend storage:', error);
          // Fallback to current data
          noteToOpen = notes.find((n) => n.id === note.id) || note;
          await invoke('store_temp_note', { note: noteToOpen });
        }

        // Determine URL based on environment
        const isDev = window.location.protocol === 'http:';
        const url = isDev
          ? `http://localhost:1420/?window=editor&noteId=${note.id}`
          : `index.html?window=editor&noteId=${note.id}`;

        console.log('Opening window with URL:', url);

        // Create new editor window
        const webview = new WebviewWindow(windowLabel, {
          url: url,
          title: `Edit: ${noteToOpen.title}`,
          width: WINDOW_CONFIG.EDITOR.WIDTH,
          height: WINDOW_CONFIG.EDITOR.HEIGHT,
          minWidth: WINDOW_CONFIG.EDITOR.MIN_WIDTH,
          minHeight: WINDOW_CONFIG.EDITOR.MIN_HEIGHT,
          resizable: true,
          center: true,
          alwaysOnTop: false,
          focus: true,
          skipTaskbar: false,
          decorations: false,
          transparent: true,
        });

        // Ensure window gets focus
        await webview.once('tauri://created', async () => {
          await webview.setFocus();
          console.log('Editor window created and focused for note:', note.id);
        });
      } catch (error) {
        console.error('Failed to open editor window:', error);
        alert(`Failed to open editor window: ${error}`);
      }
    },
    [notes, setNotes]
  );

  return {
    handleHeaderMouseDown,
    openNoteInNewWindow,
  };
};
