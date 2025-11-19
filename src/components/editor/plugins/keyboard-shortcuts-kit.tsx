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

            // Check if target or active element is Slate shadow input
            if (isSlateShadowInput(targetNode) || isSlateShadowInput(activeElement)) {
                return true;
            }

            // Check if target is within a Slate editor
            if (targetNode instanceof Element) {
                const isInEditor = targetNode.closest('[data-slate-editor="true"]') !== null;
                if (isInEditor) return true;
            }

            // Check if active element is within a Slate editor
            if (activeElement instanceof Element) {
                const isInEditor = activeElement.closest('[data-slate-editor="true"]') !== null;
                if (isInEditor) return true;
            }

            return false;
        };

        // Deduplication: Prevent rapid duplicate events
        let lastSubmitTime = 0;
        let lastSaveTime = 0;
        const DEBOUNCE_MS = 300;

        // Cmd+Enter Handler: Submit shortcut
        const handleSubmit = (event: KeyboardEvent) => {
            if (!event || !(event.metaKey || event.ctrlKey)) return;
            if (event.key !== 'Enter') return;
            if (!isEventFromEditor(event)) return;

            // Deduplication check
            const now = Date.now();
            if (now - lastSubmitTime < DEBOUNCE_MS) {
                console.log('[KeyboardShortcuts] Ignoring duplicate Cmd+Enter (debounced)');
                return;
            }
            lastSubmitTime = now;

            event.preventDefault();
            event.stopPropagation(); // Prevent event from reaching other handlers

            // Emit submit event for parent components
            if (typeof editor.emit === 'function') {
                console.log('[KeyboardShortcuts] Emitting submit-shortcut');
                editor.emit('submit-shortcut');
            }
        };

        // Cmd+S Handler: Save shortcut
        const handleSave = (event: KeyboardEvent) => {
            if (!event || !(event.metaKey || event.ctrlKey)) return;
            if (event.key.toLowerCase() !== 's') return;
            if (!isEventFromEditor(event)) return;

            // Deduplication check
            const now = Date.now();
            if (now - lastSaveTime < DEBOUNCE_MS) {
                console.log('[KeyboardShortcuts] Ignoring duplicate Cmd+S (debounced)');
                return;
            }
            lastSaveTime = now;

            event.preventDefault();
            event.stopPropagation(); // Prevent event from reaching other handlers

            // Emit save event for parent components to show feedback
            if (typeof editor.emit === 'function') {
                console.log('[KeyboardShortcuts] Emitting save-shortcut');
                editor.emit('save-shortcut');
            }
        };

        // Global keydown handler
        const handleKeyDown = (event: KeyboardEvent) => {
            handleSubmit(event);
            handleSave(event);
        };

        // Register event listener on document (capture phase)
        document.addEventListener('keydown', handleKeyDown, true);

        console.log('[KeyboardShortcutsPlugin] Initialized, registered document listener');

        return editor;
    },
});
