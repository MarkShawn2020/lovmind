import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

import { isTauri } from '@/utils/tauri';
import { notesAtom, Note } from '@/store';

/**
 * Synchronizes notes across windows via Tauri events and backend storage
 * Handles:
 * - global-note-updated event listener
 * - Backend sync on mount
 * - BroadcastChannel for browser mode
 */
export function useNoteEventSync(options?: { enableBroadcastChannel?: boolean }) {
  const setNotes = useSetAtom(notesAtom);
  const { enableBroadcastChannel = false } = options || {};

  // Tauri event listeners and backend sync
  useEffect(() => {
    if (!isTauri()) return;

    // Sync with backend on mount
    const syncWithBackend = async () => {
      try {
        const backendNotes = await invoke<Note[]>('get_all_temp_notes');
        if (backendNotes.length > 0) {
          setNotes((prevNotes) => {
            const noteMap = new Map(prevNotes.map((n) => [n.id, n]));
            backendNotes.forEach((backendNote) => {
              noteMap.set(backendNote.id, backendNote);
            });
            return Array.from(noteMap.values());
          });
        }
      } catch (error) {
        console.error('Failed to sync with backend:', error);
      }
    };

    syncWithBackend();

    // Listen for global note updates
    console.log('Setting up global note update listener...');
    const unlistenNoteUpdate = listen<Note>(
      'global-note-updated',
      async (event) => {
        const updatedNote = event.payload;
        console.log('Received global note update:', updatedNote);

        setNotes((prevNotes) => {
          const existingNoteIndex = prevNotes.findIndex(
            (n) => n.id === updatedNote.id
          );

          if (existingNoteIndex !== -1) {
            const newNotes = [...prevNotes];
            newNotes[existingNoteIndex] = updatedNote;
            return newNotes;
          } else {
            return [...prevNotes, updatedNote];
          }
        });
      }
    );

    return () => {
      unlistenNoteUpdate.then((fn) => fn());
    };
  }, [setNotes]);

  // BroadcastChannel for browser mode
  useEffect(() => {
    if (isTauri() || !enableBroadcastChannel) return;

    const channel = new BroadcastChannel('lovpen-notes-channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'note-updated') {
        const updatedNote = event.data.note as Note;
        setNotes((prevNotes) => {
          const existingNoteIndex = prevNotes.findIndex((n) => n.id === updatedNote.id);
          if (existingNoteIndex !== -1) {
            const newNotes = [...prevNotes];
            newNotes[existingNoteIndex] = updatedNote;
            return newNotes;
          } else {
            return [...prevNotes, updatedNote];
          }
        });
      }
    };

    return () => channel.close();
  }, [setNotes, enableBroadcastChannel]);
}
