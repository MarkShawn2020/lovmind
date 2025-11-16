import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { isTauri } from './utils/tauri';
import LovmindEditor from '@/components/lovmind-editor/lovmind-editor.tsx';
import EditorToolbar from './components/EditorToolbar';
import { NotesSidebarContainer } from './components/shared/NotesSidebarContainer';
import { EditorLayout } from '@/components/lovmind-editor/EditorLayout';
import { FloatHeader } from '@/components/lovmind-editor/FloatHeader';
import { useNoteEventSync } from './hooks/useNoteEventSync';
import { useImageHeightSync } from './hooks/useImageHeightSync';
import { useNoteLoader } from './hooks/useNoteLoader';
import { useMobileSidebarState } from './hooks/useMobileSidebarState';
import { useNoteOperations } from './hooks/useNoteOperations';
import { useWindowOperations } from './hooks/useWindowOperations';
import { currentNoteAtom, editorContentAtom, notesAtom } from './atoms/noteAtoms';
import type { LovmindEditorRef } from '@/components/lovmind-editor/lovmind-editor.tsx';

/**
 * FloatWindow Component (Refactored)
 *
 * Thin wrapper for floating editor window.
 * All editor logic is handled by RenderingWysiwygEditor internally.
 */
function FloatWindow() {
  const editorRef = useRef<LovmindEditorRef | null>(null);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = React.useState(false);

  // Extract noteId from URL
  const noteId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('noteId');
    if (!id) {
      console.error('[FloatWindow] No noteId in URL parameters');
      return null;
    }
    console.log('[FloatWindow] Loading note with ID:', id);
    return id;
  }, []);

  // Load note into atoms (must be called before reading currentNoteAtom)
  useNoteLoader(noteId);

  // Event sync hooks
  useNoteEventSync();
  useImageHeightSync();
  const { isMobileSidebarOpen, setIsMobileSidebarOpen, withSidebarClose } = useMobileSidebarState();

  // Read from atoms (for UI display only)
  const currentNote = useAtomValue(currentNoteAtom);
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);

  // Business logic hooks (for toolbar and sidebar)
  const { togglePin, toggleArchive, deleteNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, () => {});

  // Initialize always-on-top state from window
  useEffect(() => {
    if (!isTauri()) return;

    const initAlwaysOnTop = async () => {
      try {
        const currentWindow = getCurrentWindow();
        const isOnTop = await currentWindow.isAlwaysOnTop();
        setIsAlwaysOnTop(isOnTop);
        console.log('[FloatWindow] Initial always-on-top state:', isOnTop);
      } catch (error) {
        console.error('[FloatWindow] Failed to get always-on-top state:', error);
      }
    };

    void initAlwaysOnTop();
  }, []);

  // Auto-focus window and editor after mount
  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    let rafId: number | null = null;

    const focusEditor = (attemptsLeft: number) => {
      if (cancelled || attemptsLeft <= 0) return;
      const instance = editorRef.current;
      if (instance) {
        instance.focus();
        console.log('[FloatWindow] Editor focus called');
        return;
      }
      rafId = requestAnimationFrame(() => focusEditor(attemptsLeft - 1));
    };

    const focusWindowAndEditor = async () => {
      try {
        const window = getCurrentWindow();
        await window.show();
        await window.setFocus();
        if (cancelled) return;
        console.log('[FloatWindow] Window focused after mount');
        focusEditor(10);
      } catch (error) {
        console.error('[FloatWindow] Failed to focus window:', error);
      }
    };

    void focusWindowAndEditor();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Show loading while note ID is being extracted
  if (!noteId) {
    return (
      <div className="app-container">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading note...
        </div>
      </div>
    );
  }

  // Note: currentNote may be null for newly created notes that haven't been saved yet
  // In that case, LovmindEditor will handle creating the note on first input
  // We don't block rendering - just pass noteId and let the editor handle it

  // Toggle always-on-top state
  const handleToggleAlwaysOnTop = useCallback(async () => {
    if (!isTauri()) return;

    try {
      const currentWindow = getCurrentWindow();
      const newState = !isAlwaysOnTop;
      await currentWindow.setAlwaysOnTop(newState);
      setIsAlwaysOnTop(newState);
      console.log('[FloatWindow] Always-on-top:', newState);
    } catch (error) {
      console.error('[FloatWindow] Failed to toggle always-on-top:', error);
    }
  }, [isAlwaysOnTop]);

  // Use withSidebarClose to auto-close mobile sidebar after opening note
  const handleOpenNote = useCallback(
    withSidebarClose(openNoteInNewWindow),
    [withSidebarClose, openNoteInNewWindow]
  );

  return (
    <EditorLayout
      header={
        <FloatHeader
          currentNote={currentNote || {
            id: noteId,
            text: '',
            title: 'New Note',
            time: new Date().toLocaleString(),
            tags: [],
            richContent: null,
          }}
          notes={notes}
          isEditingTitle={false}
          editingTitle={''}
          onTitleChange={() => {}}
          onStartEditingTitle={() => {}}
          onCancelEditingTitle={() => {}}
          onSaveTitle={async () => {}}
          onHeaderMouseDown={async () => {
            if (!isTauri()) return;
            try {
              const appWindow = getCurrentWindow();
              await appWindow.startDragging();
            } catch (error) {
              console.error('Failed to start dragging:', error);
            }
          }}
          isWindowAlwaysOnTop={isAlwaysOnTop}
          onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
          onCloseWindow={async () => {
            if (isTauri()) {
              const currentWindow = getCurrentWindow();
              await currentWindow.close();
            }
          }}
        />
      }
      sidebar={
        <NotesSidebarContainer
          notes={notes}
          currentNoteId={noteId}
          showArchived={false}
          onOpenNote={handleOpenNote}
          onTogglePin={togglePin}
          onToggleArchive={toggleArchive}
          onDeleteNote={deleteNote}
          onDuplicateNote={async (note) => {
            console.log('Duplicate note:', note);
          }}
        />
      }
      editor={
        <LovmindEditor
          key={noteId}
          noteId={noteId}
          onSubmit={async () => {
            console.log('[FloatWindow] Submit triggered');
          }}
          ref={editorRef}
        />
      }
      toolbar={
        <EditorToolbar
          mode="float"
          onSubmit={async () => {
            console.log('[FloatWindow] Toolbar submit');
          }}
          submitDisabled={editorContent.isEmpty}
          currentTags={editorContent.tags}
          allNotes={notes}
          editorRef={editorRef}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />
      }
      userMenu={null}
      profileModal={null}
      aboutModal={null}
      isMobileSidebarOpen={isMobileSidebarOpen}
      onMobileSidebarChange={setIsMobileSidebarOpen}
    />
  );
}

export default FloatWindow;
