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
 * Uses a singleton pattern to ensure only one document-level listener exists.
 */

// Singleton state: Only one listener should exist across all editor instances
let globalKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
let currentEditor: any = null;

export const KeyboardShortcutsPlugin = createSlatePlugin({
    key: 'keyboard-shortcuts',
    extendEditor: ({editor}) => {
        // Helper: Check if element is Slate shadow input
        const isSlateShadowInput = (node: EventTarget | null): node is HTMLElement => {
            return !!(node && node instanceof HTMLElement && node.classList.contains('slate-shadow-input'));
        };

        // Helper: Check if event is from a Slate editor
        const isEventFromEditor = (event: Event): boolean => {
            const targetNode = event.target instanceof Node ? event.target : null;
            const activeElement = document.activeElement;

            // Priority 1: Check if target or active element is Slate shadow input (most reliable)
            if (isSlateShadowInput(targetNode) || isSlateShadowInput(activeElement)) {
                return true;
            }

            // Priority 2: Check if target is within a Slate editor
            // Traverse up DOM tree, skipping contentEditable=false barriers
            if (targetNode instanceof Element) {
                let current: Element | null = targetNode;
                while (current) {
                    // Check for editor marker at this level
                    if (current.hasAttribute('data-slate-editor')) {
                        return true;
                    }
                    // Check if any ancestor is an editor (handles nested structures)
                    const editorAncestor = current.closest('[data-slate-editor="true"]');
                    if (editorAncestor) {
                        return true;
                    }
                    // Move up one level (handles contentEditable=false barriers)
                    current = current.parentElement;
                }
            }

            // Priority 3: Check if active element is within a Slate editor or block wrapper
            if (activeElement instanceof Element) {
                // Check for block-draggable wrapper (fallback for complex nesting)
                const inBlockWrapper = activeElement.closest('.slate-blockWrapper');
                if (inBlockWrapper?.closest('[data-slate-editor="true"]')) {
                    return true;
                }

                // Standard editor check
                const isInEditor = activeElement.closest('[data-slate-editor="true"]') !== null;
                if (isInEditor) return true;
            }

            return false;
        };

        // Update the current editor reference
        // This ensures the latest editor instance receives events
        currentEditor = editor;

        // Only register the global handler once
        if (!globalKeydownHandler) {
            const isDev = process.env.NODE_ENV === 'development';

            globalKeydownHandler = (event: KeyboardEvent) => {
                // Skip if no editor or not a modifier key combo
                if (!currentEditor || !(event.metaKey || event.ctrlKey)) return;

                const fromEditor = isEventFromEditor(event);
                if (!fromEditor) return;

                // Cmd+Enter: Submit shortcut
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();

                    if (isDev) {
                        console.log('[KeyboardShortcuts] ✅ Cmd+Enter - emitting submit-shortcut');
                    }

                    if (typeof currentEditor.emit === 'function') {
                        currentEditor.emit('submit-shortcut');
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

                    if (typeof currentEditor.emit === 'function') {
                        currentEditor.emit('save-shortcut');
                    }
                    return;
                }
            };

            document.addEventListener('keydown', globalKeydownHandler, true);

            if (isDev) {
                console.log('[KeyboardShortcuts] Global handler registered');
            }
        }

        return editor;
    },
});
