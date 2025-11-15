import React from 'react';
import { Crown, Pin, Star, X } from 'lucide-react';

import type { Note } from '@/store';

interface FloatHeaderProps {
  currentNote: Note | null;
  notes: Note[];
  isEditingTitle: boolean;
  editingTitle: string;
  onTitleChange: (value: string) => void;
  onStartEditingTitle: (title: string) => void;
  onCancelEditingTitle: () => void;
  onSaveTitle: () => void;
  onHeaderMouseDown: () => void;
  isWindowAlwaysOnTop: boolean;
  onToggleAlwaysOnTop: (e?: React.MouseEvent) => void;
  onCloseWindow: (e: React.MouseEvent) => void;
}

export const FloatHeader = ({
  currentNote,
  notes,
  isEditingTitle,
  editingTitle,
  onTitleChange,
  onStartEditingTitle,
  onCancelEditingTitle,
  onSaveTitle,
  onHeaderMouseDown,
  isWindowAlwaysOnTop,
  onToggleAlwaysOnTop,
  onCloseWindow,
}: FloatHeaderProps) => {
  const renderTitle = () => {
    if (!currentNote) return 'Untitled Note';

    const rank = getNoteRank(currentNote, notes);
    const isTopThree = typeof rank === 'number' && rank <= 3;

    return (
      <>
        {isTopThree && (
          <Crown className={`inline-flex align-middle rank-badge rank-${rank}`} size={16} fill="currentColor" />
        )}
        {currentNote.pinned && <Pin className="inline-flex align-middle text-white" size={14} />}
        {currentNote.favorite && <Star className="inline-flex align-middle text-white fill-white" size={14} />}
        {typeof rank === 'number' && `${rank}. `}
        {isEditingTitle ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSaveTitle();
              } else if (e.key === 'Escape') {
                onCancelEditingTitle();
              }
            }}
            autoFocus
            className="bg-white/10 text-white px-2 py-0.5 rounded outline-none border border-white/20 focus:border-white/40"
            style={{ minWidth: '200px' }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="cursor-pointer hover:underline truncate max-w-[300px] inline-block"
            onClick={(e) => {
              e.stopPropagation();
              onStartEditingTitle(currentNote.title);
            }}
            title={currentNote.title}
          >
            {currentNote.title}
          </span>
        )}
      </>
    );
  };

  return (
    <div
      className="h-[60px] px-[var(--spacing-text)] py-[var(--spacing-s)] bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center gap-3 rounded-t-xl select-none flex-shrink-0 cursor-move"
      onMouseDown={onHeaderMouseDown}
    >
      <div className="text-sm font-semibold text-white flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
        {renderTitle()}
      </div>
      <div className="flex items-center gap-1">
        <button
          className="w-9 h-9 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 bg-transparent border-none flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-95 touch-manipulation"
          onClick={onToggleAlwaysOnTop}
          title={isWindowAlwaysOnTop ? 'Disable always on top' : 'Enable always on top'}
          style={{
            color: isWindowAlwaysOnTop ? 'white' : 'rgba(255, 255, 255, 0.5)',
          }}
          type="button"
        >
          <Pin size={16} />
        </button>
        <button
          className="w-9 h-9 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 bg-transparent border-none flex items-center justify-center cursor-pointer transition-all duration-150 text-white/50 hover:text-white active:scale-95 touch-manipulation"
          onClick={onCloseWindow}
          title="Close window"
          type="button"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const getNoteRank = (note: Note, notes: Note[]): number | undefined => {
  if (note.rank) {
    console.log('[NoteEditor] Using stored rank:', {
      noteId: note.id,
      rank: note.rank,
      title: note.title,
    });
    return note.rank;
  }

  const noteRanks = new Map<string, number>();
  const sortedNotes = [...notes].sort((a, b) => {
    const aNum = Number(a.id);
    const bNum = Number(b.id);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return bNum - aNum;
    }

    return b.id.localeCompare(a.id);
  });

  sortedNotes.forEach((sortedNote, index) => {
    noteRanks.set(sortedNote.id, index + 1);
  });

  const dynamicRank = noteRanks.get(note.id);

  console.log('[NoteEditor] Calculated dynamic rank:', {
    noteId: note.id,
    rank: dynamicRank,
    title: note.title,
    totalNotes: notes.length,
    noteHasRank: note.rank !== undefined,
    noteFoundInArray: notes.some((n) => n.id === note.id),
    firstFewNoteIds: notes.slice(0, 3).map((n) => n.id),
  });

  return dynamicRank;
};
