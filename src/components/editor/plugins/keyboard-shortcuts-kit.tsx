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
        // Get the editor's root DOM element for proper event scoping
        const getEditorRootElement = (): HTMLElement | null => {
            // Try to find the editor container via data-slate-editor attribute
            const slateEditor = document.querySelector(`[data-slate-editor="true"]`) as HTMLElement;
            return slateEditor || null;
        };

        // Helper: Check if element is Slate shadow input
        const isSlateShadowInput = (node: EventTarget | null): node is HTMLElement => {
            return !!(node && node instanceof HTMLElement && node.classList.contains('slate-shadow-input'));
        };

        // Helper: Check if event is from this editor (FIXED VERSION)
        const isEventFromEditor = (event: Event): boolean => {
            const target = event.target;
            if (!(target instanceof Node)) return false;

            const activeElement = document.activeElement;

            // Check if target is a Slate shadow input (iOS/mobile specific)
            if (isSlateShadowInput(target) || isSlateShadowInput(activeElement)) {
                return true;
            }

            // Check if the event target is within any Slate editor container
            // We use a more permissive check since there might be multiple editors
            // but we trust that only the focused one will emit events
            const isInSlateEditor = !!(
                target instanceof Element &&
                (target.closest('[data-slate-editor]') || target.closest('[role="textbox"]'))
            );

            const isActiveElementInEditor = !!(
                activeElement instanceof Element &&
                (activeElement.closest('[data-slate-editor]') || activeElement.closest('[role="textbox"]'))
            );

            return isInSlateEditor || isActiveElementInEditor;
        };

        // Deduplication: Track last event timestamp to prevent double-firing
        let lastSubmitTime = 0;
        let lastSaveTime = 0;
        const DEBOUNCE_MS = 300; // 300ms debounce window

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
            event.stopPropagation(); // Prevent event from bubbling

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
            event.stopPropagation(); // Prevent event from bubbling

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

        // Cleanup function
        const cleanup = () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            console.log('[KeyboardShortcutsPlugin] Cleaned up');
        };

        // Store cleanup for unmount
        (editor as any).__keyboardShortcutsCleanup = cleanup;

        console.log('[KeyboardShortcutsPlugin] Initialized');

        return editor;
    },
});
