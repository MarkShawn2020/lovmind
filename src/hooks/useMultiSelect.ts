import { useState, useCallback } from 'react';

export interface UseMultiSelectReturn {
  isMultiSelectMode: boolean;
  selectedNoteIds: Set<string>;
  toggleMultiSelectMode: () => void;
  enterMultiSelectMode: () => void;
  exitMultiSelectMode: () => void;
  toggleNoteSelection: (noteId: string) => void;
  selectNote: (noteId: string) => void;
  deselectNote: (noteId: string) => void;
  selectAll: (noteIds: string[]) => void;
  deselectAll: () => void;
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

  const toggleMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(prev => {
      if (prev) {
        // Exiting multi-select mode - clear selections
        setSelectedNoteIds(new Set());
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

  const isNoteSelected = useCallback((noteId: string) => {
    return selectedNoteIds.has(noteId);
  }, [selectedNoteIds]);

  return {
    isMultiSelectMode,
    selectedNoteIds,
    toggleMultiSelectMode,
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleNoteSelection,
    selectNote,
    deselectNote,
    selectAll,
    deselectAll,
    isNoteSelected,
  };
};
