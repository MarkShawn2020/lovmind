import { atom } from 'jotai';
import type { Note } from '@/store';
import type { Value } from 'platejs';

/**
 * Note Management Atoms
 *
 * Replaces local state in useNoteEditorController with global Jotai atoms.
 * This eliminates state duplication and enables cross-component communication.
 */

// Base atoms: Source of truth
export const notesAtom = atom<Note[]>([]);

export const currentNoteIdAtom = atom<string | null>(null);

// Derived atoms: Computed from base atoms
export const currentNoteAtom = atom((get) => {
  const notes = get(notesAtom);
  const id = get(currentNoteIdAtom);
  if (!id) return null;
  return notes.find(n => n.id === id) || null;
});

// Editor content atom: Unsaved content in the editor
export const editorContentAtom = atom<{
  text: string;
  tags: string[];
  richContent: Value | null;
  isEmpty: boolean;
}>({
  text: '',
  tags: [],
  richContent: null,
  isEmpty: true,
});

// UI state atom: Global UI preferences
export const uiStateAtom = atom({
  showArchived: false,
});
