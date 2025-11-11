import { Pin, Star, Trash2, Crown } from 'lucide-react';
import { Note } from '../store';
import RenderingWysiwygEditor, { RenderingWysiwygEditorRef } from './RenderingWysiwygEditor';
import EditorToolbar from './EditorToolbar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useNoteOperations } from '../hooks/useNoteOperations';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface NoteEditorProps {
  content: string;
  richContent?: any;
  onContentChange: (content: string, tags?: string[], richContent?: any) => void;
  onSubmit: () => void;
  placeholder?: string;
  isPanelExpanded: boolean;
  onTogglePanel: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
  notesListRef: React.RefObject<HTMLDivElement | null>;
  editorRef?: React.RefObject<RenderingWysiwygEditorRef | null>;
  // 可选的额外功能
  onNoteClick?: (note: Note) => void;
  currentNoteId?: string | null; // 用于高亮当前编辑的笔记
}

function NoteEditor({
  content,
  richContent,
  onContentChange,
  onSubmit,
  placeholder = "此时此刻，你在想什么呢？",
  isPanelExpanded,
  onTogglePanel,
  panelRef,
  notesListRef,
  editorRef,
  onNoteClick,
  currentNoteId,
}: NoteEditorProps) {
  const { notes, deleteNote, togglePin, toggleFavorite } = useNoteOperations();

  return (
    <div className="editor-section">
      <div className="editor-area">
        <RenderingWysiwygEditor
          ref={editorRef}
          initialContent={content}
          initialRichContent={richContent}
          onChange={onContentChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
        />
      </div>

      {/* 最近笔记面板 */}
      <div
        ref={panelRef}
        className={`recent-notes-panel ${isPanelExpanded ? 'visible' : 'hidden'}`}
      >
        <div className="notes-list" ref={notesListRef}>
          {notes.length === 0 ? (
            <p className="empty-state">在这里记下你的想法吧</p>
          ) : (
            (() => {
              const sortedNotes = [...notes].sort((a, b) => {
                // Pinned notes come first
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                // Within same pin status, sort by creation time descending (newest first)
                return Number(b.id) - Number(a.id);
              });

              // Create a map of note ID to fixed rank (based on creation time)
              const noteRanks = new Map<string, number>();
              [...notes]
                .sort((a, b) => Number(b.id) - Number(a.id)) // Sort by creation time descending
                .forEach((note, index) => {
                  noteRanks.set(note.id, notes.length - index); // Assign fixed rank
                });

              return sortedNotes.map((note) => {
                const rank = noteRanks.get(note.id)!;
                const isTopThree = rank <= 3; // Top 3 oldest notes

                return (
                  <div
                    key={note.id}
                    className={`note-item ${
                      currentNoteId === note.id ? 'active' : ''
                    } ${note.favorite ? 'favorite' : ''} ${
                      note.pinned ? 'pinned' : ''
                    }`}
                    onClick={() => onNoteClick?.(note)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="note-content">
                      <div className="note-header">
                        <div className="note-title">
                          {isTopThree && (
                            <Crown
                              className={`icon-inline rank-badge rank-${rank}`}
                              size={16}
                              fill="currentColor"
                            />
                          )}
                          {note.pinned && (
                            <Pin className="icon-inline pinned" size={14} />
                          )}
                          {note.favorite && (
                            <Star className="icon-inline favorited" size={14} />
                          )}
                          {rank}. {note.title}
                        </div>
                      <span className="note-time">{dayjs(note.time).fromNow()}</span>
                    </div>
                    <p className="note-preview">
                      {note.text.replace(/\n/g, ' ').substring(0, 100)}
                      {note.text.length > 100 ? '...' : ''}
                    </p>
                    <div className="note-tags">
                      {note.tags.map((tag, i) => (
                        <span key={i} className="tag">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div
                      className="note-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={`action-btn pin-btn ${
                          note.pinned ? 'active' : ''
                        }`}
                        onClick={() => togglePin(note.id)}
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                      >
                        <Pin size={18} />
                      </button>
                      <button
                        className={`action-btn favorite-btn ${
                          note.favorite ? 'active' : ''
                        }`}
                        onClick={() => toggleFavorite(note.id)}
                        title={
                          note.favorite ? 'Unfavorite note' : 'Favorite note'
                        }
                      >
                        <Star size={18} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => deleteNote(note.id)}
                        title="Delete note"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                );
              });
            })()
          )}
        </div>
      </div>

      <EditorToolbar
        onToggleNotes={onTogglePanel}
        onSubmit={onSubmit}
        submitDisabled={(!content || typeof content !== 'string' || !content.trim()) && !richContent}
      />
    </div>
  );
}

export default NoteEditor;
