import { useAtomValue } from 'jotai';
import { useEffect, useRef, useCallback } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { editorContentAtom, currentNoteAtom } from '@/atoms/noteAtoms';
import { useNoteOperations } from './useNoteOperations';
import { extractNoteTitle } from '@/utils/titleExtractor';
import { isTauri } from '@/utils/tauri';
import type { Note } from '@/store';

/**
 * Auto-Save Hook
 *
 * Automatically saves editor content to the current note when user stops typing.
 * Replaces the auto-save logic scattered in useNoteEditorController's handleContentChange.
 *
 * Features:
 * - Triggers on typing-stop (debounced)
 * - Respects manual title (manualTitle flag)
 * - Updates window title in Tauri
 * - Prevents duplicate saves
 *
 * Usage:
 * ```typescript
 * function FloatWindow() {
 *   useAutoSave(); // That's it!
 * }
 * ```
 */
export function useAutoSave() {
  const editorContent = useAtomValue(editorContentAtom);
  const currentNote = useAtomValue(currentNoteAtom);
  const { updateNote } = useNoteOperations();

  const lastSavedContentRef = useRef<string>('');
  // Track pending save state for beforeunload and note switching
  const pendingSaveRef = useRef<{
    note: Note;
    contentHash: string;
  } | null>(null);
  // Track previous note ID to detect actual note switches
  const prevNoteIdRef = useRef<string | null>(null);

  // Separate effect: Save pending changes when note ID changes (actual note switch)
  // This ONLY runs when currentNote.id changes, not on every content change
  useEffect(() => {
    const currentNoteId = currentNote?.id ?? null;
    const prevNoteId = prevNoteIdRef.current;

    // If note ID actually changed and we have pending saves, save them now
    if (prevNoteId !== null && prevNoteId !== currentNoteId && pendingSaveRef.current) {
      const { note, contentHash } = pendingSaveRef.current;
      console.log('💾 Saving on note switch:', note.id, '→', currentNoteId);
      updateNote(note).catch((error) => {
        console.error('Failed to save on note switch:', error);
      });
      lastSavedContentRef.current = contentHash;
      pendingSaveRef.current = null;
    }

    prevNoteIdRef.current = currentNoteId;
  }, [currentNote?.id, updateNote]);

  // Main effect: Debounced auto-save on content changes
  useEffect(() => {
    // Only auto-save if there's a current note
    if (!currentNote) return;

    // Don't save empty content
    if (editorContent.isEmpty) return;

    // Prevent duplicate saves
    const contentHash = JSON.stringify({
      text: editorContent.text,
      tags: editorContent.tags,
      richContent: editorContent.richContent,
    });

    if (contentHash === lastSavedContentRef.current) return;

    // Don't save if content matches the current note (no changes made)
    const noteContentHash = JSON.stringify({
      text: currentNote.text,
      tags: currentNote.tags,
      richContent: currentNote.richContent,
    });

    if (contentHash === noteContentHash) {
      // Content hasn't changed from saved state, just update the ref
      lastSavedContentRef.current = contentHash;
      return;
    }

    // Build pending save data for beforeunload
    const hasTypedContent = typeof editorContent.text === 'string' && Boolean(editorContent.text.trim());
    if (hasTypedContent || !editorContent.isEmpty) {
      const now = new Date().toISOString();
      const updatedNote: Note = {
        ...currentNote,
        text: editorContent.text,
        tags: editorContent.tags,
        richContent: editorContent.richContent,
        title: currentNote.manualTitle
          ? currentNote.title
          : extractNoteTitle({ text: editorContent.text, richContent: editorContent.richContent }),
        time: new Date().toLocaleString(),
        isDraft: true,
        createdAt: currentNote.createdAt || now,
        updatedAt: now,
      };
      pendingSaveRef.current = { note: updatedNote, contentHash };
    }

    // Debounce: Only save after user stops typing
    // Note: In the future, we could listen to InputStatePlugin's typing-stop event
    // For now, we use a simple timer
    const timer = setTimeout(async () => {
      if (!pendingSaveRef.current) return;

      const { note: updatedNote, contentHash: hash } = pendingSaveRef.current;

      try {
        await updateNote(updatedNote);
        console.log('🔄 Auto-saved as draft:', updatedNote.id);
        lastSavedContentRef.current = hash;
        pendingSaveRef.current = null; // Clear pending save after successful save

        // Update window title if in Tauri
        if (isTauri()) {
          try {
            const currentWindow = getCurrentWebviewWindow();
            await currentWindow.setTitle(`Edit: ${updatedNote.title}`);
          } catch (error) {
            console.error('Failed to update window title:', error);
          }
        }
      } catch (error) {
        console.error('Failed to auto-save:', error);
      }
    }, 1000); // 1 second debounce

    return () => {
      clearTimeout(timer);
      // NOTE: Don't save here! This cleanup runs on every content change.
      // Note switching is handled by the separate effect above that watches currentNote?.id
    };
  }, [editorContent, currentNote, updateNote]);

  // Save immediately on page unload (browser refresh, close, etc.)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!pendingSaveRef.current) return;

      const { note: updatedNote, contentHash } = pendingSaveRef.current;

      // Use synchronous updateNote via navigator.sendBeacon for reliability
      // Since updateNote is async, we need to serialize and send directly
      if (isTauri()) {
        // In Tauri, use sync invoke pattern (best effort)
        // Note: Tauri invoke is async, so we use a workaround
        try {
          // Store to localStorage as fallback (will be synced on next load)
          const pendingKey = `lovpen-pending-save-${updatedNote.id}`;
          localStorage.setItem(pendingKey, JSON.stringify(updatedNote));
          console.log('💾 Saved pending note to localStorage before unload:', updatedNote.id);
        } catch (e) {
          console.error('Failed to save pending note before unload:', e);
        }
      } else {
        // In web, save to localStorage
        try {
          const pendingKey = `lovpen-pending-save-${updatedNote.id}`;
          localStorage.setItem(pendingKey, JSON.stringify(updatedNote));
          console.log('💾 Saved pending note to localStorage before unload:', updatedNote.id);
        } catch (e) {
          console.error('Failed to save pending note before unload:', e);
        }
      }

      lastSavedContentRef.current = contentHash;
      pendingSaveRef.current = null;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
