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
 * Handles window dragging and opening float windows
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
   * Open a note in a new float window
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

      console.time(`[Perf] Open window ${note.id}`);
      try {
        // Check if window already exists
        console.time(`[Perf] Check existing windows`);
        const windowLabel = `note-editor-${note.id}`;
        const existingWindows = await getAllWebviewWindows();
        const existingWindow = existingWindows.find(
          (w) => w.label === windowLabel
        );
        console.timeEnd(`[Perf] Check existing windows`);

        if (existingWindow) {
          // Focus existing window
          await existingWindow.setFocus();
          console.log('Focusing existing float window for note:', note.id);
          console.timeEnd(`[Perf] Open window ${note.id}`);
          return;
        }

        // Ensure note is in backend (NoteEditor will load it)
        // Quick fire-and-forget store to ensure data availability
        console.time(`[Perf] Store note to backend`);
        invoke('store_temp_note', { note }).catch((error) => {
          console.warn('Failed to pre-store note:', error);
        });
        console.timeEnd(`[Perf] Store note to backend`);

        // Determine URL based on environment
        const isDev = window.location.protocol === 'http:';
        const url = isDev
          ? `http://localhost:1420/?window=editor&noteId=${note.id}`
          : `index.html?window=editor&noteId=${note.id}`;

        console.log('Opening window with URL:', url);

        // Create new float window (non-blocking)
        console.time(`[Perf] Create WebviewWindow`);
        const webview = new WebviewWindow(windowLabel, {
          url: url,
          title: `Edit: ${note.title}`,
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
        console.timeEnd(`[Perf] Create WebviewWindow`);

        // Focus window asynchronously (don't block)
        webview.once('tauri://created', async () => {
          try {
            // Ensure window is shown first
            await webview.show();
            // Set focus
            await webview.setFocus();
            console.log('Float window created and focused for note:', note.id);
          } catch (error) {
            console.error('Failed to focus window after creation:', error);
          }
          console.timeEnd(`[Perf] Open window ${note.id}`);
        });
      } catch (error) {
        console.error('Failed to open float window:', error);
        console.timeEnd(`[Perf] Open window ${note.id}`);
        alert(`Failed to open float window: ${error}`);
      }
    },
    [notes, setNotes]
  );

  return {
    handleHeaderMouseDown,
    openNoteInNewWindow,
  };
};
