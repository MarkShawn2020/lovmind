import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

import { isTauri } from '@/utils/tauri';

/**
 * Sets up Tauri-specific window event listeners
 * Handles:
 * - toggle-window event
 * - Developer tools keyboard shortcut (Cmd/Ctrl+Shift+I)
 */
export function useTauriWindowEvents() {
  useEffect(() => {
    if (!isTauri()) {
      console.log('Not running in Tauri environment, skipping event listeners');
      return;
    }

    // Listen for window toggle events
    const unlisten = listen('toggle-window', () => {
      console.log('Window toggled');
    });

    // Keyboard shortcut for developer tools
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        try {
          const { getCurrentWebviewWindow } = await import(
            '@tauri-apps/api/webviewWindow'
          );
          const currentWindow = getCurrentWebviewWindow();
          await invoke('open_devtools', { window: currentWindow });
        } catch (error) {
          console.error('Failed to open devtools:', error);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      unlisten.then((fn) => fn());
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
