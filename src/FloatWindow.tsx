import { useEffect, useMemo, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import './App.css';
import { isTauri } from './utils/tauri';
import RenderingWysiwygEditor from './components/RenderingWysiwygEditor';
import EditorToolbar from './components/EditorToolbar';
import { NotesSidebar } from './components/NotesSidebar';
import { FloatHeader } from './components/note-editor/FloatHeader';
import { useNoteEditorController } from './hooks/useNoteEditorController';
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
    submitDisabled,
    togglePin,
  } = useNoteEditorController({
    mode: 'float',
    noteId: noteId ?? undefined,
    currentNoteId: noteId ?? undefined,
    editorRef,
  });

  console.log('[Perf] FloatWindow rendering layout with noteId:', noteId);
  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-transparent rounded-xl">
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

      <div className="flex-1 flex min-h-0">
        <aside className="hidden sm:flex w-80 border-r border-border bg-muted flex-shrink-0 overflow-hidden flex-col">
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-[var(--spacing-s)]" ref={notesListRef}>
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
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden min-h-0 bg-background" ref={editorContainerRef}>
            <RenderingWysiwygEditor
              ref={controlledEditorRef}
              initialContent={content}
              initialRichContent={richContent}
              onChange={handleContentChange}
              onSubmit={handleSubmit}
              placeholder={placeholder}
            />
          </div>

          <EditorToolbar mode="float" onSubmit={handleSubmit} submitDisabled={submitDisabled} />
        </div>
      </div>
    </div>
  );
}

export default FloatWindow;
