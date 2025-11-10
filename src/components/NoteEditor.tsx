import { useCallback, useRef } from 'react';
import { Pin, Star, Trash2, Crown } from 'lucide-react';
import { useAtom } from 'jotai';
import { notesAtom, Note } from '../store';
import RenderingWysiwygEditor, { RenderingWysiwygEditorRef } from './RenderingWysiwygEditor';
import EditorToolbar from './EditorToolbar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface NoteEditorProps {
  content: string;
  onContentChange: (content: string, tags?: string[]) => void;
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
  // 可选的自定义操作回调（用于添加额外逻辑，如 Tauri 同步）
  onPinNote?: (noteId: string) => void;
  onFavoriteNote?: (noteId: string) => void;
  onDeleteNote?: (noteId: string) => void;
}

function NoteEditor({
  content,
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
  onPinNote,
  onFavoriteNote,
  onDeleteNote,
}: NoteEditorProps) {
  const [notes, setNotes] = useAtom(notesAtom);

  const handlePin = useCallback((noteId: string) => {
    setNotes(notes.map(n =>
      n.id === noteId ? { ...n, pinned: !n.pinned } : n
    ));
    onPinNote?.(noteId); // 调用父组件的额外逻辑
  }, [notes, setNotes, onPinNote]);

  const handleFavorite = useCallback((noteId: string) => {
    setNotes(notes.map(n =>
      n.id === noteId ? { ...n, favorite: !n.favorite } : n
    ));
    onFavoriteNote?.(noteId); // 调用父组件的额外逻辑
  }, [notes, setNotes, onFavoriteNote]);

  const handleDelete = useCallback((noteId: string) => {
    if (confirm('确定要删除这条笔记吗？')) {
      setNotes(notes.filter(n => n.id !== noteId));
      onDeleteNote?.(noteId); // 调用父组件的额外逻辑
    }
  }, [notes, setNotes, onDeleteNote]);

  return (
    <div className="editor-section">
      <div className="editor-area">
        <RenderingWysiwygEditor
          ref={editorRef}
          initialContent={content}
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
                        onClick={() => handlePin(note.id)}
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                      >
                        <Pin size={18} />
                      </button>
                      <button
                        className={`action-btn favorite-btn ${
                          note.favorite ? 'active' : ''
                        }`}
                        onClick={() => handleFavorite(note.id)}
                        title={
                          note.favorite ? 'Unfavorite note' : 'Favorite note'
                        }
                      >
                        <Star size={18} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(note.id)}
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
        submitDisabled={!content || typeof content !== 'string' || !content.trim()}
      />
    </div>
  );
}

export default NoteEditor;
