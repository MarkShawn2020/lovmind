'use client';

import { createSlatePlugin } from 'platejs';

/**
 * Editor Commands Plugin
 *
 * Provides high-level command APIs for external components:
 * - resetAndFocus: Clear editor content and focus
 *
 * These commands can be accessed via editor.api.commands
 * and are exposed to external components through useImperativeHandle.
 */

export const EditorCommandsPlugin = createSlatePlugin({
  key: 'editor-commands',
  extendEditor: ({ editor }) => {
    (editor.api as any).commands = {
      resetAndFocus: () => {
        editor.tf.setValue([{ type: 'p', children: [{ text: '' }] }]);
        requestAnimationFrame(() => {
          try {
            editor.tf.select({ path: [0, 0], offset: 0 });
            editor.tf.focus();
          } catch (error) {
            console.error('[EditorCommandsPlugin] Failed to set selection:', error);
            editor.tf.focus();
          }
        });
      },
    };

    return editor;
  },
});
