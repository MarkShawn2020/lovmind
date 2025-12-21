import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { invoke } from '@tauri-apps/api/core';
import { notesAtom, Note } from '../store';
import { isTauri, confirmDialog } from '../utils/tauri';

/**
 * Custom hook for note CRUD operations
 * Provides unified note management across different windows
 */
export const useNoteOperations = () => {
  const [notes, setNotes] = useAtom(notesAtom);

  /**
   * Delete a note with optional confirmation
   * @param noteId - The ID of the note to delete
   * @param skipConfirmation - If true, skip the confirmation dialog (useful for batch operations)
   */
  const deleteNote = useCallback(
    async (noteId: string, skipConfirmation = false): Promise<boolean> => {
      console.log('deleteNote called for:', noteId, 'skipConfirmation:', skipConfirmation);

      if (!skipConfirmation) {
        const confirmed = await confirmDialog('确定要删除这条笔记吗？', {
          title: '确认删除',
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
        });

        console.log('Confirmation result:', confirmed);
        if (!confirmed) {
          return false;
        }
      }

      console.log('Deleting note from state');
      setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteId));

      // Delete from backend
      if (isTauri()) {
        console.log('Calling Tauri remove_temp_note');
        try {
          await invoke('remove_temp_note', { id: noteId });
        } catch (error) {
          console.error('Failed to remove note from backend:', error);
        }
      }

      return true;
    },
    [setNotes]
  );

  /**
   * Toggle pin status of a note
   */
  const togglePin = useCallback(
    async (noteId: string) => {
      const updatedNotes = notes.map((note) =>
        note.id === noteId ? { ...note, pinned: !note.pinned } : note
      );
      setNotes(updatedNotes);

      // Update backend
      if (isTauri()) {
        const updatedNote = updatedNotes.find((n) => n.id === noteId);
        if (updatedNote) {
          try {
            await invoke('store_temp_note', { note: updatedNote });
          } catch (error) {
            console.error('Failed to update pin status in backend:', error);
          }
        }
      }
    },
    [notes, setNotes]
  );

  /**
   * Toggle favorite status of a note
   */
  const toggleFavorite = useCallback(
    async (noteId: string) => {
      const updatedNotes = notes.map((note) =>
        note.id === noteId ? { ...note, favorite: !note.favorite } : note
      );
      setNotes(updatedNotes);

      // Update backend
      if (isTauri()) {
        const updatedNote = updatedNotes.find((n) => n.id === noteId);
        if (updatedNote) {
          try {
            await invoke('store_temp_note', { note: updatedNote });
          } catch (error) {
            console.error('Failed to update favorite status in backend:', error);
          }
        }
      }
    },
    [notes, setNotes]
  );

  /**
   * Toggle archive status of a note
   */
  const toggleArchive = useCallback(
    async (noteId: string) => {
      const updatedNotes = notes.map((note) =>
        note.id === noteId ? { ...note, archived: !note.archived } : note
      );
      setNotes(updatedNotes);

      // Update backend
      if (isTauri()) {
        const updatedNote = updatedNotes.find((n) => n.id === noteId);
        if (updatedNote) {
          try {
            await invoke('store_temp_note', { note: updatedNote });
          } catch (error) {
            console.error('Failed to update archive status in backend:', error);
          }
        }
      }
    },
    [notes, setNotes]
  );

  /**
   * Update a note
   */
  const updateNote = useCallback(
    async (updatedNote: Note) => {
      console.log('[useNoteOperations] updateNote called:', {
        id: updatedNote.id,
        rank: updatedNote.rank,
        hasRank: updatedNote.rank !== undefined,
        title: updatedNote.title,
      });

      // Optimistic update: always update local state immediately for instant UI feedback
      setNotes((prevNotes) =>
        prevNotes.map((n) => (n.id === updatedNote.id ? updatedNote : n))
      );

      if (isTauri()) {
        // Tauri: save to backend
        try {
          await invoke('store_temp_note', { note: updatedNote });
          console.log('[useNoteOperations] Successfully saved to backend:', {
            id: updatedNote.id,
            rank: updatedNote.rank,
          });
        } catch (error) {
          console.error('Failed to save to backend:', error);
          throw error;
        }

        // Broadcast update event to other windows
        try {
          await invoke('broadcast_note_update', { note: updatedNote });
          console.log('[useNoteOperations] Successfully broadcasted note update');
        } catch (error) {
          console.error('Failed to broadcast note update:', error);
        }
      } else {
        // Browser: Broadcast via BroadcastChannel for other tabs
        try {
          const channel = new BroadcastChannel('lovpen-notes-channel');
          channel.postMessage({ type: 'note-updated', note: updatedNote });
          channel.close();
        } catch (error) {
          console.error('Failed to broadcast via BroadcastChannel:', error);
        }
      }
    },
    [setNotes]
  );

  return {
    notes,
    setNotes,
    deleteNote,
    togglePin,
    toggleFavorite,
    toggleArchive,
    updateNote,
  };
};
