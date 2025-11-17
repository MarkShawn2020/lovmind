import { useState, useCallback, useRef } from "react";
import { useAtomValue } from 'jotai';
import { Plus } from "lucide-react";

import { Note } from "./store";
import LovmindEditor from "@/components/lovmind-editor/lovmind-editor.tsx";
import EditorToolbar from "./components/EditorToolbar";
import ProfileModal from "./components/ProfileModal";
import { EditorLayout } from "@/components/lovmind-editor/EditorLayout";
import { MainHeader } from "@/components/lovmind-editor/MainHeader";
import { NotesSidebarContainer } from "./components/shared/NotesSidebarContainer";
import { useNoteEventSync } from "./hooks/useNoteEventSync";
import { useImageHeightSync } from "./hooks/useImageHeightSync";
import { useMobileSidebarState } from "./hooks/useMobileSidebarState";
import { useNoteOperations } from "./hooks/useNoteOperations";
import { useUserProfile } from "./hooks/useUserProfile";
import { useNoteSubmit } from "./hooks/useNoteSubmit";
import { useMultiSelect } from "./hooks/useMultiSelect";
import { useMultiSelectOperations } from "./hooks/useMultiSelectOperations.tsx";
import { editorContentAtom, notesAtom } from "./atoms/noteAtoms";
import { noteStatsAtom } from "./store";
import type { LovmindEditorRef } from "@/components/lovmind-editor/lovmind-editor.tsx";
import { IOSLayout } from "@/components/mobile/IOSLayout";

/**
 * iOS Main Window - Reuses desktop components with iOS-specific optimizations
 *
 * Key differences from desktop:
 * - Wrapped in IOSLayout for safe area handling
 * - Uses fullscreen drawer variant for mobile sidebar
 * - Automatically closes sidebar after opening note (better for small screens)
 * - No window dragging functionality (not supported on iOS)
 * - FAB (Floating Action Button) for quick note creation
 */
