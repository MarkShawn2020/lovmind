import { useState, useEffect, useMemo } from 'react';
import './App.css';
import NoteEditor from './components/NoteEditor';

function FloatWindow() {
  // Extract noteId synchronously to avoid double-render
  const noteId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('noteId');

    if (!id) {
      console.error('No noteId in URL parameters');
      return null;
    }

    console.log('Float window loading note with ID:', id);
    return id;
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

  console.log('[Perf] FloatWindow rendering NoteEditor with noteId:', noteId);
  return <NoteEditor mode="edit" noteId={noteId} currentNoteId={noteId} />;
}

export default FloatWindow;
