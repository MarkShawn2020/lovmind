import { atom } from 'jotai';
import type { Value } from 'platejs';
import { notesAtom } from '@/store'; // Re-export from store.ts

/**
 * Note Management Atoms
 *
 * Replaces local state in useNoteEditorController with global Jotai atoms.
 * This eliminates state duplication and enables cross-component communication.
 */

// Re-export notesAtom from store.ts (already persisted with atomWithStorage)
export { notesAtom };

// Base atoms: Source of truth
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
  sourceNoteId: string | null; // Which note this content came from (null = create mode, undefined = user editing)
}>({
  text: '',
  tags: [],
  richContent: null,
  isEmpty: true,
  sourceNoteId: null,
});

// UI state atom: Global UI preferences
export const uiStateAtom = atom({
  showArchived: false,
});
