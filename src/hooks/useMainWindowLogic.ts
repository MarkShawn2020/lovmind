import { useState, useCallback, useRef, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { LovmindEditorRef } from '@/components/lovmind-editor/lovmind-editor';
import { editorContentAtom, notesAtom, notesWithLiveEditorAtom } from '@/atoms/noteAtoms';
import { noteStatsAtom, draftContentAtom, getStoreValue, type DraftContent } from '@/store';
import { isTauri } from '@/utils/tauri';
import { useNoteEventSync } from './useNoteEventSync';
import { useImageHeightSync } from './useImageHeightSync';
import { useMobileSidebarState } from './useMobileSidebarState';
import { useNoteOperations } from './useNoteOperations';
import { useUserProfile } from './useUserProfile';
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
  editorNoteId: string;
  mobileView: 'list' | 'editor';
  setMobileView: (view: 'list' | 'editor') => void;
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
  liveNotes: Note[]; // notes with live editor content overlaid (for sidebar display)
  noteStats: ReturnType<typeof useAtomValue<typeof noteStatsAtom>>;

  // Operations
  deleteNote: (noteId: string, skipConfirmation?: boolean) => Promise<boolean>;
  togglePin: (noteId: string) => Promise<void>;
  toggleArchive: (noteId: string) => Promise<void>;
  updateNote: (note: Note) => Promise<void>;
  userProfile: ReturnType<typeof useUserProfile>['userProfile'];
  reloadProfile: ReturnType<typeof useUserProfile>['reloadProfile'];

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
  handleNoteAutoCreated: (noteId: string) => void;
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

  // Pre-generated noteId for create mode (avoids remount on auto-create)
  const [createModeNoteId, setCreateModeNoteId] = useState(() => crypto.randomUUID());

  // Computed: the noteId the editor should use
  const editorNoteId = viewingNoteId ?? createModeNoteId;

  // Mobile view state: 'list' shows notes sidebar, 'editor' shows editor
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

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

  // Read from atoms
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);
  const liveNotes = useAtomValue(notesWithLiveEditorAtom);
  const noteStats = useAtomValue(noteStatsAtom);
  const draftContent = useAtomValue(draftContentAtom);
  const setEditorContent = useSetAtom(editorContentAtom);
  const setDraftContent = useSetAtom(draftContentAtom);

  // Restore draft content on initial mount (after page refresh)
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current || viewingNoteId !== null) return;

    const restoreDraft = async () => {
      let draft = draftContent;

      if (!draft && isTauri()) {
        draft = await getStoreValue<DraftContent | null>('lovpen-draft', null);
      }

      if (draft && draft.text?.trim()) {
        draftRestoredRef.current = true;
        console.log('[MainWindow] Restoring draft on initial mount:', draft.savedAt);
        setEditorContent((prev) => ({
          text: draft.text,
          tags: draft.tags,
          richContent: draft.richContent,
          isEmpty: false,
          sourceNoteId: null,
          _loadVersion: (prev._loadVersion ?? 0) + 1,
        }));
        setDraftContent(draft);
      }
    };

    restoreDraft();
  }, [viewingNoteId, draftContent, setEditorContent, setDraftContent]);

  // Business logic hooks
  const { deleteNote, togglePin, toggleArchive, updateNote } = useNoteOperations();
  const { userProfile, reloadProfile } = useUserProfile();

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

  // Callback when auto-save creates a new note
  const handleNoteAutoCreated = useCallback((noteId: string) => {
    // Transition viewingNoteId to the auto-created note
    // editorKey stays the same (editorNoteId was already this UUID)
    setViewingNoteId(noteId);
    console.log('[MainWindow] Note auto-created, set viewingNoteId:', noteId);
  }, []);

  // Handlers
  const handleBackToCreate = useCallback(() => {
    setViewingNoteId(null);
    // Generate fresh UUID for the next create session
    setCreateModeNoteId(crypto.randomUUID());

    // With auto-save, no draft restoration needed — old note is already saved,
    // new editor starts fresh via useNoteLoader
    requestAnimationFrame(() => {
      editorRef.current?.resetAndFocus();
    });

    // On mobile, switch to editor view
    if (shouldUseMobileView && isMobile) {
      setMobileView('editor');
    }
  }, [shouldUseMobileView, isMobile]);

  // Use withSidebarClose to auto-close mobile sidebar
  const handleOpenNoteInCurrentWindow = useCallback(
    withSidebarClose((note: Note) => {
      setViewingNoteId(note.id);
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
    editorNoteId,
    mobileView,
    setMobileView,
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
    liveNotes,
    noteStats,

    // Operations
    deleteNote,
    togglePin,
    toggleArchive,
    updateNote,
    userProfile,
    reloadProfile,

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
    handleNoteAutoCreated,
    handleBatchDelete,
    handleBatchArchive,
  };
}
