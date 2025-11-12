import { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import NoteEditor from './components/NoteEditor';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './utils/tauri';
import type { RenderingWysiwygEditorRef } from './components/RenderingWysiwygEditor';

function FloatWindow() {
  const editorRef = useRef<RenderingWysiwygEditorRef | null>(null);

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

  // Auto-focus window and editor after component mounts
  useEffect(() => {
    if (!isTauri()) return;

    const focusWindowAndEditor = async () => {
      try {
        const window = getCurrentWindow();
        // Step 1: Ensure window is shown and focused
        await window.show();
        await window.setFocus();
        console.log('[FloatWindow] Window focused after mount');

        // Step 2: Focus the editor (critical for input!)
        // Add extra delay to ensure editor is fully mounted
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            console.log('[FloatWindow] Editor focus called');
          } else {
            console.warn('[FloatWindow] Editor ref not available yet');
          }
        }, 100);
      } catch (error) {
        console.error('[FloatWindow] Failed to focus window:', error);
      }
    };

    // Delay to ensure window and content are fully ready
    const timer = setTimeout(focusWindowAndEditor, 150);
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
  return <NoteEditor mode="float" noteId={noteId} currentNoteId={noteId} editorRef={editorRef} />;
}

export default FloatWindow;
