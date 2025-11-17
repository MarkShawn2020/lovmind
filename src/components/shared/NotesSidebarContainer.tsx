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
  onToggleNoteSelection?: (noteId: string) => void;
  onEnterMultiSelectMode?: () => void;
  onExitMultiSelect?: () => void;
  onSelectAll?: (noteIds: string[]) => void;
  onDeselectAll?: () => void;
  onBatchDelete?: () => void;
  onBatchArchive?: () => void;
  onBatchPin?: () => void;
  onBatchUnpin?: () => void;
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
      onToggleNoteSelection,
      onEnterMultiSelectMode,
      onExitMultiSelect,
      onSelectAll,
      onDeselectAll,
      onBatchDelete,
      onBatchArchive,
      onBatchPin,
      onBatchUnpin,
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
          onToggleNoteSelection={onToggleNoteSelection}
          onEnterMultiSelectMode={onEnterMultiSelectMode}
          onExitMultiSelect={onExitMultiSelect}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onBatchDelete={onBatchDelete}
          onBatchArchive={onBatchArchive}
          onBatchPin={onBatchPin}
          onBatchUnpin={onBatchUnpin}
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
        onToggleNoteSelection,
        onEnterMultiSelectMode,
        onExitMultiSelect,
        onSelectAll,
        onDeselectAll,
        onBatchDelete,
        onBatchArchive,
        onBatchPin,
        onBatchUnpin,
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
