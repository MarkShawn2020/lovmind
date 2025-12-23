import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Toaster } from 'sonner';

import { isTauri } from './utils/tauri';
import LovmindEditor from '@/components/lovmind-editor/lovmind-editor.tsx';
import EditorToolbar from './components/EditorToolbar';
import { NotesSidebarContainer } from './components/shared/NotesSidebarContainer';
import { EditorLayout } from '@/components/lovmind-editor/EditorLayout';
import { FloatHeader } from '@/components/lovmind-editor/FloatHeader';
import { useNoteEventSync } from './hooks/useNoteEventSync';
import { useImageHeightSync } from './hooks/useImageHeightSync';
import { useMobileSidebarState } from './hooks/useMobileSidebarState';
import { useNoteOperations } from './hooks/useNoteOperations';
import { useWindowOperations } from './hooks/useWindowOperations';
import { useNoteLoader } from './hooks/useNoteLoader';
import { useNoteSubmit } from './hooks/useNoteSubmit';
import { currentNoteAtom, editorContentAtom, notesAtom, currentNoteIdAtom } from './atoms/noteAtoms';
import { getStoreValue, type DraftContent } from './store';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { LovmindEditorRef } from '@/components/lovmind-editor/lovmind-editor.tsx';

/**
 * FloatWindow Component (Refactored)
 *
 * Thin wrapper for floating editor window.
 * All editor logic is handled by RenderingWysiwygEditor internally.
 */
