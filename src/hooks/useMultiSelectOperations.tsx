import { useCallback } from 'react';
import { Note } from '@/store';
import { confirmDialog } from '@/utils/tauri';

export interface UseMultiSelectOperationsProps {
  onTogglePin: (id: string) => void | Promise<unknown>;
  onToggleArchive: (id: string) => void | Promise<unknown>;
  onDeleteNote: (id: string, skipConfirmation?: boolean) => void | Promise<unknown>;
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
    if (noteIds.length === 0) return;

    // Show ONE confirmation dialog for all notes
    const confirmed = await confirmDialog(
      `确定要删除这 ${noteIds.length} 条笔记吗？此操作不可恢复。`,
      {
        title: '批量删除',
        okLabel: '删除',
        cancelLabel: '取消',
        variant: 'destructive',
        icon: () => (
          <div className="relative w-16 h-16">
            <svg
              className="w-full h-full text-primary opacity-80 drop-shadow-[0_8px_16px_rgba(0,0,0,0.1)]"
              viewBox="-98.605 -108 1183.26 1296"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g fill="currentColor">
                <path d="M281.73,892.18V281.73C281.73,126.13,155.6,0,0,0l0,0v610.44C0,766.04,126.13,892.18,281.73,892.18z" />
                <path d="M633.91,1080V469.56c0-155.6-126.13-281.73-281.73-281.73l0,0v610.44C352.14,953.87,478.31,1080,633.91,1080L633.91,1080z" />
                <path d="M704.32,91.16L704.32,91.16v563.47l0,0c155.6,0,281.73-126.13,281.73-281.73S859.92,91.16,704.32,91.16z" />
              </g>
            </svg>
          </div>
        ),
      }
    );

    if (!confirmed) return;

    // Delete all notes without individual confirmations
    await Promise.all(noteIds.map(id => Promise.resolve(onDeleteNote(id, true))));
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
