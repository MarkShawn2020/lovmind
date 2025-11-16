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

            console.log('[KeyboardShortcuts] isEventFromEditor check:', {
                targetNode,
                activeElement,
                targetNodeName: targetNode?.nodeName,
                activeElementName: activeElement?.nodeName,
                isSlateShadowInput: isSlateShadowInput(targetNode),
                isActiveElementShadowInput: isSlateShadowInput(activeElement),
            });

            // Always return true for now - we want to capture all Cmd+Enter events
            // The editor should be the primary input area anyway
            return true;
        };


        // Cmd+Enter Handler: Submit shortcut
        const handleSubmit = (event: KeyboardEvent) => {
            console.log('[KeyboardShortcuts] Key event:', {
                key: event.key,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                isMetaOrCtrl: event.metaKey || event.ctrlKey,
                isEnter: event.key === 'Enter',
                target: event.target,
                activeElement: document.activeElement,
            });

            if (!event || !(event.metaKey || event.ctrlKey)) return;
            if (event.key !== 'Enter') return;

            console.log('[KeyboardShortcuts] Cmd+Enter detected, checking editor context...');

            if (!isEventFromEditor(event)) {
                console.log('[KeyboardShortcuts] Event not from editor, ignoring');
                return;
            }

            console.log('[KeyboardShortcuts] Preventing default and emitting submit-shortcut');
            event.preventDefault();
            event.stopPropagation();

            // Emit submit event for parent components
            if (typeof editor.emit === 'function') {
                console.log('[KeyboardShortcuts] Emitting submit-shortcut event');
                editor.emit('submit-shortcut');
            } else {
                console.error('[KeyboardShortcuts] editor.emit is not a function!');
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
