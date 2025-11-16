'use client';

import { createSlatePlugin } from 'platejs';
import type { PlateEditor } from 'platejs/react';

/**
 * Tauri Clipboard Plugin
 *
 * Handles clipboard operations in Tauri environment:
 * - Mirrors copy/cut operations to Tauri system clipboard
 * - Reads from Tauri clipboard on paste
 *
 * Note: This plugin only activates in Tauri environment.
 * In browser mode, native clipboard behavior is preserved.
 */

const isTauriEnvironment = (): boolean => {
  return '__TAURI_INTERNALS__' in window || 'isTauri' in window;
};

export const TauriClipboardPlugin = createSlatePlugin({
  key: 'tauri-clipboard',
  extendEditor: ({ editor }) => {
    if (!isTauriEnvironment()) {
      console.log('[TauriClipboardPlugin] Not in Tauri environment, skipping');
      return editor;
    }

    const handleCopy = async (e: ClipboardEvent) => {
      // Check if event is from this editor
      if (!e.target || !(e.target instanceof Node)) return;

      // Only proceed if we have a selection
      if (!editor.selection) return;

      const { anchor, focus } = editor.selection;
      const isCollapsed =
        anchor.path.toString() === focus.path.toString() &&
        anchor.offset === focus.offset;

      if (isCollapsed) return;

      // Mirror to Tauri clipboard after browser handles it
      setTimeout(async () => {
        try {
          if (!e.clipboardData) return;

          const htmlData = e.clipboardData.getData('text/html');
          const textData = e.clipboardData.getData('text/plain');

          if (textData || htmlData) {
            const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
            await writeText(textData || htmlData);
            console.log('[TauriClipboardPlugin] Mirrored copy to system clipboard');
          }
        } catch (error) {
          console.error('[TauriClipboardPlugin] Failed to mirror copy:', error);
        }
      }, 0);
    };

    const handleCut = async (e: ClipboardEvent) => {
      if (!e.target || !(e.target instanceof Node)) return;

      // Mirror to Tauri clipboard after browser handles it
      setTimeout(async () => {
        try {
          if (!e.clipboardData) return;

          const textData = e.clipboardData.getData('text/plain');
          const htmlData = e.clipboardData.getData('text/html');

          if (textData || htmlData) {
            const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
            await writeText(textData || htmlData);
            console.log('[TauriClipboardPlugin] Mirrored cut to system clipboard');
          }
        } catch (error) {
          console.error('[TauriClipboardPlugin] Failed to mirror cut:', error);
        }
      }, 0);
    };

    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.target || !(e.target instanceof Node)) return;

      e.preventDefault();

      try {
        const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
        const text = await readText();

        if (text) {
          editor.tf.insertText(text);
          console.log('[TauriClipboardPlugin] Pasted from system clipboard');
        }
      } catch (error) {
        console.error('[TauriClipboardPlugin] Failed to paste from clipboard:', error);
      }
    };

    // Register event listeners on document (capture phase)
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('paste', handlePaste, true);

    // Cleanup function
    const cleanup = () => {
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('paste', handlePaste, true);
    };

    // Store cleanup for unmount
    (editor as any).__tauriClipboardCleanup = cleanup;

    console.log('[TauriClipboardPlugin] Initialized');

    return editor;
  },
});
