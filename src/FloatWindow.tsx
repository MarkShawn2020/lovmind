import { useEffect, useMemo, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useAtom } from 'jotai';

import './App.css';
import { isTauri } from './utils/tauri';
import { notesAtom, Note } from './store';
import RenderingWysiwygEditor from './components/RenderingWysiwygEditor';
import EditorToolbar from './components/EditorToolbar';
import { NotesSidebar } from './components/NotesSidebar';
import { EditorLayout } from './components/note-editor/EditorLayout';
import { FloatHeader } from './components/note-editor/FloatHeader';
import { useNoteEditorController } from './hooks/useNoteEditorController';
import type { RenderingWysiwygEditorRef } from './components/RenderingWysiwygEditor';

function FloatWindow() {
  const editorRef = useRef<RenderingWysiwygEditorRef | null>(null);
  const [, setNotes] = useAtom(notesAtom);

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

  // Sync with backend on startup
  useEffect(() => {
    if (!isTauri()) return;

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
        console.error('[FloatWindow] Failed to sync with backend:', error);
      }
    };

    syncWithBackend();
  }, [setNotes]);

  // Listen for global note updates from other windows
  useEffect(() => {
    if (!isTauri()) return;

    console.log('[FloatWindow] Setting up global note update listener...');
    const unlistenNoteUpdate = listen<Note>(
      'global-note-updated',
      async (event) => {
        const updatedNote = event.payload;
        console.log('[FloatWindow] Received global note update:', updatedNote.id);

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

  if (!noteId) {
    return (
      <div className="app-container">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading note...
        </div>
      </div>
    );
  }

  const {
    notes,
    showArchived,
    currentNote,
    isEditingTitle,
    editingTitle,
    handleTitleChange,
    handleStartEditingTitle,
    handleCancelEditingTitle,
    handleSaveTitle,
    handleHeaderMouseDown,
    isWindowAlwaysOnTop,
    handleToggleAlwaysOnTop,
    handleFloatWindowClose,
    handleContentChange,
    handleSubmit,
    editorRef: controlledEditorRef,
    notesListRef,
    editorContainerRef,
    openNoteInNewWindow,
    toggleArchive,
    deleteNote,
    handleDuplicateNote,
    placeholder,
    content,
    richContent,
    currentTags,
    submitDisabled,
    togglePin,
  } = useNoteEditorController({
    mode: 'float',
    noteId: noteId ?? undefined,
    currentNoteId: noteId ?? undefined,
    editorRef,
  });

  const sidebarNode = (
    <div ref={notesListRef}>
      <NotesSidebar
        notes={notes}
        currentNoteId={noteId ?? undefined}
        showArchived={showArchived}
        onOpenNote={openNoteInNewWindow}
        onTogglePin={togglePin}
        onToggleArchive={toggleArchive}
        onDeleteNote={deleteNote}
        onDuplicateNote={handleDuplicateNote}
      />
    </div>
  );

  const editorNode = (
    <div ref={editorContainerRef}>
      <RenderingWysiwygEditor
        ref={controlledEditorRef}
        initialContent={content}
        initialRichContent={richContent}
        onChange={handleContentChange}
        onSubmit={handleSubmit}
        placeholder={placeholder}
      />
    </div>
  );

  console.log('[Perf] FloatWindow rendering layout with noteId:', noteId);
  return (
    <EditorLayout
      header={
        <FloatHeader
          currentNote={currentNote}
          notes={notes}
          isEditingTitle={isEditingTitle}
          editingTitle={editingTitle}
          onTitleChange={handleTitleChange}
          onStartEditingTitle={handleStartEditingTitle}
          onCancelEditingTitle={handleCancelEditingTitle}
          onSaveTitle={handleSaveTitle}
          onHeaderMouseDown={handleHeaderMouseDown}
          isWindowAlwaysOnTop={isWindowAlwaysOnTop}
          onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
          onCloseWindow={handleFloatWindowClose}
        />
      }
      sidebar={sidebarNode}
      editor={editorNode}
      toolbar={<EditorToolbar mode="float" onSubmit={handleSubmit} submitDisabled={submitDisabled} currentTags={currentTags} allNotes={notes} editorRef={controlledEditorRef} />}
      userMenu={null}
      profileModal={null}
      aboutModal={null}
    />
  );
}

export default FloatWindow;
