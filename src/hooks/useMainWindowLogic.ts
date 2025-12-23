import { useState, useCallback, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { LovmindEditorRef } from '@/components/lovmind-editor/lovmind-editor';
import { editorContentAtom, notesAtom } from '@/atoms/noteAtoms';
import { noteStatsAtom, draftContentAtom } from '@/store';
import { useNoteEventSync } from './useNoteEventSync';
import { useImageHeightSync } from './useImageHeightSync';
import { useMobileSidebarState } from './useMobileSidebarState';
import { useNoteOperations } from './useNoteOperations';
import { useUserProfile } from './useUserProfile';
import { useNoteSubmit } from './useNoteSubmit';
import { useMultiSelect } from './useMultiSelect';
import { useMultiSelectOperations } from './useMultiSelectOperations';
import { useIsMobile } from './useIsMobile';
import type { Note } from '@/store';

export interface UseMainWindowLogicOptions {
  /**
   * Whether to use mobile view state ('list' | 'editor')
   * Desktop uses this for responsive layout, iOS always uses it
   */
  useMobileView?: boolean;

  /**
   * Whether to enable Tauri window events (desktop only)
   */
  enableTauriEvents?: boolean;

  /**
   * Whether to enable BroadcastChannel for note sync
   */
  enableBroadcastChannel?: boolean;
}

export interface MainWindowLogicReturn {
  // State
  viewingNoteId: string | null;
  setViewingNoteId: (id: string | null) => void;
  mobileView: 'list' | 'editor';
  setMobileView: (view: 'list' | 'editor') => void;
  editorSessionKey: number;
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;

  // Refs
  editorRef: React.RefObject<LovmindEditorRef | null>;

  // Computed
  isMobile: boolean;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;

  // Atoms
  editorContent: ReturnType<typeof useAtomValue<typeof editorContentAtom>>;
  notes: Note[];
  noteStats: ReturnType<typeof useAtomValue<typeof noteStatsAtom>>;

  // Operations
  deleteNote: (noteId: string, skipConfirmation?: boolean) => Promise<boolean>;
  togglePin: (noteId: string) => Promise<void>;
  toggleArchive: (noteId: string) => Promise<void>;
  userProfile: ReturnType<typeof useUserProfile>['userProfile'];
  handleSubmit: () => Promise<void>;

  // Multi-select
  isMultiSelectMode: boolean;
  selectedNoteIds: Set<string>;
  lastClickedNoteId: string | null;
  toggleNoteSelection: (noteId: string) => void;
  enterMultiSelectMode: () => void;
  exitMultiSelectMode: () => void;
  selectAll: (noteIds: string[]) => void;
  deselectAll: () => void;
  selectRange: (fromNoteId: string, toNoteId: string, allNoteIds: string[]) => void;
  setLastClickedNote: (noteId: string) => void;

  // Handlers
  handleBackToCreate: () => void;
  handleOpenNoteInCurrentWindow: (note: Note) => void;
  handleCreateNewNote: () => void;
  handleBatchDelete: () => Promise<void>;
  handleBatchArchive: () => Promise<void>;
}

/**
 * Shared business logic for MainWindow (desktop) and MainWindowIOS
 * Encapsulates all state management, data fetching, and event handlers
 */
export function useMainWindowLogic(
  options: UseMainWindowLogicOptions = {}
): MainWindowLogicReturn {
  const {
    useMobileView: shouldUseMobileView = true,
    enableBroadcastChannel = true,
  } = options;

  // Local state: which note we're viewing (null = create mode)
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);

  // Mobile view state: 'list' shows notes sidebar, 'editor' shows editor
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  // Editor session key: used to force editor remount in create mode
  // so that the input area is cleared after successful submit
  const [editorSessionKey, setEditorSessionKey] = useState(0);

  // Local UI state
  const [showArchived, setShowArchived] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Refs
  const editorRef = useRef<LovmindEditorRef | null>(null);

  // Detect mobile screen size
  const isMobile = useIsMobile();

  // Event sync hooks
  useNoteEventSync({ enableBroadcastChannel });
  useImageHeightSync();
  const { isMobileSidebarOpen, setIsMobileSidebarOpen, withSidebarClose } = useMobileSidebarState();

  // Read from atoms (for UI display only)
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);
  const noteStats = useAtomValue(noteStatsAtom);
  const draftContent = useAtomValue(draftContentAtom);
  const setEditorContent = useSetAtom(editorContentAtom);


  // Business logic hooks (for toolbar and sidebar)
  const { deleteNote, togglePin, toggleArchive } = useNoteOperations();
  const { userProfile } = useUserProfile();
  const { handleSubmit: originalHandleSubmit } = useNoteSubmit({
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

  // Wrap handleSubmit to auto-return to list on mobile after submission
  const handleSubmit = useCallback(async () => {
    await originalHandleSubmit();

    // Bump editor session so that next time we enter create mode,
    // the editor remounts with a fresh empty state.
    setEditorSessionKey((prev) => prev + 1);

    // On mobile, return to list view after submitting
    if (shouldUseMobileView && isMobile) {
      setMobileView('list');
    }
  }, [originalHandleSubmit, shouldUseMobileView, isMobile]);

  // Handlers
  const handleBackToCreate = useCallback(() => {
    setViewingNoteId(null);

    // Read draft from local atom (kept in sync by useDraftSync)
    if (draftContent && draftContent.text?.trim()) {
      setEditorContent({
        text: draftContent.text,
        tags: draftContent.tags,
        richContent: draftContent.richContent,
        isEmpty: false,
        sourceNoteId: null, // Create mode
      });
      console.log('[Draft] Restored draft:', draftContent.savedAt);
    } else {
      // Delay resetAndFocus to next frame to allow editor to remount
      // (editorKey changes when viewingNoteId becomes null, causing React to remount the editor)
      requestAnimationFrame(() => {
        editorRef.current?.resetAndFocus();
      });
    }

    // On mobile, switch to editor view
    if (shouldUseMobileView && isMobile) {
      setMobileView('editor');
    }
  }, [shouldUseMobileView, isMobile, draftContent, setEditorContent]);

  // Use withSidebarClose to auto-close mobile sidebar
  const handleOpenNoteInCurrentWindow = useCallback(
    withSidebarClose((note: Note) => {
      setViewingNoteId(note.id);
      // On mobile, switch to editor view when opening a note
      if (shouldUseMobileView && isMobile) {
        setMobileView('editor');
      }
    }),
    [withSidebarClose, shouldUseMobileView, isMobile]
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

  return {
    // State
    viewingNoteId,
    setViewingNoteId,
    mobileView,
    setMobileView,
    editorSessionKey,
    showArchived,
    setShowArchived,
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
    deleteNote,
    togglePin,
    toggleArchive,
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
    handleBackToCreate,
    handleOpenNoteInCurrentWindow,
    handleCreateNewNote,
    handleBatchDelete,
    handleBatchArchive,
  };
}