function MainWindowIOS() {
  // Local state: which note we're viewing (null = create mode)
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);

  // Local UI state
  const [showArchived, setShowArchived] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Refs
  const editorRef = useRef<LovmindEditorRef | null>(null);

  // Event sync hooks
  useNoteEventSync({ enableBroadcastChannel: true });
  useImageHeightSync();
  const { isMobileSidebarOpen, setIsMobileSidebarOpen, withSidebarClose } = useMobileSidebarState();

  // Read from atoms (for UI display only)
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);
  const noteStats = useAtomValue(noteStatsAtom);

  // Business logic hooks (for toolbar and sidebar)
  const { deleteNote, togglePin, toggleArchive } = useNoteOperations();
  const { userProfile } = useUserProfile();
  const { handleSubmit } = useNoteSubmit({
    noteId: viewingNoteId,
    editorRef,
    resetEditorAfterCreate: true,
  });

  // Multi-select hooks
  const {
    isMultiSelectMode,
    selectedNoteIds,
    lastClickedNoteId,
    toggleNoteSelection,
    enterMultiSelectMode,
    exitMultiSelectMode,
    selectAll,
    deselectAll,
    selectRange,
    setLastClickedNote,
  } = useMultiSelect();

  const multiSelectOps = useMultiSelectOperations({
    onTogglePin: togglePin,
    onToggleArchive: toggleArchive,
    onDeleteNote: deleteNote,
    notes,
  });

  // Handlers
  const handleBackToCreate = useCallback(async () => {
    setViewingNoteId(null);
    editorRef.current?.resetAndFocus();
  }, []);

  // iOS: Open note in same window and auto-close sidebar
  const handleOpenNoteInCurrentWindow = useCallback(
    withSidebarClose((note: Note) => {
      setViewingNoteId(note.id);
    }),
    [withSidebarClose]
  );

  const handleCreateNewNote = useCallback(
    withSidebarClose(handleBackToCreate),
    [withSidebarClose, handleBackToCreate]
  );

  // Batch operation handlers
  const handleBatchDelete = useCallback(async () => {
    if (selectedNoteIds.size === 0) return;
    await multiSelectOps.batchDelete(Array.from(selectedNoteIds));
    exitMultiSelectMode();
  }, [selectedNoteIds, multiSelectOps, exitMultiSelectMode]);

  const handleBatchArchive = useCallback(async () => {
    if (selectedNoteIds.size === 0) return;
    if (showArchived) {
      await multiSelectOps.batchUnarchive(Array.from(selectedNoteIds));
    } else {
      await multiSelectOps.batchArchive(Array.from(selectedNoteIds));
    }
    exitMultiSelectMode();
  }, [selectedNoteIds, showArchived, multiSelectOps, exitMultiSelectMode]);

  const profileModalNode = <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />;

  // iOS: Show FAB when in create mode and sidebar is closed
  const showFAB = !viewingNoteId && !isMobileSidebarOpen;

  return (
    <IOSLayout>
      <EditorLayout
        header={
          <MainHeader
            noteStats={noteStats}
            userProfile={userProfile}
            // iOS: No window dragging support
            onHeaderMouseDown={undefined}
            onUserMenuToggle={() => setIsProfileModalOpen(true)}
            userButtonRef={useRef<HTMLButtonElement>(null)}
          />
        }
        sidebar={
          <NotesSidebarContainer
            notes={notes}
            currentNoteId={viewingNoteId ?? undefined}
            showArchived={showArchived}
            onOpenNote={handleOpenNoteInCurrentWindow}
            // iOS: No multi-window support, open in same window
            onOpenNoteInNewWindow={handleOpenNoteInCurrentWindow}
            onTogglePin={togglePin}
            onToggleArchive={toggleArchive}
            onDeleteNote={deleteNote}
            onDuplicateNote={async (note) => {
              console.log('Duplicate:', note);
            }}
            onCreateNewNote={handleCreateNewNote}
            isCreateMode={!viewingNoteId}
            isEditorEmpty={editorContent.isEmpty}
            isMultiSelectMode={isMultiSelectMode}
            selectedNoteIds={selectedNoteIds}
            lastClickedNoteId={lastClickedNoteId}
            onToggleNoteSelection={toggleNoteSelection}
            onEnterMultiSelectMode={enterMultiSelectMode}
            onExitMultiSelect={exitMultiSelectMode}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onSelectRange={selectRange}
            onSetLastClickedNote={setLastClickedNote}
            onBatchDelete={handleBatchDelete}
            onBatchArchive={handleBatchArchive}
          />
        }
        editor={
          <LovmindEditor
            key={viewingNoteId || 'create-mode'}
            noteId={viewingNoteId}
            onSubmit={handleSubmit}
            placeholder="此时此刻，你在想什么呢？"
            ref={editorRef}
          />
        }
        toolbar={
          <EditorToolbar
            mode="main"
            onSubmit={handleSubmit}
            submitDisabled={editorContent.isEmpty}
            currentTags={editorContent.tags}
            allNotes={notes}
            editorRef={editorRef}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            hideSubmitButton={false}
          />
        }
        // iOS: Simplified menu (profile modal only)
        userMenu={null}
        profileModal={profileModalNode}
        aboutModal={null}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onMobileSidebarChange={setIsMobileSidebarOpen}
        // iOS: Use fullscreen drawer for better mobile experience
        mobileDrawerVariant="fullscreen"
      />

      {/* FAB (Floating Action Button) for quick note creation on iOS */}
      {showFAB && (
        <button
          onClick={handleCreateNewNote}
          className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95 z-50 sm:hidden"
          aria-label="新建笔记"
          style={{
            // iOS safe area bottom padding
            bottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <Plus size={24} />
        </button>
      )}
    </IOSLayout>
  );
}

export default MainWindowIOS;
