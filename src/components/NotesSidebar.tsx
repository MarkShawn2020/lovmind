import { Archive, Copy, Crown, Maximize2, Pin, Sparkles, Trash2, ChevronDown, ChevronUp, Plus, CheckSquare, Square } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { memo, useState, useEffect } from 'react';

import type { Note } from '@/store';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { MultiSelectToolbar } from '@/components/MultiSelectToolbar';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface NotesSidebarProps {
  notes: Note[];
  currentNoteId?: string | null;
  showArchived: boolean;
  onOpenNote: (note: Note) => void;
  onOpenNoteInNewWindow?: (note: Note) => void;
  onTogglePin: (id: string) => void | Promise<unknown>;
  onToggleArchive: (id: string) => void | Promise<unknown>;
  onDeleteNote: (id: string) => void | Promise<unknown>;
  onDuplicateNote: (note: Note) => void | Promise<unknown>;
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

const NotesSidebarComponent = ({
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
  isCreateMode = false,
  isEditorEmpty = true,
  // Multi-select props
  isMultiSelectMode = false,
  selectedNoteIds = new Set(),
  onToggleNoteSelection,
  onEnterMultiSelectMode,
  onExitMultiSelect,
  onSelectAll,
  onDeselectAll,
  onBatchDelete,
  onBatchArchive,
  onBatchPin,
  onBatchUnpin,
}: NotesSidebarProps) => {
  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState(false);

  // Auto-expand pinned section if current note is pinned
  useEffect(() => {
    if (currentNoteId) {
      const currentNote = notes.find(n => n.id === currentNoteId);
      if (currentNote?.pinned && isPinnedCollapsed) {
        setIsPinnedCollapsed(false);
      }
    }
  }, [currentNoteId, notes, isPinnedCollapsed]);

  // Empty state content
  const emptyStateContent = (
    <div className="flex flex-col items-center justify-center p-8 gap-5">
      <div className="relative w-16 h-16">
        <svg
          className="w-full h-full text-primary opacity-20 drop-shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-[opacity,transform,color] duration-300 ease-in-out hover:opacity-35 hover:scale-105 floating-logo"
          viewBox="0 0 986.05 1080"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="currentColor">
            <path d="M281.73,892.18V281.73C281.73,126.13,155.6,0,0,0l0,0v610.44C0,766.04,126.13,892.18,281.73,892.18z" />
            <path d="M633.91,1080V469.56c0-155.6-126.13-281.73-281.73-281.73l0,0v610.44C352.14,953.87,478.31,1080,633.91,1080L633.91,1080z" />
            <path d="M704.32,91.16L704.32,91.16v563.47l0,0c155.6,0,281.73-126.13,281.73-281.73S859.92,91.16,704.32,91.16z" />
          </g>
        </svg>
      </div>

      <div className="flex flex-col items-center gap-2 opacity-0 animate-[fadeInUpCentered_0.5s_ease_forwards_0.15s]">
        <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-[var(--foreground)] m-0">
          <Sparkles size={16} className="text-primary icon-sparkle" />
          开启灵感之旅
        </h3>
        <p className="text-center text-[0.8125rem] text-[var(--muted-foreground)] m-0">
          快捷键{' '}
          <kbd className="inline-block px-1.5 py-0.5 text-xs font-mono bg-[var(--muted)] border border-[var(--border)] rounded mx-0.5">
            ⌘N
          </kbd>{' '}
          随时唤起
        </p>
      </div>
    </div>
  );

  const filteredNotes = showArchived ? notes.filter(note => note.archived) : notes.filter(note => !note.archived);

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    // Priority 1: Pinned notes first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // Priority 2: Sort by creation date (time field) descending (newest first)
    const aTime = new Date(a.time).getTime();
    const bTime = new Date(b.time).getTime();

    // Handle invalid dates - fallback to id-based comparison
    if (isNaN(aTime) || isNaN(bTime)) {
      const aNum = Number(a.id);
      const bNum = Number(b.id);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return bNum - aNum;
      }

      return b.id.localeCompare(a.id);
    }

    return bTime - aTime;
  });

  // Calculate persistent ranks based on creation order (for notes without pre-assigned rank)
  // This represents the note's position in the overall creation timeline, regardless of pin/archive status
  const noteRanks = new Map<string, number>();
  const rankedNotes = [...notes].sort((a, b) => {
    // Sort by creation time descending (newest first) to match creation order
    const aTime = new Date(a.time).getTime();
    const bTime = new Date(b.time).getTime();

    // Handle invalid dates - fallback to id-based comparison
    if (isNaN(aTime) || isNaN(bTime)) {
      const aNum = Number(a.id);
      const bNum = Number(b.id);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return bNum - aNum;
      }

      return b.id.localeCompare(a.id);
    }

    return bTime - aTime;
  });

  rankedNotes.forEach((note, index) => {
    noteRanks.set(note.id, index + 1);
  });

  // Split notes into pinned and unpinned groups
  const pinnedNotes = sortedNotes.filter(note => note.pinned);
  const unpinnedNotes = sortedNotes.filter(note => !note.pinned);
  const hasPinnedNotes = pinnedNotes.length > 0;

  // Helper function to render a note item
  const renderNoteItem = (note: Note) => {
    const rank = note.rank ?? noteRanks.get(note.id)!;
    const isTopThree = rank <= 3;
    const isSelected = selectedNoteIds.has(note.id);

    // Handle click in multi-select mode
    const handleClick = (e: React.MouseEvent) => {
      // Support Cmd/Ctrl+Click for multi-select
      if ((e.metaKey || e.ctrlKey) && onEnterMultiSelectMode && onToggleNoteSelection) {
        if (!isMultiSelectMode) {
          onEnterMultiSelectMode();
        }
        onToggleNoteSelection(note.id);
        return;
      }

      // In multi-select mode, clicking toggles selection
      if (isMultiSelectMode && onToggleNoteSelection) {
        onToggleNoteSelection(note.id);
        return;
      }

      // Normal mode: open note
      onOpenNote(note);
    };

    return (
      <ContextMenu key={note.id}>
        <ContextMenuTrigger asChild>
          <div
            className={`note-item cursor-pointer bg-[var(--card)] p-2 px-2.5 rounded-[var(--radius)] shadow-sm transition-all relative border border-[var(--border)] h-[90px] min-h-[90px] overflow-hidden flex-shrink-0 hover:-translate-y-0.5 hover:shadow-md hover:border-primary active:scale-[0.98] touch-manipulation group ${
              currentNoteId === note.id ? 'active' : ''
            } ${note.pinned ? 'pinned' : ''} ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (isMultiSelectMode && onToggleNoteSelection) {
                  onToggleNoteSelection(note.id);
                } else {
                  onOpenNote(note);
                }
              }
            }}
          >
            <div className="flex flex-col h-full">
              <div className="flex justify-between mb-0.5 gap-2">
                <div className="text-sm font-semibold text-[var(--card-foreground)] flex items-center gap-1 min-w-0">
                  {isMultiSelectMode && (
                    <div className="flex-shrink-0">
                      {isSelected ? (
                        <CheckSquare size={16} className="text-primary" />
                      ) : (
                        <Square size={16} className="text-muted-foreground" />
                      )}
                    </div>
                  )}
                  {isTopThree && <Crown className={`inline-flex align-middle rank-badge rank-${rank} flex-shrink-0`} size={16} fill="currentColor" />}
                  {note.pinned && <Pin className="inline-flex align-middle text-[var(--primary)] flex-shrink-0" size={14} />}
                  <span className="truncate">
                    {rank}. {note.title}
                  </span>
                </div>
                <span className="text-[0.625rem] text-[var(--muted-foreground)] flex-shrink-0 whitespace-nowrap">{dayjs(note.time).fromNow()}</span>
              </div>
              <p className="text-[0.8125rem] text-[var(--muted-foreground)] leading-6 mb-1 line-clamp-2 overflow-hidden text-ellipsis break-words">
                {note.text.replace(/\n/g, ' ').substring(0, 100)}
                {note.text.length > 100 ? '...' : ''}
              </p>
              <div className="flex gap-[3px] mt-auto mb-1">
                {note.tags.map((tag, i) => (
                  <span key={i} className="text-[0.625rem] px-1.5 py-0.5 bg-[var(--secondary)] text-[var(--primary)] rounded-full font-medium border border-[var(--border)]">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {!isMultiSelectMode && onEnterMultiSelectMode && (
            <>
              <ContextMenuItem
                onClick={e => {
                  e.stopPropagation();
                  onEnterMultiSelectMode();
                  if (onToggleNoteSelection) {
                    onToggleNoteSelection(note.id);
                  }
                }}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                选择多个
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          {onOpenNoteInNewWindow && (
            <>
              <ContextMenuItem
                onClick={e => {
                  e.stopPropagation();
                  onOpenNoteInNewWindow(note);
                }}
              >
                <Maximize2 className="mr-2 h-4 w-4" />
                在新窗口打开
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          {!onOpenNoteInNewWindow && (
            <>
              <ContextMenuItem
                onClick={e => {
                  e.stopPropagation();
                  onOpenNote(note);
                }}
              >
                <Maximize2 className="mr-2 h-4 w-4" />
                打开
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            onClick={e => {
              e.stopPropagation();
              onTogglePin(note.id);
            }}
          >
            <Pin className="mr-2 h-4 w-4" />
            {note.pinned ? '取消置顶' : '置顶'}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={e => {
              e.stopPropagation();
              onDuplicateNote(note);
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            复制
          </ContextMenuItem>
          <ContextMenuItem
            onClick={e => {
              e.stopPropagation();
              onToggleArchive(note.id);
            }}
          >
            <Archive className="mr-2 h-4 w-4" />
            {showArchived ? '取消归档' : '归档'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={async e => {
              e.stopPropagation();
              await onDeleteNote(note.id);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Notes Area */}
      <div className="flex-1 overflow-y-auto p-[var(--spacing-s)] flex flex-col gap-2">
        {notes.length === 0 ? (
          emptyStateContent
        ) : (
          <>
            {/* Pinned Notes Section with Collapsible Header */}
            {hasPinnedNotes && (
              <div className="pinned-notes-area pb-3 mb-3 border-b border-border/50">
                {/* Interactive Buttons Block */}
                <button
                  onClick={() => setIsPinnedCollapsed(!isPinnedCollapsed)}
                  className="flex items-center justify-between w-full px-2.5 py-2 min-h-[44px] mb-1 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-[var(--radius)] transition-colors cursor-pointer border-none bg-transparent active:scale-[0.98] touch-manipulation"
                  type="button"
                >
                  <div className="flex items-center gap-1.5">
                    <Pin size={12} className="text-[var(--primary)]" />
                    <span>置顶笔记</span>
                    <span className="text-[0.625rem] px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full">
                      {pinnedNotes.length}
                    </span>
                  </div>
                  {isPinnedCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                {/* Notes List Block */}
                {!isPinnedCollapsed && (
                  <div className="flex flex-col gap-2 py-1">
                    {pinnedNotes.map(renderNoteItem)}
                  </div>
                )}
              </div>
            )}

            {/* Unpinned Notes Section */}
            <div className="flex flex-col gap-2">
              {unpinnedNotes.map(renderNoteItem)}
            </div>
          </>
        )}
      </div>

      {/* Bottom section: Multi-select toolbar or New Note Button */}
      {isMultiSelectMode && onExitMultiSelect && onSelectAll && onDeselectAll && onBatchDelete && onBatchArchive && onBatchPin && onBatchUnpin ? (
        <MultiSelectToolbar
          selectedCount={selectedNoteIds.size}
          totalCount={filteredNotes.length}
          onSelectAll={() => onSelectAll(filteredNotes.map(n => n.id))}
          onDeselectAll={onDeselectAll}
          onBatchDelete={onBatchDelete}
          onBatchArchive={onBatchArchive}
          onBatchPin={onBatchPin}
          onBatchUnpin={onBatchUnpin}
          onExitMultiSelect={onExitMultiSelect}
          showArchived={showArchived}
        />
      ) : onCreateNewNote ? (
        <div className="flex-shrink-0 p-[var(--spacing-s)] pt-2 border-t border-border/40 bg-muted">
          <button
            onClick={onCreateNewNote}
            className="w-full h-10 min-h-[44px] px-4 rounded-xl border-none flex items-center justify-center gap-2 font-medium text-sm transition-all duration-200 ease-out shadow-sm touch-manipulation bg-primary text-primary-foreground cursor-pointer hover:shadow-md hover:bg-primary/90 active:scale-[0.97]"
            title={
              isCreateMode && isEditorEmpty
                ? "Create new note"
                : isCreateMode
                ? "Save current note and create new"
                : "Create new note"
            }
            type="button"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>新建笔记</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const NotesSidebar = memo(NotesSidebarComponent);
