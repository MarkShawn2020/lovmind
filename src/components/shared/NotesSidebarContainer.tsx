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
