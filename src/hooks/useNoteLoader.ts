import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { invoke } from '@tauri-apps/api/core';
import { currentNoteIdAtom, notesAtom, editorContentAtom } from '@/atoms/noteAtoms';
import { useNoteOperations } from './useNoteOperations';
import { isTauri } from '@/utils/tauri';
import type { Note } from '@/store';

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
    // Reset when no noteId
    if (!noteId) {
      setCurrentNoteId(null);
      setEditorContent({
        text: '',
        tags: [],
        richContent: null,
        isEmpty: true,
      });
      return;
    }

    const loadNote = async () => {
      let noteData: Note | null = null;

      if (isTauri()) {
        try {
          noteData = await invoke<Note | null>('get_temp_note', { id: noteId });
          console.log('[useNoteLoader] Retrieved note from Tauri backend:', noteData);
        } catch (error) {
          console.error('[useNoteLoader] Failed to load note from Tauri:', error);
        }
      } else {
        noteData = notes.find(n => n.id === noteId) || null;
        console.log('[useNoteLoader] Retrieved note from Jotai atom:', noteData);
      }

      if (noteData) {
        setCurrentNoteId(noteId);
        // Initialize editor content with note data
        setEditorContent({
          text: noteData.text || '',
          tags: noteData.tags || [],
          richContent: noteData.richContent || null,
          isEmpty: !noteData.text && !noteData.richContent,
        });
      } else {
        console.warn('[useNoteLoader] Note not found:', noteId);
        setCurrentNoteId(null);
      }
    };

    loadNote();
    // Only re-run when noteId changes, NOT when notes array updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, setCurrentNoteId, setEditorContent]);
}
