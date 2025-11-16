'use client';

import { createSlatePlugin } from 'platejs';
import type { PlateEditor } from 'platejs/react';

/**
 * Input State Tracking Plugin
 *
 * Tracks editor input state including:
 * - Typing start/stop (debounced)
 * - IME composition start/end
 * - Focus state
 *
 * Emits events that can be consumed by parent components.
 */

export type InputStateReason =
  | 'typing-start'      // User started typing
  | 'typing-stop'       // User stopped typing (debounced)
  | 'composition-start' // IME input began
  | 'composition-end'   // IME input ended
  | 'focus-lost'        // Editor lost focus
  | 'focus-only';       // Editor focused but no typing yet

export interface InputState {
  isInputting: boolean;
  reason: InputStateReason;
  isFocused: boolean;
}

const TYPING_STOP_DEBOUNCE_MS = 1000;

export const InputStatePlugin = createSlatePlugin({
  key: 'input-state',
  extendEditor: ({ editor }) => {
    let isComposing = false;
    let typingTimeout: NodeJS.Timeout | null = null;
    let lastState: InputState = {
      isInputting: false,
      reason: 'focus-lost',
      isFocused: false,
    };

    const clearTypingTimeout = () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
    };

    const scheduleTypingStop = () => {
      clearTypingTimeout();
      typingTimeout = setTimeout(() => {
        if (lastState.isInputting) {
          emitInputStateChange({
            isInputting: false,
            reason: 'typing-stop',
            isFocused: editor.selection !== null,
          });
        }
      }, TYPING_STOP_DEBOUNCE_MS);
    };

    const emitInputStateChange = (state: InputState) => {
      lastState = state;
      // Emit custom event for parent components to listen
      if (typeof editor.emit === 'function') {
        editor.emit('input-state-changed', state);
      }
    };

    // Extend editor API with input state methods
    (editor.api as any).inputState = {
      get current() {
        return lastState;
      },
      onCompositionStart() {
        isComposing = true;
        clearTypingTimeout();
        emitInputStateChange({
          isInputting: true,
          reason: 'composition-start',
          isFocused: true,
        });
      },
      onCompositionEnd() {
        isComposing = false;
        emitInputStateChange({
          isInputting: true,
          reason: 'composition-end',
          isFocused: true,
        });
        scheduleTypingStop();
      },
      onFocusLost() {
        clearTypingTimeout();
        emitInputStateChange({
          isInputting: false,
          reason: 'focus-lost',
          isFocused: false,
        });
      },
      onFocusGained() {
        emitInputStateChange({
          isInputting: false,
          reason: 'focus-only',
          isFocused: true,
        });
      },
    };

    // Intercept insertText to track typing
    const originalInsertText = editor.insertText;
    editor.insertText = (text: string) => {
      if (!isComposing && editor.selection) {
        emitInputStateChange({
          isInputting: true,
          reason: 'typing-start',
          isFocused: true,
        });
        scheduleTypingStop();
      }
      (originalInsertText as (text: string) => void)(text);
    };

    // Cleanup on unmount
    const cleanup = () => {
      clearTypingTimeout();
    };

    // Store cleanup function
    (editor as any).__inputStateCleanup = cleanup;

    return editor;
  },
});

// TypeScript declaration for editor.api.inputState
export interface InputStateApi {
  inputState: {
    current: InputState;
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
    onFocusLost: () => void;
    onFocusGained: () => void;
  };
}
