import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

import { isTauri } from '@/utils/tauri';

/**
 * Sets up Tauri-specific window event listeners
 * Handles:
 * - toggle-window event
 * Note: DevTools shortcut (Cmd/Ctrl+Shift+I) is now handled via application menu
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

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
