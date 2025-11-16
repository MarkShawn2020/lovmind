import { useState, useCallback } from 'react';
import type { Note } from '@/store';

/**
 * Manages mobile sidebar state with auto-close wrappers for note operations
 */
export function useMobileSidebarState() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  /**
   * Wraps a callback to auto-close mobile sidebar after execution
   */
  const withSidebarClose = useCallback(<T extends any[]>(
    callback: (...args: T) => void
  ) => {
    return (...args: T) => {
      callback(...args);
      setIsMobileSidebarOpen(false);
    };
  }, []);

  return {
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    withSidebarClose,
  };
}
