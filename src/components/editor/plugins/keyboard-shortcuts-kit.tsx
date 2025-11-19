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

// Global registry to prevent duplicate listeners across StrictMode remounts
let globalHandlerInstalled = false;
let activeEditors = new Set<any>();

// Helper: Check if element is Slate shadow input
const isSlateShadowInput = (node: EventTarget | null): node is HTMLElement => {
    return !!(node && node instanceof HTMLElement && node.classList.contains('slate-shadow-input'));
};

// Helper: Check if event is from any active editor
const isEventFromAnyEditor = (event: Event): boolean => {
    const targetNode = event.target instanceof Node ? event.target : null;
    const activeElement = document.activeElement;

    // Check if target or active element is related to any editor
    return !!(targetNode || activeElement || isSlateShadowInput(targetNode) || isSlateShadowInput(activeElement));
};

// Global keydown handler (single instance shared across all editors)
// IMPORTANT: Defined outside extendEditor to maintain stable reference
const globalHandleKeyDown = (event: KeyboardEvent) => {
    // Check for Cmd+Enter or Ctrl+Enter
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        if (!isEventFromAnyEditor(event)) return;
        event.preventDefault();

        console.log('[KeyboardShortcutsPlugin] Cmd+Enter detected, active editors:', activeEditors.size);

        // Emit to all active editors (only the focused one will handle it)
        activeEditors.forEach(ed => {
            if (typeof ed.emit === 'function') {
                ed.emit('submit-shortcut');
                console.log('[KeyboardShortcutsPlugin] Emitted submit-shortcut');
            }
        });
    }

    // Check for Cmd+S or Ctrl+S
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        if (!isEventFromAnyEditor(event)) return;
        event.preventDefault();

        // Emit to all active editors (only the focused one will handle it)
        activeEditors.forEach(ed => {
            if (typeof ed.emit === 'function') {
                ed.emit('save-shortcut');
            }
        });
    }
};

export const KeyboardShortcutsPlugin = createSlatePlugin({
    key: 'keyboard-shortcuts',
    extendEditor: ({editor}) => {
        // Install global handler only once (uses stable function reference)
        if (!globalHandlerInstalled) {
            document.addEventListener('keydown', globalHandleKeyDown, true);
            globalHandlerInstalled = true;
            console.log('[KeyboardShortcutsPlugin] Global handler installed');
        }

        // Register this editor instance
        activeEditors.add(editor);
        console.log('[KeyboardShortcutsPlugin] Registered editor, total active:', activeEditors.size);

        // Cleanup function: unregister this editor
        const cleanup = () => {
            activeEditors.delete(editor);
            console.log('[KeyboardShortcutsPlugin] Unregistered editor, remaining:', activeEditors.size);

            // If no editors remain, remove global handler
            if (activeEditors.size === 0) {
                document.removeEventListener('keydown', globalHandleKeyDown, true);
                globalHandlerInstalled = false;
                console.log('[KeyboardShortcutsPlugin] Global handler removed');
            }
        };

        // Store cleanup for unmount
        (editor as any).__keyboardShortcutsCleanup = cleanup;

        return editor;
    },
});
