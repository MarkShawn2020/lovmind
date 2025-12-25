import { atom } from 'jotai';
import type { Value } from 'platejs';
import { notesAtom } from '@/store'; // Re-export from store.ts

/**
 * Note Management Atoms
 *
 * Replaces local state in useNoteEditorController with global Jotai atoms.
 * This eliminates state duplication and enables cross-component communication.
 */

// Re-export notesAtom from store.ts (persisted in web builds via atomWithStorage)
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
// _loadVersion: Incremented when content should be loaded INTO the editor (external source)
//               NOT incremented when content is synced FROM the editor (user typing)
export const editorContentAtom = atom<{
  text: string;
  tags: string[];
  richContent: Value | null;
  isEmpty: boolean;
  sourceNoteId: string | null; // Which note this content came from (null = create mode)
  _loadVersion?: number; // Increment to force editor to reload content
}>({
  text: '',
  tags: [],
  richContent: null,
  isEmpty: true,
  sourceNoteId: null,
  _loadVersion: 0,
});

// UI state atom: Global UI preferences
export const uiStateAtom = atom({
  showArchived: false,
});
