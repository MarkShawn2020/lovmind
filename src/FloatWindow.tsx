import { useState, useEffect, useMemo } from 'react';
import './App.css';
import NoteEditor from './components/NoteEditor';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './utils/tauri';

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

  // Auto-focus window after component mounts
  useEffect(() => {
    if (!isTauri()) return;

    const focusWindow = async () => {
      try {
        const window = getCurrentWindow();
        await window.setFocus();
        console.log('[FloatWindow] Window focused after mount');
      } catch (error) {
        console.error('[FloatWindow] Failed to focus window:', error);
      }
    };

    // Small delay to ensure window is fully ready
    const timer = setTimeout(focusWindow, 50);
    return () => clearTimeout(timer);
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
  return <NoteEditor mode="float" noteId={noteId} currentNoteId={noteId} />;
}

export default FloatWindow;
