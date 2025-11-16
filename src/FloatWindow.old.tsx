import { useEffect, useMemo, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { isTauri } from './utils/tauri';
import { Note } from './store';
import RenderingWysiwygEditor from './components/RenderingWysiwygEditor';
import EditorToolbar from './components/EditorToolbar';
import { NotesSidebarContainer } from './components/shared/NotesSidebarContainer';
import { EditorLayout } from './components/note-editor/EditorLayout';
import { FloatHeader } from './components/note-editor/FloatHeader';
import { useNoteEditorController } from './hooks/useNoteEditorController';
import { useNoteEventSync } from './hooks/useNoteEventSync';
import { useImageHeightSync } from './hooks/useImageHeightSync';
import { useMobileSidebarState } from './hooks/useMobileSidebarState';
import type { RenderingWysiwygEditorRef } from './components/RenderingWysiwygEditor';

function FloatWindow() {
  const editorRef = useRef<RenderingWysiwygEditorRef | null>(null);

  // Use modular hooks for event management
  useNoteEventSync();
  useImageHeightSync();
  const { isMobileSidebarOpen, setIsMobileSidebarOpen, withSidebarClose } = useMobileSidebarState();

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
    currentTags,
    submitDisabled,
    togglePin,
  } = useNoteEditorController({
    mode: 'float',
    noteId: noteId ?? undefined,
    currentNoteId: noteId ?? undefined,
    editorRef,
  });

  // Use withSidebarClose to auto-close mobile sidebar after opening note
  const handleOpenNote = useCallback(
    withSidebarClose(openNoteInNewWindow),
    [withSidebarClose, openNoteInNewWindow]
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
      sidebar={
        <NotesSidebarContainer
          ref={notesListRef}
          notes={notes}
          currentNoteId={noteId ?? undefined}
          showArchived={showArchived}
          onOpenNote={handleOpenNote}
          onTogglePin={togglePin}
          onToggleArchive={toggleArchive}
          onDeleteNote={deleteNote}
          onDuplicateNote={handleDuplicateNote}
        />
      }
      editor={
        <div ref={editorContainerRef}>
          <RenderingWysiwygEditor
            initialContent={content}
            initialRichContent={richContent}
            onChange={handleContentChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
        </div>
      }
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
