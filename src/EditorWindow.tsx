import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './App.css';
import NoteEditor from './components/NoteEditor';
import { isTauri } from './utils/tauri';

function EditorWindow() {
  const [noteId, setNoteId] = useState<string | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

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

  const toggleAlwaysOnTop = async () => {
    if (!isTauri()) return;

    try {
      const window = getCurrentWindow();
      const newState = !alwaysOnTop;
      await window.setAlwaysOnTop(newState);
      setAlwaysOnTop(newState);
    } catch (error) {
      console.error('Failed to toggle always on top:', error);
    }
  };

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
      <button
        onClick={toggleAlwaysOnTop}
        className={`fixed top-4 right-4 z-50 p-2 rounded-lg transition-colors ${
          alwaysOnTop
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        title={alwaysOnTop ? '取消置顶' : '窗口置顶'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v20M2 12h20"/>
        </svg>
      </button>
      <NoteEditor
        mode="edit"
        noteId={noteId}
        currentNoteId={noteId}
      />
    </div>
  );
}

export default EditorWindow;
