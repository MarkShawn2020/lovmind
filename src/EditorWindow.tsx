import { useState, useEffect } from 'react';
import './App.css';
import NoteEditor from './components/NoteEditor';

function EditorWindow() {
  const [noteId, setNoteId] = useState<string | null>(null);

  useEffect(() => {
    // Get noteId from URL parameters
    const params = new URLSearchParams(window.location.search);
    const id = params.get('noteId');

    if (!id) {
      console.error('No noteId in URL parameters');
      return;
    }

    console.log('Editor window loading note with ID:', id);
    setNoteId(id);
  }, []);

  if (!noteId) {
    return (
      <div className="app-container">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading note...
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <NoteEditor
        mode="edit"
        noteId={noteId}
        currentNoteId={noteId}
      />
    </div>
  );
}

export default EditorWindow;
