import { forwardRef, useMemo } from 'react';
import type { Note } from '@/store';
import { NotesSidebar } from '@/components/NotesSidebar';

interface NotesSidebarContainerProps {
  notes: Note[];
  currentNoteId?: string;
  showArchived: boolean;
  onOpenNote: (note: Note) => void;
  onOpenNoteInNewWindow?: (note: Note) => void;
  onTogglePin: (noteId: string) => void;
  onToggleArchive: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onDuplicateNote: (note: Note) => void;
  onCreateNewNote?: () => void;
  isCreateMode?: boolean;
  isEditorEmpty?: boolean;
  // Multi-select props
  isMultiSelectMode?: boolean;
  selectedNoteIds?: Set<string>;
  lastClickedNoteId?: string | null;
  onToggleNoteSelection?: (noteId: string) => void;
  onEnterMultiSelectMode?: () => void;
  onExitMultiSelect?: () => void;
  onSelectAll?: (noteIds: string[]) => void;
  onDeselectAll?: () => void;
  onSelectRange?: (fromNoteId: string, toNoteId: string, allNoteIds: string[]) => void;
  onSetLastClickedNote?: (noteId: string) => void;
  onBatchDelete?: () => void;
  onBatchArchive?: () => void;
}

/**
 * Reusable container for NotesSidebar with ref forwarding
 * Memoizes the sidebar to prevent unnecessary re-renders
 */
export const NotesSidebarContainer = forwardRef<HTMLDivElement, NotesSidebarContainerProps>(
  (props, ref) => {
    const {
      notes,
      currentNoteId,
      showArchived,
      onOpenNote,
      onOpenNoteInNewWindow,
      onTogglePin,
      onToggleArchive,
      onDeleteNote,
      onDuplicateNote,
      onCreateNewNote,
      isCreateMode,
      isEditorEmpty,
      // Multi-select props
      isMultiSelectMode,
      selectedNoteIds,
      lastClickedNoteId,
      onToggleNoteSelection,
      onEnterMultiSelectMode,
      onExitMultiSelect,
      onSelectAll,
      onDeselectAll,
      onSelectRange,
      onSetLastClickedNote,
      onBatchDelete,
      onBatchArchive,
    } = props;

    const sidebarContent = useMemo(
      () => (
        <NotesSidebar
          notes={notes}
          currentNoteId={currentNoteId}
          showArchived={showArchived}
          onOpenNote={onOpenNote}
          onOpenNoteInNewWindow={onOpenNoteInNewWindow}
          onTogglePin={onTogglePin}
          onToggleArchive={onToggleArchive}
          onDeleteNote={onDeleteNote}
          onDuplicateNote={onDuplicateNote}
          onCreateNewNote={onCreateNewNote}
          isCreateMode={isCreateMode}
          isEditorEmpty={isEditorEmpty}
          isMultiSelectMode={isMultiSelectMode}
          selectedNoteIds={selectedNoteIds}
          lastClickedNoteId={lastClickedNoteId}
          onToggleNoteSelection={onToggleNoteSelection}
          onEnterMultiSelectMode={onEnterMultiSelectMode}
          onExitMultiSelect={onExitMultiSelect}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onSelectRange={onSelectRange}
          onSetLastClickedNote={onSetLastClickedNote}
          onBatchDelete={onBatchDelete}
          onBatchArchive={onBatchArchive}
        />
      ),
      [
        notes,
        currentNoteId,
        showArchived,
        onOpenNote,
        onOpenNoteInNewWindow,
        onTogglePin,
        onToggleArchive,
        onDeleteNote,
        onDuplicateNote,
        onCreateNewNote,
        isCreateMode,
        isEditorEmpty,
        isMultiSelectMode,
        selectedNoteIds,
        lastClickedNoteId,
        onToggleNoteSelection,
        onEnterMultiSelectMode,
        onExitMultiSelect,
        onSelectAll,
        onDeselectAll,
        onSelectRange,
        onSetLastClickedNote,
        onBatchDelete,
        onBatchArchive,
      ]
    );

    return (
      <div ref={ref} className="h-full">
        {sidebarContent}
      </div>
    );
  }
);

NotesSidebarContainer.displayName = 'NotesSidebarContainer';
