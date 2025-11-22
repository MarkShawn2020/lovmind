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

// Global deduplication state (shared across all plugin instances)
// This prevents duplicate events even if the plugin is initialized multiple times
let globalLastSubmitTimestamp = -1;
let globalLastSaveTimestamp = -1;

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

        // Cmd+Enter Handler: Submit shortcut
        const handleSubmit = (event: KeyboardEvent) => {
            const isDev = process.env.NODE_ENV === 'development';

            if (!event || !(event.metaKey || event.ctrlKey)) return;
            if (event.key !== 'Enter') return;

            const fromEditor = isEventFromEditor(event);

            // Development debugging
            if (isDev) {
                console.log('[KeyboardShortcuts] Cmd+Enter detected:', {
                    timestamp: event.timeStamp,
                    targetClass: (event.target as Element)?.className,
                    targetTag: (event.target as Element)?.tagName,
                    activeElementClass: document.activeElement?.className,
                    activeElementTag: document.activeElement?.tagName,
                    isFromEditor: fromEditor,
                    metaKey: event.metaKey,
                    ctrlKey: event.ctrlKey,
                });
            }

            if (!fromEditor) {
                if (isDev) {
                    console.log('[KeyboardShortcuts] Event not from editor, ignoring');
                }
                return;
            }

            // Deduplication: Check if this is the same event (by timestamp)
            // Use GLOBAL state to deduplicate across multiple plugin instances
            if (event.timeStamp === globalLastSubmitTimestamp) {
                if (isDev) {
                    console.log('[KeyboardShortcuts] Duplicate event detected, ignoring');
                }
                return;
            }
            globalLastSubmitTimestamp = event.timeStamp;

            event.preventDefault();
            event.stopPropagation(); // Prevent event from reaching other handlers

            if (isDev) {
                console.log('[KeyboardShortcuts] ✅ Emitting submit-shortcut event');
            }

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

            // Deduplication: Check if this is the same event (by timestamp)
            // Use GLOBAL state to deduplicate across multiple plugin instances
            if (event.timeStamp === globalLastSaveTimestamp) {
                return;
            }
            globalLastSaveTimestamp = event.timeStamp;

            event.preventDefault();
            event.stopPropagation(); // Prevent event from reaching other handlers

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

        // Register event listener on document (capture phase)
        document.addEventListener('keydown', handleKeyDown, true);

        return editor;
    },
});
