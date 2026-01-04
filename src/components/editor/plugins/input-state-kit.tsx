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
    // Flag to suppress input-state-changed events during programmatic updates
    let isProgrammaticUpdate = false;
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
      // Wrap a function to suppress input-state-changed events during execution
      withSuppression<T>(fn: () => T): T {
        isProgrammaticUpdate = true;
        try {
          return fn();
        } finally {
          isProgrammaticUpdate = false;
        }
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

    // Helper to emit typing state
    const emitTypingStart = () => {
      if (!isComposing && editor.selection) {
        emitInputStateChange({
          isInputting: true,
          reason: 'typing-start',
          isFocused: true,
        });
        scheduleTypingStop();
      }
    };

    // Intercept insertText to track typing
    const originalInsertText = editor.insertText;
    editor.insertText = (text: string) => {
      emitTypingStart();
      (originalInsertText as (text: string) => void)(text);
    };

    // Intercept deleteBackward to track backspace
    const originalDeleteBackward = editor.deleteBackward;
    editor.deleteBackward = (unit: any) => {
      emitTypingStart();
      (originalDeleteBackward as (unit: any) => void)(unit);
    };

    // Intercept deleteForward to track delete key
    const originalDeleteForward = editor.deleteForward;
    editor.deleteForward = (unit: any) => {
      emitTypingStart();
      (originalDeleteForward as (unit: any) => void)(unit);
    };

    // Intercept apply to track ALL changes (checkbox toggles, drag-drop, etc.)
    const originalApply = editor.apply;
    editor.apply = (operation: any) => {
      // Skip emitting events during programmatic updates (e.g., setValue)
      if (isProgrammaticUpdate) {
        (originalApply as (op: any) => void)(operation);
        return;
      }

      // CRITICAL: Apply operation FIRST, then emit event
      // This ensures editor.children has the updated content when useEditorSync reads it
      (originalApply as (op: any) => void)(operation);

      // Only emit for operations that modify content (not selection-only changes)
      // Note: Don't check editor.selection here because checkbox clicks happen
      // outside the editable area and selection may be null
      if (operation.type !== 'set_selection') {
        if (!isComposing) {
          emitInputStateChange({
            isInputting: true,
            reason: 'typing-start',
            isFocused: editor.selection !== null,
          });
          scheduleTypingStop();
        }
      }
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
    withSuppression: <T>(fn: () => T) => T;
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
    onFocusLost: () => void;
    onFocusGained: () => void;
  };
}
