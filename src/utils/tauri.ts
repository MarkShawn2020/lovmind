import React, { createElement } from 'react';
import { createRoot } from 'react-dom/client';

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
 * Icon render function type
 */
export type IconRenderFn = () => React.ReactElement;

/**
 * Show a confirmation dialog using custom React dialog or native Tauri dialog fallback
 */
export const confirmDialog = async (
  message: string,
  options?: {
    title?: string;
    okLabel?: string;
    cancelLabel?: string;
    icon?: IconRenderFn;
    variant?: 'default' | 'destructive';
  }
): Promise<boolean> => {
  // If custom icon is provided, use React-based dialog
  if (options?.icon) {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      const cleanup = () => {
        root.unmount();
        document.body.removeChild(container);
      };

      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      // Dynamically import the AlertDialog components to avoid circular dependencies
      import('@/components/ui/alert-dialog').then(
        ({
          AlertDialog,
          AlertDialogAction,
          AlertDialogCancel,
          AlertDialogContent,
          AlertDialogDescription,
          AlertDialogFooter,
          AlertDialogHeader,
          AlertDialogTitle,
        }) => {
          const iconElement = options.icon ? options.icon() : null;

          root.render(
            createElement(
              AlertDialog,
              { open: true, onOpenChange: (open: boolean) => !open && handleCancel() },
              createElement(
                AlertDialogContent,
                {},
                createElement(
                  AlertDialogHeader,
                  {},
                  iconElement && createElement(
                    'div',
                    { className: 'flex justify-center mb-2' },
                    iconElement
                  ),
                  createElement(AlertDialogTitle, {}, options.title || '确认'),
                  createElement(AlertDialogDescription, {}, message)
                ),
                createElement(
                  AlertDialogFooter,
                  {},
                  createElement(
                    AlertDialogCancel,
                    { onClick: handleCancel },
                    options.cancelLabel || '取消'
                  ),
                  createElement(
                    AlertDialogAction,
                    {
                      onClick: handleConfirm,
                      className:
                        options.variant === 'destructive'
                          ? 'bg-destructive text-white hover:bg-destructive/90 shadow-sm'
                          : '',
                    },
                    options.okLabel || '确定'
                  )
                )
              )
            )
          );
        }
      );
    });
  }

  // Use native Tauri dialog when available and no custom icon
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
