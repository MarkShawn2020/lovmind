import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { isTauri } from './utils/tauri';
import RenderingWysiwygEditor from './components/RenderingWysiwygEditor';
import EditorToolbar from './components/EditorToolbar';
import { NotesSidebarContainer } from './components/shared/NotesSidebarContainer';
import { EditorLayout } from './components/note-editor/EditorLayout';
import { FloatHeader } from './components/note-editor/FloatHeader';
import { useNoteEventSync } from './hooks/useNoteEventSync';
import { useImageHeightSync } from './hooks/useImageHeightSync';
import { useMobileSidebarState } from './hooks/useMobileSidebarState';
import { useNoteLoader } from './hooks/useNoteLoader';
import { useEditorSync } from './hooks/useEditorSync';
import { useAutoSave } from './hooks/useAutoSave';
import { useNoteOperations } from './hooks/useNoteOperations';
import { useWindowOperations } from './hooks/useWindowOperations';
import { currentNoteAtom, editorContentAtom, notesAtom } from './atoms/noteAtoms';
import type { RenderingWysiwygEditorRef } from './components/RenderingWysiwygEditor';

/**
 * FloatWindow Component (Refactored)
 *
 * Displays a floating editor window for editing a single note.
 * Uses Jotai atoms for state management instead of useNoteEditorController.
 *
 * Architecture:
 * - Reads note ID from URL params
 * - Uses useNoteLoader to load note into atoms
 * - Reads currentNote/editorContent from atoms (no local state!)
 * - Business logic in focused hooks (useEditorSync, useAutoSave, etc.)
 * - Pure rendering component
 */
function FloatWindow() {
  const editorRef = useRef<RenderingWysiwygEditorRef | null>(null);

  // Modular event hooks
  useNoteEventSync();
  useImageHeightSync();
  const { isMobileSidebarOpen, setIsMobileSidebarOpen, withSidebarClose } = useMobileSidebarState();

  // Extract noteId from URL (once on mount)
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

  // Load note into atoms
  useNoteLoader(noteId);

  // Read from atoms (no local state!)
  const currentNote = useAtomValue(currentNoteAtom);
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);

  // Business logic hooks
  const { handleContentChange } = useEditorSync();
  useAutoSave(); // Automatically saves on typing-stop
  const { togglePin, toggleArchive, deleteNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, () => {}); // setNotes not needed with atoms

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
      <div className="app-container">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading note data...
        </div>
      </div>
    );
  }

  // Use withSidebarClose to auto-close mobile sidebar after opening note
  const handleOpenNote = useCallback(
    withSidebarClose(openNoteInNewWindow),
    [withSidebarClose, openNoteInNewWindow]
  );

  // Note: We removed all handler functions that were extracted from useNoteEditorController
  // They're now either in hooks or directly handled by child components reading atoms

  console.log('[Perf] FloatWindow rendering layout with noteId:', noteId);

  return (
    <EditorLayout
      header={
        <FloatHeader
          currentNote={currentNote}
          notes={notes}
          // Title editing will be handled inside FloatHeader by reading/writing atoms
          // For now, keep the old props structure for compatibility
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
          isWindowAlwaysOnTop={false} // TODO: Read from atom
          onToggleAlwaysOnTop={async () => {}} // TODO: Implement
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
          showArchived={false} // TODO: Read from uiStateAtom
          onOpenNote={handleOpenNote}
          onTogglePin={togglePin}
          onToggleArchive={toggleArchive}
          onDeleteNote={deleteNote}
          onDuplicateNote={async (note) => {
            // TODO: Implement duplicate in useNoteOperations
            console.log('Duplicate note:', note);
          }}
        />
      }
      editor={
        <RenderingWysiwygEditor
          key={currentNote.id}
          initialRichContent={currentNote.richContent}
          onChange={handleContentChange}
          onSubmit={async () => {
            // Submit handler - for float window, just save
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
