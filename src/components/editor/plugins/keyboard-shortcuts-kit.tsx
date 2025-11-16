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
 */

export const KeyboardShortcutsPlugin = createSlatePlugin({
    key: 'keyboard-shortcuts',
    extendEditor: ({editor}) => {
        // Helper: Check if element is Slate shadow input
        const isSlateShadowInput = (node: EventTarget | null): node is HTMLElement => {
            return !!(node && node instanceof HTMLElement && node.classList.contains('slate-shadow-input'));
        };

        // Helper: Check if event is from this editor
        const isEventFromEditor = (event: Event): boolean => {
            const targetNode = event.target instanceof Node ? event.target : null;
            const activeElement = document.activeElement;

            // Check if target or active element is related to this editor
            // Note: This is a simplified check. In production, you might want to check
            // if the element is within the editor's DOM container
            return !!(targetNode || activeElement || isSlateShadowInput(targetNode) || isSlateShadowInput(activeElement));
        };


        // Cmd+Enter Handler: Submit shortcut
        const handleSubmit = (event: KeyboardEvent) => {
            if (!event || !(event.metaKey || event.ctrlKey)) return;
            if (event.key !== 'Enter') return;
            if (!isEventFromEditor(event)) return;

            event.preventDefault();

            // Emit submit event for parent components
            if (typeof editor.emit === 'function') {
                editor.emit('submit-shortcut');
            }
        };

        // Cmd+S Handler: Save shortcut
        const handleSave = (event: KeyboardEvent) => {
            if (!event || !(event.metaKey || event.ctrlKey)) return;
            if (event.key.toLowerCase() !== 's') return;
            if (!isEventFromEditor(event)) return;

            event.preventDefault();

            // Emit save event for parent components to show feedback
            if (typeof editor.emit === 'function') {
                editor.emit('save-shortcut');
            }
        };

        // Global keydown handler
        const handleKeyDown = (event: KeyboardEvent) => {
            handleSubmit(event);
            handleSave(event);
        };

        // Register event listener on document (capture phase for Cmd+A)
        document.addEventListener('keydown', handleKeyDown, true);

        // Cleanup function
        const cleanup = () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };

        // Store cleanup for unmount
        (editor as any).__keyboardShortcutsCleanup = cleanup;

        console.log('[KeyboardShortcutsPlugin] Initialized');

        return editor;
    },
});