function FloatWindowInner() {
  const editorRef = useRef<LovmindEditorRef | null>(null);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isTogglingAlwaysOnTop, setIsTogglingAlwaysOnTop] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');

  // Extract initial noteId and rank from URL
  const { initialNoteId, initialRank } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('noteId');
    const rankStr = params.get('rank');
    const rank = rankStr ? parseInt(rankStr, 10) : undefined;

    if (!id) {
      console.error('[FloatWindow] No noteId in URL parameters');
      return { initialNoteId: null, initialRank: undefined };
    }

    console.log('[FloatWindow] Loading note with ID:', id, 'rank:', rank);
    return { initialNoteId: id, initialRank: rank };
  }, []);

  // Active noteId (can change after reset)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(initialNoteId);
  const noteId = activeNoteId;

  // Event sync hooks
  useNoteEventSync();
  useImageHeightSync();
  const { isMobileSidebarOpen, setIsMobileSidebarOpen, withSidebarClose } = useMobileSidebarState();

  // Load note into atoms (CRITICAL: Must be called before checking currentNote)
  // Note: LovmindEditor also calls useNoteLoader internally, but this is fine
  // because the hook is idempotent. We need to call it here to ensure currentNoteAtom
  // is populated before rendering the UI that depends on it.
  useNoteLoader(noteId);

  // Read from atoms (for UI display only)
  const currentNote = useAtomValue(currentNoteAtom);
  const currentNoteId = useAtomValue(currentNoteIdAtom);
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);
  const setEditorContent = useSetAtom(editorContentAtom);

  // Check and restore draft for new notes (only once on mount)
  // After restore, useDraftSync in LovmindEditor keeps both windows in sync
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current || !noteId) return;

    const loadAndRestoreDraft = async () => {
      try {
        // Check if this note already exists in backend
        const existingNote = await invoke<any>('get_temp_note', { id: noteId });
        if (existingNote) {
          console.log('[FloatWindow] Note exists in backend, not restoring draft');
          return;
        }

        // Read draft directly from Tauri Store (async, cross-window safe)
        const draft = await getStoreValue<DraftContent | null>('lovpen-draft', null);

        if (!draft || !draft.text?.trim()) {
          console.log('[FloatWindow] No draft to restore');
          return;
        }

        draftRestoredRef.current = true;

        // Restore draft content to editor
        // Set sourceNoteId to noteId so LovmindEditor's useEffect will update the editor
        setEditorContent({
          text: draft.text,
          tags: draft.tags,
          richContent: draft.richContent,
          isEmpty: false,
          sourceNoteId: noteId, // Must match noteId for LovmindEditor to update
        });

        // Don't clear draft or emit draft-consumed
        // useDraftSync will keep both windows in sync from now on

        console.log('[FloatWindow] Restored draft from Tauri Store:', draft.savedAt);
      } catch (error) {
        console.error('[FloatWindow] Failed to restore draft:', error);
      }
    };

    loadAndRestoreDraft();
  }, [noteId, setEditorContent]);

  // Debug logging
  useEffect(() => {
    console.log('[FloatWindow] State changed:', {
      noteId,
      currentNoteId,
      currentNote: currentNote ? { id: currentNote.id, title: currentNote.title } : null,
      notesCount: notes.length,
      editorContentSourceNoteId: editorContent.sourceNoteId
    });
  }, [noteId, currentNoteId, currentNote, notes.length, editorContent.sourceNoteId]);

  // Business logic hooks (for toolbar and sidebar)
  // CRITICAL: These hooks must be called before any conditional returns
  // to satisfy the Rules of Hooks
  const { togglePin, toggleArchive, deleteNote, updateNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, () => {});
  const { handleSubmit } = useNoteSubmit({
    noteId,
    editorRef,
    // Reset editor after creating new note, only in pinned mode
    resetEditorAfterCreate: () => isAlwaysOnTop,
    // Update activeNoteId when creating a new note after reset
    onNoteIdChange: (newNoteId) => {
      console.log('[FloatWindow] Switching to new noteId:', newNoteId);
      setActiveNoteId(newNoteId);
    },
    // Close window after submit in normal (non-pinned) mode
    onCloseWindow: async () => {
      if (!isAlwaysOnTop && isTauri()) {
        const currentWindow = getCurrentWindow();
        await currentWindow.close();
        console.log('[FloatWindow] Window closed after submit (normal mode)');
      }
    },
  });

  // Title editing handlers
  const handleTitleChange = useCallback((value: string) => {
    setEditingTitle(value);
  }, []);

  const handleStartEditingTitle = useCallback((title: string) => {
    setEditingTitle(title);
    setIsEditingTitle(true);
  }, []);

  const handleCancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleSaveTitle = useCallback(async () => {
    if (!editingTitle.trim() || !noteId) {
      setIsEditingTitle(false);
      return;
    }

    // For blank notes: currentNote is null, so we need to build the note object
    const existingNote = currentNote || notes.find(n => n.id === noteId);
    const baseNote = existingNote || {
      id: noteId,
      title: 'New Note',
      text: '',
      time: new Date().toISOString(),
      tags: [],
      richContent: null,
      rank: initialRank,
    };

    const updatedNote = {
      ...baseNote,
      title: editingTitle.trim(),
      manualTitle: true, // Mark as manually edited
    };

    try {
      await updateNote(updatedNote);

      if (isTauri()) {
        try {
          const currentWindow = getCurrentWindow();
          await currentWindow.setTitle(`Edit: ${updatedNote.title}`);
        } catch (error) {
          console.error('[FloatWindow] Failed to update window title:', error);
        }
      }

      setIsEditingTitle(false);
      console.log('[FloatWindow] Title saved:', updatedNote.title);
    } catch (error) {
      console.error('[FloatWindow] Failed to save title:', error);
      setIsEditingTitle(false);
    }
  }, [currentNote, notes, noteId, initialRank, editingTitle, updateNote]);

  // Use withSidebarClose to auto-close mobile sidebar after opening note
  // MUST be declared before conditional returns
  const handleOpenNote = useCallback(
    withSidebarClose(openNoteInNewWindow),
    [withSidebarClose, openNoteInNewWindow]
  );

  // Toggle always-on-top state
  const handleToggleAlwaysOnTop = useCallback(async () => {
    if (!isTauri() || isTogglingAlwaysOnTop) return;

    setIsTogglingAlwaysOnTop(true);
    try {
      const window = getCurrentWindow();
      const newState = !isAlwaysOnTop;
      await window.setAlwaysOnTop(newState);
      setIsAlwaysOnTop(newState);
      console.log('[FloatWindow] ✅ Toggled always on top:', newState);
    } catch (error) {
      console.error('[FloatWindow] ❌ Failed to toggle always on top:', error);
    } finally {
      setIsTogglingAlwaysOnTop(false);
    }
  }, [isAlwaysOnTop, isTogglingAlwaysOnTop]);

  // Keyboard shortcut: Cmd+T to toggle always-on-top
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+T (Mac) or Ctrl+T (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 't') {
        event.preventDefault();
        handleToggleAlwaysOnTop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleAlwaysOnTop]);

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

  // Listen for draft-submitted event and close window if not pinned
  useEffect(() => {
    if (!isTauri()) return;

    const unlistenPromise = listen<{ noteId: string }>('draft-submitted', async () => {
      // Don't close if window is pinned (always-on-top mode)
      if (isAlwaysOnTop) {
        console.log('[FloatWindow] Draft submitted but window is pinned, staying open');
        // Reset editor for new note
        editorRef.current?.resetAndFocus();
        return;
      }

      console.log('[FloatWindow] Draft submitted, closing window');
      const currentWindow = getCurrentWindow();
      await currentWindow.close();
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [isAlwaysOnTop]);

  // Show loading while note is being loaded
  if (!noteId) {
    return (
      <div className="app-container">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading note...
        </div>
      </div>
    );
  }

  // For blank notes (new note creation via Cmd+N):
  // - Backend doesn't persist blank notes until user writes content (lib.rs:355)
  // - currentNote will be null, but we should still render the editor
  // - The note will be created and persisted on first submit
  const isBlankNote = !currentNote && noteId;

  if (isBlankNote) {
    console.log('[FloatWindow] Rendering blank note (not persisted yet):', noteId);
    // Continue to render the UI with empty/default values
  }

  // All hooks are called above, before any conditional returns
  // Now safe to render the full UI

  // Create a fallback note object for blank notes
  // Check if note exists in notes array (may have been created but not yet synced to currentNote)
  const existingNoteInArray = notes.find(n => n.id === noteId);

  // Check if this is a temporary noteId (created after reset)
  const isTempNote = noteId?.startsWith('temp-');

  const displayNote = currentNote || existingNoteInArray || {
    id: noteId!,
    title: isTempNote ? '新笔记' : 'New Note',
    text: '',
    time: new Date().toISOString(),
    tags: [],
    richContent: null,
    rank: initialRank, // Use rank from URL (passed by Rust backend during Cmd+N)
  };

  return (
    <EditorLayout
      header={
        <FloatHeader
          currentNote={displayNote}
          notes={notes}
          isEditingTitle={isEditingTitle}
          editingTitle={editingTitle}
          onTitleChange={handleTitleChange}
          onStartEditingTitle={handleStartEditingTitle}
          onCancelEditingTitle={handleCancelEditingTitle}
          onSaveTitle={handleSaveTitle}
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
          key={noteId || 'loading'}
          noteId={noteId}
          onSubmit={handleSubmit}
          ref={editorRef}
        />
      }
      toolbar={
        <EditorToolbar
          mode="float"
          onSubmit={handleSubmit}
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

// Wrap with ErrorBoundary to catch any rendering errors
function FloatWindow() {
  return (
    <>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          console.error('[FloatWindow] ErrorBoundary caught error:', error);
          console.error('[FloatWindow] Component stack:', errorInfo.componentStack);
        }}
      >
        <FloatWindowInner />
      </ErrorBoundary>

      {/* Toast notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
          },
        }}
      />
    </>
  );
}

export default FloatWindow;
