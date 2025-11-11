import { useState, useEffect } from 'react';
import './App.css';
import NoteEditor from './components/NoteEditor';
import { useAtom } from 'jotai';
import { notesAtom, Note } from './store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from './utils/tauri';

function EditorWindow() {
  const [noteId, setNoteId] = useState<string | null>(null);
  const [, setNotes] = useAtom(notesAtom);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('noteId');

    if (!id) {
      console.error('No noteId in URL parameters');
      return;
    }

    console.log('Editor window loading note with ID:', id);
    setNoteId(id);
  }, []);

  // Sync notes from backend on mount
  useEffect(() => {
    if (!isTauri()) return;

    const syncWithBackend = async () => {
      try {
        const backendNotes = await invoke<Note[]>('get_all_temp_notes');
        console.log('[EditorWindow] Synced notes from backend:', backendNotes.length);
        if (backendNotes.length > 0) {
          setNotes(backendNotes);
        }
      } catch (error) {
        console.error('[EditorWindow] Failed to sync with backend:', error);
      }
    };

    syncWithBackend();
  }, [setNotes]);

  // Listen for note updates from other windows
  useEffect(() => {
    if (!isTauri()) return;

    const unlistenNoteUpdate = listen<Note>('global-note-updated', (event) => {
      const updatedNote = event.payload;
      console.log('[EditorWindow] Received note update:', updatedNote.id);

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
    });

    return () => {
      unlistenNoteUpdate.then((fn) => fn());
    };
  }, [setNotes]);

  if (!noteId) {
    return (
      <div className="app-container">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading note...
        </div>
      </div>
    );
  }

  return <NoteEditor mode="edit" noteId={noteId} currentNoteId={noteId} />;
}

export default EditorWindow;
