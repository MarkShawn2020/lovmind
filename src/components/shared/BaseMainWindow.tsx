import { ReactNode, useMemo } from 'react';
import { useAtom } from 'jotai';
import LovmindEditor from '@/components/lovmind-editor/lovmind-editor';
import EditorToolbar from '@/components/EditorToolbar';
import ProfileModal from '@/components/ProfileModal';
import { EditorLayout } from '@/components/lovmind-editor/EditorLayout';
import { MainHeader } from '@/components/lovmind-editor/MainHeader';
import { TodoAggregateView } from '@/components/TodoAggregateView';
import { NotesSidebarContainer } from './NotesSidebarContainer';
import { mainViewModeAtom, type Note } from '@/store';
import { countUncompletedTodos } from '@/lib/todo-extractor';
import type { MainWindowLogicReturn } from '@/hooks/useMainWindowLogic';

export interface BaseMainWindowProps {
  /**
   * Business logic from useMainWindowLogic hook
   */
  logic: MainWindowLogicReturn;

  /**
   * Platform-specific header mouse down handler (desktop: window drag, iOS: undefined)
   */
  onHeaderMouseDown?: () => void;

  /**
   * Platform-specific handler for opening notes in new window
   * Desktop: opens in separate float window
   * iOS: same as onOpenNote (no multi-window support)
   */
  onOpenNoteInNewWindow?: (note: any) => void;

  /**
   * Optional: Mobile view state override
   * Used for responsive desktop layout and iOS navigation
   */
  mobileView?: 'list' | 'editor';

  /**
   * Optional: Back to list handler (for mobile/responsive layout)
   * Shows back button in toolbar when provided
   */
  onBackToList?: () => void;

  /**
   * Optional: Additional modals to render (desktop: userMenu, aboutModal, iOS: none)
   */
  additionalModals?: ReactNode;

  /**
   * Optional: Mobile drawer variant
   * iOS uses 'fullscreen', desktop uses default
   */
  mobileDrawerVariant?: 'default' | 'fullscreen';

  /**
   * Optional: Custom placeholder text for editor
   */
  editorPlaceholder?: string;

  /**
   * Optional: User menu toggle handler (desktop: opens dropdown, iOS: may differ)
   */
  onUserMenuToggle?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /**
   * Optional: User button ref (desktop: for positioning dropdown menu)
   */
  userButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * BaseMainWindow - Pure UI layer component
 *
 * Shared base component for both desktop and iOS main windows.
 * Contains only UI rendering logic, no business logic.
 * All business logic should be passed via the `logic` prop from useMainWindowLogic hook.
 *
 * Platform-specific differences (desktop vs iOS):
 * - Desktop: has userMenu, aboutModal, window dragging, multi-window support
 * - iOS: has IOSLayout wrapper, FAB button, fullscreen drawer, no window features
 *
 * These differences are handled by the platform wrapper components that use this base.
 */
export function BaseMainWindow({
  logic,
  onHeaderMouseDown,
  onOpenNoteInNewWindow,
  mobileView,
  onBackToList,
  additionalModals,
  mobileDrawerVariant = 'default',
  editorPlaceholder = '此时此刻，你在想什么呢？',
  onUserMenuToggle,
  userButtonRef,
}: BaseMainWindowProps) {
  const {
    // State
    viewingNoteId,
    editorSessionKey,
    showArchived,
    isProfileModalOpen,
    setIsProfileModalOpen,

    // Refs
    editorRef,

    // Computed
    isMobile,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,

    // Atoms
    editorContent,
    notes,
    noteStats,

    // Operations
    togglePin,
    toggleArchive,
    deleteNote,
    updateNote,
    userProfile,
    handleSubmit,

    // Multi-select
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

    // Handlers
    handleOpenNoteInCurrentWindow,
    handleCreateNewNote,
    handleBatchDelete,
    handleBatchArchive,
  } = logic;

  // View mode state (notes vs todos)
  const [viewMode, setViewMode] = useAtom(mainViewModeAtom);

  // Count uncompleted todos
  const todoCount = useMemo(() => countUncompletedTodos(notes), [notes]);

  // Handle updating a note (for todo toggle)
  const handleUpdateNote = async (noteId: string, updates: Partial<Note>) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      await updateNote({ ...note, ...updates });
    }
  };

  // Use provided mobileView or fall back to logic's mobileView
  const effectiveMobileView = mobileView ?? logic.mobileView;

  // Editor key: for create mode, include session key to force remount
  const editorKey = viewingNoteId ?? `create-mode-${editorSessionKey}`;

  // Fallback for onOpenNoteInNewWindow (iOS doesn't support multi-window)
  const handleOpenNoteInNewWindow = onOpenNoteInNewWindow ?? handleOpenNoteInCurrentWindow;

  return (
    <>
      <EditorLayout
        header={
          <MainHeader
            noteStats={noteStats}
            todoCount={todoCount}
            userProfile={userProfile}
            onHeaderMouseDown={onHeaderMouseDown}
            onUserMenuToggle={onUserMenuToggle ?? (() => {})}
            userButtonRef={userButtonRef ?? { current: null }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        }
        sidebar={
          <NotesSidebarContainer
            notes={notes}
            currentNoteId={viewingNoteId ?? undefined}
            showArchived={showArchived}
            onOpenNote={handleOpenNoteInCurrentWindow}
            onOpenNoteInNewWindow={handleOpenNoteInNewWindow}
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
          viewMode === 'todos' ? (
            <TodoAggregateView
              notes={notes}
              onUpdateNote={handleUpdateNote}
              onOpenNoteInNewWindow={handleOpenNoteInNewWindow}
            />
          ) : (
            <LovmindEditor
              key={editorKey}
              noteId={viewingNoteId}
              onSubmit={handleSubmit}
              placeholder={editorPlaceholder}
              ref={editorRef}
            />
          )
        }
        toolbar={
          viewMode === 'todos' ? null : (
            <EditorToolbar
              mode="main"
              onSubmit={handleSubmit}
              submitDisabled={editorContent.isEmpty}
              currentTags={editorContent.tags}
              allNotes={notes}
              editorRef={editorRef}
              onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
              hideSubmitButton={false}
              onBackToList={isMobile && effectiveMobileView === 'editor' ? onBackToList : undefined}
            />
          )
        }
        userMenu={null} // Desktop provides this via additionalModals
        profileModal={
          <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        }
        aboutModal={null} // Desktop provides this via additionalModals
        isMobileSidebarOpen={isMobileSidebarOpen}
        onMobileSidebarChange={setIsMobileSidebarOpen}
        mobileView={effectiveMobileView}
        mobileDrawerVariant={mobileDrawerVariant}
      />

      {/* Platform-specific modals (userMenu, aboutModal, etc.) */}
      {additionalModals}
    </>
  );
}
