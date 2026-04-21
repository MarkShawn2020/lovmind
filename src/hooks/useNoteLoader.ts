import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { invoke } from '@tauri-apps/api/core';
import { currentNoteIdAtom, notesAtom, editorContentAtom } from '@/atoms/noteAtoms';
import { useNoteOperations } from './useNoteOperations';
import { isTauri } from '@/utils/tauri';
import type { Note } from '@/store';

/**
 * Check and restore any pending saves from localStorage (saved during beforeunload)
 */
function checkAndRestorePendingSave(noteId: string): Note | null {
  const pendingKey = `lovpen-pending-save-${noteId}`;
  const pendingData = localStorage.getItem(pendingKey);
  if (pendingData) {
    try {
      const note = JSON.parse(pendingData) as Note;
      console.log('[useNoteLoader] Found pending save from beforeunload:', noteId);
      // Clear the pending save after reading
      localStorage.removeItem(pendingKey);
      return note;
    } catch (e) {
      console.error('[useNoteLoader] Failed to parse pending save:', e);
      localStorage.removeItem(pendingKey);
    }
  }
  return null;
}

/**
 * Note Loader Hook
 *
 * Loads a note by ID and sets it as the current note in Jotai atoms.
 * Replaces the duplicate loading logic in useNoteEditorController.
 *
 * Features:
 * - Loads from Tauri backend (if in Tauri) or from notes array
 * - Sets currentNoteIdAtom (triggers currentNoteAtom derivation)
 * - Initializes editorContentAtom with note content
 * - Resets to null when noteId is null
 *
 * Usage:
 * ```typescript
 * // FloatWindow.tsx
 * const noteId = getNoteIdFromURL();
 * useNoteLoader(noteId);
 * const currentNote = useAtomValue(currentNoteAtom); // Auto-derived!
 * ```
 */
export function useNoteLoader(noteId: string | null | undefined) {
  const setCurrentNoteId = useSetAtom(currentNoteIdAtom);
  const setEditorContent = useSetAtom(editorContentAtom);
  const { notes } = useNoteOperations();

  useEffect(() => {
    // When no noteId (create mode), just clear currentNoteId
    // Don't reset editorContent - let the caller handle it
    // This allows handleBackToCreate to restore draft content
    if (!noteId) {
      setCurrentNoteId(null);
      return;
    }

    const loadNote = async () => {
      let noteData: Note | null = null;

      // First, check for any pending saves from beforeunload
      const pendingSave = checkAndRestorePendingSave(noteId);
      if (pendingSave) {
        noteData = pendingSave;
        console.log('[useNoteLoader] Using pending save from beforeunload:', noteData);
        // Sync to backend
        if (isTauri()) {
          try {
            await invoke('store_temp_note', { note: noteData });
            console.log('[useNoteLoader] Synced pending save to backend');
          } catch (error) {
            console.error('[useNoteLoader] Failed to sync pending save to backend:', error);
          }
        }
      } else if (isTauri()) {
        try {
          noteData = await invoke<Note | null>('get_temp_note', { id: noteId });
          console.log('[useNoteLoader] Retrieved note from Tauri backend:', noteData);
        } catch (error) {
          console.error('[useNoteLoader] Failed to load note from Tauri:', error);
        }

        // Fallback: If backend doesn't have the note yet (race condition),
        // try loading from notesAtom (which may have it from localStorage)
        if (!noteData) {
          noteData = notes.find(n => n.id === noteId) || null;
          if (noteData) {
            console.log('[useNoteLoader] Fallback: Retrieved note from Jotai atom (backend was empty):', noteData);
            // Store to backend for future access
            try {
              await invoke('store_temp_note', { note: noteData });
              console.log('[useNoteLoader] Synced note to backend');
            } catch (error) {
              console.error('[useNoteLoader] Failed to sync note to backend:', error);
            }
          }
        }
      } else {
        noteData = notes.find(n => n.id === noteId) || null;
        console.log('[useNoteLoader] Retrieved note from Jotai atom:', noteData);
      }

      if (noteData) {
        setCurrentNoteId(noteId);
        // Initialize editor content with note data
        setEditorContent((prev) => ({
          text: noteData.text || '',
          tags: noteData.tags || [],
          richContent: noteData.richContent || null,
          isEmpty: !noteData.text && !noteData.richContent,
          sourceNoteId: noteId, // Mark content source
          _loadVersion: (prev._loadVersion ?? 0) + 1, // Force editor reload
        }));
      } else {
        // Note not found — this is a new note (create mode with pre-generated UUID).
        // Set currentNoteId so useAutoSave can auto-create when user starts typing.
        console.log('[useNoteLoader] Note not found, treating as create mode:', noteId);
        setCurrentNoteId(noteId);
        setEditorContent((prev) => ({
          text: '',
          tags: [],
          richContent: null,
          isEmpty: true,
          sourceNoteId: noteId,
          _loadVersion: (prev._loadVersion ?? 0) + 1,
        }));
      }
    };

    loadNote();
    // Only re-run when noteId changes, NOT when notes array updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, setCurrentNoteId, setEditorContent]);
}
