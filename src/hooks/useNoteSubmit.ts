import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import confetti from 'canvas-confetti';

import { isTauri } from '../utils/tauri';
import { Note, draftContentAtom, setStoreValue } from '../store';
import { editorContentAtom, notesAtom } from '../atoms/noteAtoms';
import { extractNoteTitle } from '../utils/titleExtractor';
import { extractTextContent } from '../utils/extract-text-content';
import { isEditorContentEmpty } from '../utils/is-editor-content-empty';
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

const CONFETTI_OPTIONS = {
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 },
  colors: ['#ff3366', '#ff66cc', '#ff99dd', '#9966ff', '#6699ff'],
  ticks: 200,
  gravity: 1.2,
  scalar: 1.2,
  shapes: ['star', 'circle'] as confetti.Shape[],
  drift: 0,
};

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

          console.log('[Submit] Extracted content from editor:', { text, tags, isEmpty });
        }
      } catch (error) {
        console.warn('Failed to extract sync content, using atom:', error);
      }
    }

    const hasTypedContent = typeof currentContent.text === 'string' && Boolean(currentContent.text.trim());
    if (!hasTypedContent && currentContent.isEmpty) {
      return;
    }

    // Shared helper: check whether editor should reset after create
    const shouldReset = () =>
      typeof resetEditorAfterCreate === 'function'
        ? resetEditorAfterCreate()
        : resetEditorAfterCreate;

    // Shared helper: create a new note, save, confetti, and handle reset/close
    const createAndSaveNote = async (id: string) => {
      const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
      const newRank = Math.max(maxRank + 1, notes.length + 1);
      const now = new Date().toISOString();

      const newNote: Note = {
        id,
        text: currentContent.text,
        title: extractNoteTitle({ text: currentContent.text, richContent: currentContent.richContent }),
        time: new Date().toLocaleString(),
        tags: currentContent.tags,
        richContent: currentContent.richContent,
        pinned: false,
        archived: false,
        favorite: false,
        rank: newRank,
        isDraft: false,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const reset = shouldReset();

      // If resetting, switch to new noteId BEFORE saving to prevent flicker
      if (reset) {
        const nextNoteId = `temp-${crypto.randomUUID()}`;
        onNoteIdChange?.(nextNoteId);
        console.log('[Submit] Switched to new noteId before save:', nextNoteId);
      }

      setNotes((prevNotes) => [newNote, ...prevNotes]);
      setDraft(null);
      confetti(CONFETTI_OPTIONS);

      if (isTauri()) {
        try {
          await invoke('store_temp_note', { note: newNote });
          await invoke('broadcast_note_update', { note: newNote });
          await setStoreValue('lovpen-draft', null);
          await emit('draft-submitted', { noteId: newNote.id });
          console.log('[Submit] Note created and broadcasted:', newNote.id);
        } catch (error) {
          console.error('Failed to save to backend:', error);
        }
      }

      if (reset) {
        setEditorContent((prev) => ({
          text: '',
          tags: [],
          richContent: null,
          isEmpty: true,
          sourceNoteId: null,
          _loadVersion: (prev._loadVersion ?? 0) + 1,
        }));
        editorRef.current?.resetAndFocus();
        console.log('[Submit] Editor reset for continuous capture (pinned mode)');
      } else if (onCloseWindow) {
        await onCloseWindow();
      }
    };

    // Shared helper: reset editor after any submit
    const resetEditor = () => {
      setEditorContent((prev) => ({
        text: '',
        tags: [],
        richContent: null,
        isEmpty: true,
        sourceNoteId: null,
        _loadVersion: (prev._loadVersion ?? 0) + 1,
      }));
      editorRef.current?.resetAndFocus();
    };

    try {
      if (noteId) {
        const existingNote = notes.find(n => n.id === noteId);

        if (existingNote) {
          // Update existing note
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
            isDraft: false,
            submittedAt: existingNote.isDraft ? now : (existingNote.submittedAt || now),
            updatedAt: now,
          };

          const reset = shouldReset();

          if (reset) {
            const nextNoteId = `temp-${crypto.randomUUID()}`;
            onNoteIdChange?.(nextNoteId);
            console.log('[Submit] Switched to new noteId before update:', nextNoteId);
          }

          await updateNote(updatedNote);
          setDraft(null);

          if (isTauri()) {
            await setStoreValue('lovpen-draft', null);
            await emit('draft-submitted', { noteId: updatedNote.id });
          }
          console.log('[Submit] Note updated:', updatedNote.id);

          if (reset) {
            resetEditor();
            console.log('[Submit] Editor reset for continuous capture (pinned mode)');
          } else if (onCloseWindow) {
            await onCloseWindow();
            return;
          }
        } else {
          // Create new note with provided ID (blank notes from Cmd+N)
          await createAndSaveNote(noteId);
        }
      } else {
        // Create new note with generated ID
        await createAndSaveNote(crypto.randomUUID());
      }
    } catch (error) {
      console.error('Failed to submit note:', error);
    }
  }, [editorContent, noteId, notes, setNotes, updateNote, editorRef, resetEditorAfterCreate, onNoteIdChange, onCloseWindow, setEditorContent, setDraft]);

  return { handleSubmit };
};
