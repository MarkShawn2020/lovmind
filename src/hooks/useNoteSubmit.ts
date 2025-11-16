import { useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';

import { isTauri } from '../utils/tauri';
import { Note } from '../store';
import { editorContentAtom, notesAtom } from '../atoms/noteAtoms';
import { extractNoteTitle } from '../utils/titleExtractor';
import { useNoteOperations } from './useNoteOperations';
import type { LovmindEditorRef } from '@/components/lovmind-editor/lovmind-editor.tsx';

interface UseNoteSubmitOptions {
  /**
   * Current note ID being edited
   * - null: create mode (will generate new ID)
   * - string: edit mode (will update existing note or create with this ID)
   */
  noteId: string | null;

  /**
   * Reference to the editor instance
   */
  editorRef: React.RefObject<LovmindEditorRef | null>;

  /**
   * Whether to reset editor after creating a new note
   * @default false
   */
  resetEditorAfterCreate?: boolean;
}

/**
 * Custom hook for note submission logic
 * Provides unified submit handling across main window and float windows
 */
export const useNoteSubmit = (options: UseNoteSubmitOptions) => {
  const { noteId, editorRef, resetEditorAfterCreate = false } = options;

  // Read from atoms
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);

  // Business logic hooks
  const { setNotes, updateNote } = useNoteOperations();

  const handleSubmit = useCallback(async () => {
    // Extract fresh content synchronously from editor to avoid race conditions
    // This ensures we get the latest typed content even if the atom hasn't updated yet
    let currentContent = editorContent;

    if (editorRef.current?.editor) {
      try {
        const editor = editorRef.current.editor;
        if (editor?.children) {
          const { extractTextContent } = await import('../utils/extract-text-content');
          const { isEditorContentEmpty } = await import('../utils/is-editor-content-empty');

          const { text, tags } = extractTextContent(editor.children);
          const isEmpty = isEditorContentEmpty(editor.children);

          currentContent = {
            text,
            tags,
            richContent: editor.children,
            isEmpty,
            sourceNoteId: editorContent.sourceNoteId,
          };

          console.log('📝 Sync extracted content from editor:', { text, tags, isEmpty });
        }
      } catch (error) {
        console.warn('Failed to extract sync content, using atom:', error);
      }
    }

    const hasTypedContent = typeof currentContent.text === 'string' && Boolean(currentContent.text.trim());
    if (!hasTypedContent && currentContent.isEmpty) {
      return;
    }

    try {
      if (noteId) {
        // Update existing note (or create with provided ID)
        const existingNote = notes.find(n => n.id === noteId);

        if (existingNote) {
          // Update existing note
          const updatedNote: Note = {
            ...existingNote,
            text: currentContent.text,
            tags: currentContent.tags,
            richContent: currentContent.richContent,
            title: existingNote.manualTitle
              ? existingNote.title
              : extractNoteTitle({ text: currentContent.text, richContent: currentContent.richContent }),
            time: new Date().toLocaleString(),
          };

          await updateNote(updatedNote);
          console.log('✅ Note updated:', updatedNote.id);
        } else {
          // Create new note with provided ID (for blank notes from Cmd+N)
          const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
          const newRank = Math.max(maxRank + 1, notes.length + 1);

          const newNote: Note = {
            id: noteId,
            text: currentContent.text,
            title: extractNoteTitle({ text: currentContent.text, richContent: currentContent.richContent }),
            time: new Date().toLocaleString(),
            tags: currentContent.tags,
            richContent: currentContent.richContent,
            pinned: false,
            archived: false,
            favorite: false,
            rank: newRank,
          };

          // Add to local state
          setNotes((prevNotes) => [newNote, ...prevNotes]);

          // Trigger confetti celebration
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ff3366', '#ff66cc', '#ff99dd', '#9966ff', '#6699ff'],
            ticks: 200,
            gravity: 1.2,
            scalar: 1.2,
            shapes: ['star', 'circle'],
            drift: 0
          });

          // Save to backend
          if (isTauri()) {
            try {
              await invoke('store_temp_note', { note: newNote });
              await invoke('broadcast_note_update', { note: newNote });
              console.log('✅ Note created and broadcasted:', newNote.id);
            } catch (error) {
              console.error('Failed to save to backend:', error);
            }
          }

          // Reset editor if requested
          if (resetEditorAfterCreate) {
            editorRef.current?.resetAndFocus();
          }
        }
      } else {
        // Create new note with generated ID
        const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
        const newRank = Math.max(maxRank + 1, notes.length + 1);

        const newNote: Note = {
          id: Date.now().toString(),
          text: currentContent.text,
          title: extractNoteTitle({ text: currentContent.text, richContent: currentContent.richContent }),
          time: new Date().toLocaleString(),
          tags: currentContent.tags,
          richContent: currentContent.richContent,
          pinned: false,
          archived: false,
          favorite: false,
          rank: newRank,
        };

        // Add to local state
        setNotes((prevNotes) => [newNote, ...prevNotes]);

        // Trigger confetti celebration
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ff3366', '#ff66cc', '#ff99dd', '#9966ff', '#6699ff'],
          ticks: 200,
          gravity: 1.2,
          scalar: 1.2,
          shapes: ['star', 'circle'],
          drift: 0
        });

        // Save to backend
        if (isTauri()) {
          try {
            await invoke('store_temp_note', { note: newNote });
            await invoke('broadcast_note_update', { note: newNote });
            console.log('✅ Note created and broadcasted:', newNote.id);
          } catch (error) {
            console.error('Failed to save to backend:', error);
          }
        }

        // Reset editor if requested
        if (resetEditorAfterCreate) {
          editorRef.current?.resetAndFocus();
        }
      }
    } catch (error) {
      console.error('Failed to submit note:', error);
    }
  }, [editorContent, noteId, notes, setNotes, updateNote, editorRef, resetEditorAfterCreate]);

  return { handleSubmit };
};
