import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
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
import { useMobileSidebarState } from './hooks/useMobileSidebarState';
import { useNoteOperations } from './hooks/useNoteOperations';
import { useWindowOperations } from './hooks/useWindowOperations';
import { useNoteLoader } from './hooks/useNoteLoader';
import { currentNoteAtom, editorContentAtom, notesAtom, currentNoteIdAtom } from './atoms/noteAtoms';
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

  // Local state for always-on-top
  const [isWindowAlwaysOnTop, setIsWindowAlwaysOnTop] = useState(false);

  // Event sync hooks
  useNoteEventSync();
  useImageHeightSync();
  const { isMobileSidebarOpen, setIsMobileSidebarOpen, withSidebarClose } = useMobileSidebarState();

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
  const { togglePin, toggleArchive, deleteNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, () => {});

  // Use withSidebarClose to auto-close mobile sidebar after opening note
  // MUST be declared before conditional returns
  const handleOpenNote = useCallback(
    withSidebarClose(openNoteInNewWindow),
    [withSidebarClose, openNoteInNewWindow]
  );

  // Toggle always-on-top functionality
  const handleToggleAlwaysOnTop = useCallback(async (e?: React.MouseEvent) => {
    console.log('[FloatWindow] handleToggleAlwaysOnTop called', {
      event: e?.type,
      currentState: isWindowAlwaysOnTop,
      isTauri: isTauri()
    });

    if (!isTauri()) {
      console.warn('[FloatWindow] Not in Tauri environment, cannot toggle always on top');
      return;
    }

    try {
      const window = getCurrentWindow();
      const newState = !isWindowAlwaysOnTop;

      console.log('[FloatWindow] Calling window.setAlwaysOnTop with:', newState);
      await window.setAlwaysOnTop(newState);

      setIsWindowAlwaysOnTop(newState);
      console.log('[FloatWindow] ✅ Always on top toggled successfully:', newState);
    } catch (error) {
      console.error('[FloatWindow] ❌ Failed to toggle always on top:', error);
    }
  }, [isWindowAlwaysOnTop]);

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

  // Show loading if currentNote not yet loaded
  if (!currentNote) {
    return (
      <div className="app-container flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          {/* Animated spinner */}
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>

          {/* Loading text with pulse animation */}
          <div className="animate-pulse text-lg font-medium">
            Loading note data...
          </div>

          {/* Debug info (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 text-xs text-muted-foreground space-y-1 opacity-50">
              <div>Note ID: {noteId}</div>
              <div>Notes count: {notes.length}</div>
              <div>Current note ID: {currentNoteId || 'null'}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // All hooks are called above, before any conditional returns
  // Now safe to render the full UI

  return (
    <EditorLayout
      header={
        <FloatHeader
          currentNote={currentNote}
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
          isWindowAlwaysOnTop={isWindowAlwaysOnTop}
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
          key={currentNote?.id || 'loading'}
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

// Wrap with ErrorBoundary to catch any rendering errors
function FloatWindow() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[FloatWindow] ErrorBoundary caught error:', error);
        console.error('[FloatWindow] Component stack:', errorInfo.componentStack);
      }}
    >
      <FloatWindowInner />
    </ErrorBoundary>
  );
}

export default FloatWindow;
