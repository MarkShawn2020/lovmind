import { useState, useCallback } from 'react';

export interface UseMultiSelectReturn {
  isMultiSelectMode: boolean;
  selectedNoteIds: Set<string>;
  lastClickedNoteId: string | null;
  toggleMultiSelectMode: () => void;
  enterMultiSelectMode: () => void;
  exitMultiSelectMode: () => void;
  toggleNoteSelection: (noteId: string) => void;
  selectNote: (noteId: string) => void;
  deselectNote: (noteId: string) => void;
  selectAll: (noteIds: string[]) => void;
  deselectAll: () => void;
  selectRange: (fromNoteId: string, toNoteId: string, allNoteIds: string[]) => void;
  setLastClickedNote: (noteId: string) => void;
  isNoteSelected: (noteId: string) => boolean;
}

/**
 * Hook for managing multi-select state in note list
 * Supports:
 * - Toggle multi-select mode
 * - Select/deselect individual notes
 * - Select all / deselect all
 * - Track selected note IDs
 */
export const useMultiSelect = (): UseMultiSelectReturn => {
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [lastClickedNoteId, setLastClickedNoteId] = useState<string | null>(null);

  const toggleMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(prev => {
      if (prev) {
        // Exiting multi-select mode - clear selections and anchor
        setSelectedNoteIds(new Set());
        setLastClickedNoteId(null);
      }
      return !prev;
    });
  }, []);

  const enterMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(true);
  }, []);

  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedNoteIds(new Set());
    setLastClickedNoteId(null);
  }, []);

  const toggleNoteSelection = useCallback((noteId: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  }, []);

  const selectNote = useCallback((noteId: string) => {
    setSelectedNoteIds(prev => new Set(prev).add(noteId));
  }, []);

  const deselectNote = useCallback((noteId: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  }, []);

  const selectAll = useCallback((noteIds: string[]) => {
    setSelectedNoteIds(new Set(noteIds));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedNoteIds(new Set());
  }, []);

  const selectRange = useCallback((fromNoteId: string, toNoteId: string, allNoteIds: string[]) => {
    // Find indices of from and to notes in the display order
    const fromIndex = allNoteIds.indexOf(fromNoteId);
    const toIndex = allNoteIds.indexOf(toNoteId);

    if (fromIndex === -1 || toIndex === -1) {
      console.warn('selectRange: note not found in list', { fromNoteId, toNoteId, allNoteIds });
      return;
    }

    // Calculate range (inclusive, handle both directions)
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    // Select all notes in range
    const rangeNoteIds = allNoteIds.slice(startIndex, endIndex + 1);
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      rangeNoteIds.forEach(id => next.add(id));
      return next;
    });
  }, []);

  const setLastClickedNote = useCallback((noteId: string) => {
    setLastClickedNoteId(noteId);
  }, []);

  const isNoteSelected = useCallback((noteId: string) => {
    return selectedNoteIds.has(noteId);
  }, [selectedNoteIds]);

  return {
    isMultiSelectMode,
    selectedNoteIds,
    lastClickedNoteId,
    toggleMultiSelectMode,
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleNoteSelection,
    selectNote,
    deselectNote,
    selectAll,
    deselectAll,
    selectRange,
    setLastClickedNote,
    isNoteSelected,
  };
};
