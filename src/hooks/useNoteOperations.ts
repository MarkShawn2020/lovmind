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
   * Delete a note with confirmation
   */
  const deleteNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      console.log('deleteNote called for:', noteId);

      const confirmed = await confirmDialog('确定要删除这条笔记吗？', {
        title: '确认删除',
        okLabel: '删除',
        cancelLabel: '取消',
      });

      console.log('Confirmation result:', confirmed);
      if (!confirmed) {
        return false;
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

      // CRITICAL FIX: Always update Jotai atom first (persistent storage)
      setNotes((prevNotes) => {
        const existingIndex = prevNotes.findIndex((n) => n.id === updatedNote.id);
        if (existingIndex !== -1) {
          const newNotes = [...prevNotes];
          newNotes[existingIndex] = updatedNote;
          return newNotes;
        } else {
          return [...prevNotes, updatedNote];
        }
      });

      if (isTauri()) {
        // Tauri: save to backend temp store
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

        // Broadcast update event to all windows
        try {
          await invoke('broadcast_note_update', { note: updatedNote });
          console.log('[useNoteOperations] Successfully broadcasted note update');
        } catch (error) {
          console.error('Failed to broadcast note update:', error);
        }
      } else {
        // Browser: Broadcast via BroadcastChannel
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
