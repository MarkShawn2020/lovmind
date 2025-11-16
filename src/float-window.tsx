import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useAtomValue } from 'jotai';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';

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
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

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
  const { togglePin, toggleArchive, deleteNote, setNotes, updateNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, () => {});

  // Use withSidebarClose to auto-close mobile sidebar after opening note
  // MUST be declared before conditional returns
  const handleOpenNote = useCallback(
    withSidebarClose(openNoteInNewWindow),
    [withSidebarClose, openNoteInNewWindow]
  );

  // Submit handler: Save note content on Cmd+Enter
  const handleSubmit = useCallback(async () => {
    console.log('[FloatWindow] Submit handler called');

    // Extract fresh content synchronously from editor to avoid race conditions
    let currentContent = editorContent;

    if (editorRef.current?.editor) {
      try {
        const editor = editorRef.current.editor;
        if (editor?.children) {
          const { extractTextContent } = await import('./utils/extract-text-content');
          const { isEditorContentEmpty } = await import('./utils/is-editor-content-empty');

          const { text, tags } = extractTextContent(editor.children);
          const isEmpty = isEditorContentEmpty(editor.children);

          currentContent = {
            text,
            tags,
            richContent: editor.children,
            isEmpty,
            sourceNoteId: editorContent.sourceNoteId,
          };

          console.log('[FloatWindow] Extracted content from editor:', { text, tags, isEmpty });
        }
      } catch (error) {
        console.warn('[FloatWindow] Failed to extract sync content, using atom:', error);
      }
    }

    const hasTypedContent = typeof currentContent.text === 'string' && Boolean(currentContent.text.trim());
    if (!hasTypedContent && currentContent.isEmpty) {
      console.log('[FloatWindow] Empty content, skipping submit');
      return;
    }

    try {
      const existingNote = notes.find(n => n.id === noteId);

      if (existingNote) {
        // Update existing note
        const { extractNoteTitle } = await import('./utils/titleExtractor');
        const updatedNote = {
          ...existingNote,
          text: currentContent.text,
          tags: currentContent.tags,
          richContent: currentContent.richContent,
          title: existingNote.manualTitle
            ? existingNote.title
            : extractNoteTitle({ text: currentContent.text, richContent: currentContent.richContent }),
          time: new Date().toLocaleString(),
        };

        await updateNote(updatedNote);
        console.log('[FloatWindow] ✅ Note updated:', updatedNote.id);
      } else {
        // Create new note (for blank notes from Cmd+N)
        const { extractNoteTitle } = await import('./utils/titleExtractor');
        const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
        const newRank = Math.max(maxRank + 1, notes.length + 1);

        const newNote = {
          id: noteId!,
          text: currentContent.text,
          title: extractNoteTitle({ text: currentContent.text, richContent: currentContent.richContent }),
          time: new Date().toLocaleString(),
          tags: currentContent.tags,
          richContent: currentContent.richContent,
          pinned: false,
          archived: false,
          favorite: false,
          rank: newRank,
        };

        // Add to local state
        setNotes((prevNotes) => [newNote, ...prevNotes]);

        // Trigger confetti celebration for new note creation
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ff3366', '#ff66cc', '#ff99dd', '#9966ff', '#6699ff'],
          ticks: 200,
          gravity: 1.2,
          scalar: 1.2,
          shapes: ['star', 'circle'],
          drift: 0
        });

        // Save to backend
        if (isTauri()) {
          try {
            await invoke('store_temp_note', { note: newNote });
            await invoke('broadcast_note_update', { note: newNote });
            console.log('[FloatWindow] ✅ Note created and broadcasted:', newNote.id);
          } catch (error) {
            console.error('[FloatWindow] Failed to save to backend:', error);
          }
        }
      }
    } catch (error) {
      console.error('[FloatWindow] Failed to submit note:', error);
    }
  }, [editorContent, noteId, notes, setNotes, updateNote]);

  // Toggle always-on-top state
  const handleToggleAlwaysOnTop = useCallback(async () => {
    if (!isTauri()) return;

    try {
      const window = getCurrentWindow();
      const newState = !isAlwaysOnTop;
      await window.setAlwaysOnTop(newState);
      setIsAlwaysOnTop(newState);
      console.log('[FloatWindow] ✅ Toggled always on top:', newState);
    } catch (error) {
      console.error('[FloatWindow] ❌ Failed to toggle always on top:', error);
    }
  }, [isAlwaysOnTop]);

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
  const displayNote = currentNote || existingNoteInArray || {
    id: noteId!,
    title: 'New Note',
    text: '',
    time: new Date().toISOString(),
    tags: [],
    richContent: null,
    rank: undefined, // Will be calculated dynamically by FloatHeader
  };

  return (
    <EditorLayout
      header={
        <FloatHeader
          currentNote={displayNote}
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
