import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import confetti from 'canvas-confetti';

import { isTauri } from '../utils/tauri';
import { Note, draftContentAtom, setStoreValue } from '../store';
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
   * - boolean: static decision
   * - function: dynamic decision (called when creating new note)
   * @default false
   */
  resetEditorAfterCreate?: boolean | (() => boolean);

  /**
   * Callback to change the active noteId after creating a new note
   * Used by float-window to switch to a new note after reset
   * @param newNoteId - The ID of the newly created note
   */
  onNoteIdChange?: (newNoteId: string | null) => void;

  /**
   * Callback to close the current window after submit
   * Used by float-window in normal (non-pinned) mode
   */
  onCloseWindow?: () => Promise<void>;
}

/**
 * Custom hook for note submission logic
 * Provides unified submit handling across main window and float windows
 */
export const useNoteSubmit = (options: UseNoteSubmitOptions) => {
  const { noteId, editorRef, resetEditorAfterCreate = false, onNoteIdChange, onCloseWindow } = options;

  // Read from atoms
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);
  const setEditorContent = useSetAtom(editorContentAtom);
  const setDraft = useSetAtom(draftContentAtom);

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

          // Decide whether to trust extracted content or atom content.
          // In responsive layouts there may be multiple editor instances
          // sharing the same ref; some can remain empty (hidden) while
          // the visible editor has content synced via editorContentAtom.
          const extractedHasTypedContent =
            typeof text === 'string' && Boolean(text.trim());
          const extractedEffectivelyEmpty = !extractedHasTypedContent && isEmpty;

          const atomHasTypedContent =
            typeof editorContent.text === 'string' && Boolean(editorContent.text.trim());
          const atomEffectivelyEmpty = !atomHasTypedContent && editorContent.isEmpty;

          // Only override atom content when extracted content clearly has
          // more information (non-empty or atom is effectively empty).
          if (!extractedEffectivelyEmpty && (extractedHasTypedContent || atomEffectivelyEmpty)) {
            currentContent = {
              text,
              tags,
              richContent: editor.children,
              isEmpty,
              sourceNoteId: editorContent.sourceNoteId,
            };
          }

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
          // Update existing note and convert from draft to submitted
          const now = new Date().toISOString();
          const updatedNote: Note = {
            ...existingNote,
            text: currentContent.text,
            tags: currentContent.tags,
            richContent: currentContent.richContent,
            title: existingNote.manualTitle
              ? existingNote.title
              : extractNoteTitle({ text: currentContent.text, richContent: currentContent.richContent }),
            time: new Date().toLocaleString(),
            isDraft: false, // Convert to formal note
            submittedAt: existingNote.isDraft ? now : (existingNote.submittedAt || now), // Set submission time if was draft
            updatedAt: now,
          };

          // Check if we should reset (do this BEFORE updating to prevent flicker)
          const shouldReset = typeof resetEditorAfterCreate === 'function'
            ? resetEditorAfterCreate()
            : resetEditorAfterCreate;

          // If resetting, switch to new noteId BEFORE updating to prevent flicker
          if (shouldReset) {
            const nextNoteId = `temp-${Date.now()}`;
            onNoteIdChange?.(nextNoteId);
            console.log('[Submit] Switched to new noteId before update (prevent flicker):', nextNoteId);
          }

          await updateNote(updatedNote);
          setDraft(null); // Clear draft after successful update
          console.log('✅ Note updated:', updatedNote.id);

          // Now reset the editor DOM
          if (shouldReset) {
            // Clear editor content so next capture starts fresh
            setEditorContent({
              text: '',
              tags: [],
              richContent: null,
              isEmpty: true,
              sourceNoteId: null,
            });
            editorRef.current?.resetAndFocus();
            console.log('[Submit] Editor reset for continuous capture (pinned mode)');
          } else if (onCloseWindow) {
            // Normal mode: close window after successful update
            await onCloseWindow();
            return; // Early return to prevent further execution
          }
        } else {
          // Create new note with provided ID (for blank notes from Cmd+N)
          const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
          const newRank = Math.max(maxRank + 1, notes.length + 1);

          const now = new Date().toISOString();
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
            isDraft: false, // Submit creates formal note
            submittedAt: now,
            createdAt: now,
            updatedAt: now,
          };

          // Check if we should reset (do this BEFORE saving to prevent flicker)
          const shouldReset = typeof resetEditorAfterCreate === 'function'
            ? resetEditorAfterCreate()
            : resetEditorAfterCreate;

          // If resetting, switch to new noteId BEFORE saving to prevent flicker
          let nextNoteId: string | null = null;
          if (shouldReset) {
            nextNoteId = `temp-${Date.now()}`;
            // Switch immediately to prevent rendering the created note
            onNoteIdChange?.(nextNoteId);
            console.log('[Submit] Switched to new noteId before save (prevent flicker):', nextNoteId);
          }

          // Add to local state
          setNotes((prevNotes) => [newNote, ...prevNotes]);
          setDraft(null); // Clear draft after successful creation

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

          // Now reset the editor DOM
          if (shouldReset) {
            // Clear editor content so next capture starts fresh
            setEditorContent({
              text: '',
              tags: [],
              richContent: null,
              isEmpty: true,
              sourceNoteId: null,
            });
            editorRef.current?.resetAndFocus();
            console.log('[Submit] Editor reset for continuous capture (pinned mode)');
          } else if (onCloseWindow) {
            // Close window after successful creation (for float window normal mode)
            await onCloseWindow();
            return; // Early return to prevent further execution
          }
        }
      } else {
        // Create new note with generated ID
        const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
        const newRank = Math.max(maxRank + 1, notes.length + 1);

        const now = new Date().toISOString();
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
          isDraft: false, // Submit creates formal note
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        };

        // Check if we should reset (do this BEFORE saving to prevent flicker)
        const shouldReset = typeof resetEditorAfterCreate === 'function'
          ? resetEditorAfterCreate()
          : resetEditorAfterCreate;

        // If resetting, switch to new noteId BEFORE saving to prevent flicker
        if (shouldReset) {
          const nextNoteId = `temp-${Date.now()}`;
          onNoteIdChange?.(nextNoteId);
          console.log('[Submit] Switched to new noteId before save (prevent flicker):', nextNoteId);
        }

        // Add to local state
        setNotes((prevNotes) => [newNote, ...prevNotes]);
        setDraft(null); // Clear draft after successful creation

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

        // Save to backend and notify float windows
        if (isTauri()) {
          try {
            await invoke('store_temp_note', { note: newNote });
            await invoke('broadcast_note_update', { note: newNote });

            // Clear draft from store and notify float windows to close
            await setStoreValue('lovpen-draft', null);
            await emit('draft-submitted', { noteId: newNote.id });

            console.log('✅ Note created and broadcasted:', newNote.id);
          } catch (error) {
            console.error('Failed to save to backend:', error);
          }
        }

        // Reset editor for new note
        setEditorContent({
          text: '',
          tags: [],
          richContent: null,
          isEmpty: true,
          sourceNoteId: null,
        });
        editorRef.current?.resetAndFocus();
        console.log('[Submit] Editor reset for new note');
      }
    } catch (error) {
      console.error('Failed to submit note:', error);
    }
  }, [editorContent, noteId, notes, setNotes, updateNote, editorRef, resetEditorAfterCreate, onNoteIdChange, onCloseWindow, setEditorContent, setDraft]);

  return { handleSubmit };
};
