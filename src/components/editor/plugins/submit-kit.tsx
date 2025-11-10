'use client';

import { createPlatePlugin, type KeyboardHandler } from 'platejs/react';

export const createSubmitPlugin = (onSubmit?: () => void) =>
  createPlatePlugin({
    key: 'submit',
    handlers: {
      onKeyDown: (({ editor, event }) => {
        // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          if (onSubmit) {
            event.preventDefault();
            event.stopPropagation();
            onSubmit();
            return true; // Signal that we handled the event
          }
        }
        return false; // Let other handlers process
      }) as KeyboardHandler,
    },
  });
