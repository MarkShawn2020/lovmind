import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useAtom, useSetAtom } from 'jotai';

import './App.css';
import { isTauri } from './utils/tauri';
import { notesAtom, Note, imageMaxHeightAtom } from './store';
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
  const setImageMaxHeight = useSetAtom(imageMaxHeightAtom);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showAutoSaveToast, setShowAutoSaveToast] = useState(false);

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

    // 监听图片最大高度变化事件
    console.log('[FloatWindow] Setting up image max height listener...');
    const unlistenImageHeight = listen<{ value: number }>(
      'image-max-height-changed',
      (event) => {
        const newHeight = event.payload.value;
        console.log('[FloatWindow] Received image-max-height-changed:', newHeight);
        setImageMaxHeight(newHeight);
      }
    );

    return () => {
      unlistenNoteUpdate.then((fn) => fn());
      unlistenImageHeight.then((fn) => fn());
    };
  }, [setNotes, setImageMaxHeight]);

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

  // Wrap onOpenNote to close mobile sidebar after note selection
  const handleOpenNote = useCallback((note: Note) => {
    openNoteInNewWindow(note);
    // Close mobile sidebar drawer on note selection
    setIsMobileSidebarOpen(false);
  }, [openNoteInNewWindow]);

  const sidebarNode = (
    <div ref={notesListRef} className="h-full">
      <NotesSidebar
        notes={notes}
        currentNoteId={noteId ?? undefined}
        showArchived={showArchived}
        onOpenNote={handleOpenNote}
        onTogglePin={togglePin}
        onToggleArchive={toggleArchive}
        onDeleteNote={deleteNote}
        onDuplicateNote={handleDuplicateNote}
      />
    </div>
  );

  const editorNode = (
    <div ref={editorContainerRef} className="relative h-full">
      {/* Auto-save toast - positioned at editor viewport level, not inside scrollable content */}
      {showAutoSaveToast && (
        <div
          className="absolute top-2 right-2 z-50 px-3 py-1.5 bg-background/95 backdrop-blur-sm border border-border/40 rounded-md shadow-sm text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          已自动保存
        </div>
      )}

      <RenderingWysiwygEditor
        ref={controlledEditorRef}
        initialContent={content}
        initialRichContent={richContent}
        onChange={handleContentChange}
        onSubmit={handleSubmit}
        placeholder={placeholder}
        onAutoSaveToastChange={setShowAutoSaveToast}
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
      toolbar={
        <EditorToolbar
          mode="float"
          onSubmit={handleSubmit}
          submitDisabled={submitDisabled}
          currentTags={currentTags}
          allNotes={notes}
          editorRef={controlledEditorRef}
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
