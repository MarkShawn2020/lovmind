'use client';

import {createSlatePlugin} from 'platejs';

/**
 * Keyboard Shortcuts Plugin
 *
 * Handles global keyboard shortcuts:
 * - Cmd+Enter: Submit/Send shortcut
 * - Cmd+S: Save shortcut (triggers auto-save feedback)
 *
 * Emits events for parent components to handle UI feedback.
 *
 * Each editor instance registers its own handler bound to its DOM element,
 * avoiding singleton issues with React StrictMode.
 */

const isDev = process.env.NODE_ENV === 'development';

export const KeyboardShortcutsPlugin = createSlatePlugin({
    key: 'keyboard-shortcuts',
    extendEditor: ({editor}) => {
        // Store handler reference on editor for cleanup
        let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

        // Helper: Check if element is Slate shadow input
        const isSlateShadowInput = (node: EventTarget | null): node is HTMLElement => {
            return !!(node && node instanceof HTMLElement && node.classList.contains('slate-shadow-input'));
        };

        // Helper: Check if event is from THIS editor instance
        const isEventFromThisEditor = (event: Event): boolean => {
            const targetNode = event.target instanceof Node ? event.target : null;
            const activeElement = document.activeElement;

            // Get this editor's DOM node
            const editorDom = editor.api.toDOMNode?.(editor);
            if (!editorDom) return false;

            // Priority 1: Check if target or active element is within this editor's DOM
            if (targetNode instanceof Element) {
                if (editorDom.contains(targetNode)) {
                    return true;
                }
            }

            // Priority 2: Check if active element is within this editor
            if (activeElement instanceof Element) {
                if (editorDom.contains(activeElement)) {
                    return true;
                }
            }

            // Priority 3: Check Slate shadow input (for IME composition)
            if (isSlateShadowInput(targetNode) || isSlateShadowInput(activeElement)) {
                // Verify shadow input belongs to this editor by checking proximity
                const shadowInput = (isSlateShadowInput(targetNode) ? targetNode : activeElement) as HTMLElement;
                const closestEditor = shadowInput.closest('[data-slate-editor="true"]');
                if (closestEditor === editorDom) {
                    return true;
                }
            }

            return false;
        };

        // Create handler bound to this editor instance
        keydownHandler = (event: KeyboardEvent) => {
            // Skip if not a modifier key combo
            if (!(event.metaKey || event.ctrlKey)) return;

            // Only handle if event is from this editor
            if (!isEventFromThisEditor(event)) return;

            // Cmd+Enter: Submit shortcut
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();

                if (isDev) {
                    console.log('[KeyboardShortcuts] ✅ Cmd+Enter - emitting submit-shortcut');
                }

                if (typeof editor.emit === 'function') {
                    editor.emit('submit-shortcut');
                }
                return;
            }

            // Cmd+S: Save shortcut
            if (event.key.toLowerCase() === 's') {
                event.preventDefault();
                event.stopPropagation();

                if (isDev) {
                    console.log('[KeyboardShortcuts] ✅ Cmd+S - emitting save-shortcut');
                }

                if (typeof editor.emit === 'function') {
                    editor.emit('save-shortcut');
                }
                return;
            }
        };

        // Register on document with capture phase
        document.addEventListener('keydown', keydownHandler, true);

        if (isDev) {
            console.log('[KeyboardShortcuts] Handler registered for editor');
        }

        // Store cleanup function on editor
        const originalDestroy = (editor as any).destroy;
        (editor as any).destroy = () => {
            if (keydownHandler) {
                document.removeEventListener('keydown', keydownHandler, true);
                if (isDev) {
                    console.log('[KeyboardShortcuts] Handler removed for editor');
                }
                keydownHandler = null;
            }
            if (originalDestroy) {
                originalDestroy.call(editor);
            }
        };

        return editor;
    },
});
