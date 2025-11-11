/**
 * Check if running in Tauri environment
 */
export const isTauri = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    ((window as any).__TAURI__ !== undefined ||
      (window as any).__TAURI_INTERNALS__ !== undefined)
  );
};

/**
 * Show a confirmation dialog using native Tauri dialog or browser fallback
 */
export const confirmDialog = async (
  message: string,
  options?: {
    title?: string;
    okLabel?: string;
    cancelLabel?: string;
  }
): Promise<boolean> => {
  if (isTauri()) {
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      return await ask(message, {
        title: options?.title || '确认',
        kind: 'warning',
        okLabel: options?.okLabel || '确定',
        cancelLabel: options?.cancelLabel || '取消',
      });
    } catch (error) {
      console.error('Failed to show Tauri dialog, falling back to browser confirm:', error);
      return window.confirm(message);
    }
  } else {
    return window.confirm(message);
  }
};
