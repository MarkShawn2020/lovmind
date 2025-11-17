import { useCallback } from 'react';
import { Note } from '@/store';

export interface UseMultiSelectOperationsProps {
  onTogglePin: (id: string) => void | Promise<unknown>;
  onToggleArchive: (id: string) => void | Promise<unknown>;
  onDeleteNote: (id: string) => void | Promise<unknown>;
  notes: Note[];
}

export interface UseMultiSelectOperationsReturn {
  batchDelete: (noteIds: string[]) => Promise<void>;
  batchArchive: (noteIds: string[]) => Promise<void>;
  batchUnarchive: (noteIds: string[]) => Promise<void>;
  batchPin: (noteIds: string[]) => Promise<void>;
  batchUnpin: (noteIds: string[]) => Promise<void>;
  batchAddTag: (noteIds: string[], tag: string) => Promise<void>;
  batchRemoveTag: (noteIds: string[], tag: string) => Promise<void>;
  batchMoveToFolder: (noteIds: string[], folderId: string | null) => Promise<void>;
}

/**
 * Hook for batch operations on selected notes
 */
export const useMultiSelectOperations = ({
  onTogglePin,
  onToggleArchive,
  onDeleteNote,
  notes,
}: UseMultiSelectOperationsProps): UseMultiSelectOperationsReturn => {
  const batchDelete = useCallback(async (noteIds: string[]) => {
    // Delete notes in parallel
    await Promise.all(noteIds.map(id => Promise.resolve(onDeleteNote(id))));
  }, [onDeleteNote]);

  const batchArchive = useCallback(async (noteIds: string[]) => {
    // Only archive unarchived notes
    const notesToArchive = noteIds.filter(id => {
      const note = notes.find(n => n.id === id);
      return note && !note.archived;
    });
    await Promise.all(notesToArchive.map(id => Promise.resolve(onToggleArchive(id))));
  }, [onToggleArchive, notes]);

  const batchUnarchive = useCallback(async (noteIds: string[]) => {
    // Only unarchive archived notes
    const notesToUnarchive = noteIds.filter(id => {
      const note = notes.find(n => n.id === id);
      return note && note.archived;
    });
    await Promise.all(notesToUnarchive.map(id => Promise.resolve(onToggleArchive(id))));
  }, [onToggleArchive, notes]);

  const batchPin = useCallback(async (noteIds: string[]) => {
    // Only pin unpinned notes
    const notesToPin = noteIds.filter(id => {
      const note = notes.find(n => n.id === id);
      return note && !note.pinned;
    });
    await Promise.all(notesToPin.map(id => Promise.resolve(onTogglePin(id))));
  }, [onTogglePin, notes]);

  const batchUnpin = useCallback(async (noteIds: string[]) => {
    // Only unpin pinned notes
    const notesToUnpin = noteIds.filter(id => {
      const note = notes.find(n => n.id === id);
      return note && note.pinned;
    });
    await Promise.all(notesToUnpin.map(id => Promise.resolve(onTogglePin(id))));
  }, [onTogglePin, notes]);

  const batchAddTag = useCallback(async (noteIds: string[], tag: string) => {
    // TODO: Implement batch add tag when tag editing is available
    console.log('Batch add tag:', noteIds, tag);
  }, []);

  const batchRemoveTag = useCallback(async (noteIds: string[], tag: string) => {
    // TODO: Implement batch remove tag when tag editing is available
    console.log('Batch remove tag:', noteIds, tag);
  }, []);

  const batchMoveToFolder = useCallback(async (noteIds: string[], folderId: string | null) => {
    // TODO: Implement batch move to folder when folder feature is added
    console.log('Batch move to folder:', noteIds, folderId);
  }, []);

  return {
    batchDelete,
    batchArchive,
    batchUnarchive,
    batchPin,
    batchUnpin,
    batchAddTag,
    batchRemoveTag,
    batchMoveToFolder,
  };
};
