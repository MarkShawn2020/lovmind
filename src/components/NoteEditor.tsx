import { useState, useEffect, useRef, useCallback } from 'react';
import { Pin, Star, Trash2, Crown, Sparkles } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';
import { Note } from '../store';
import RenderingWysiwygEditor, { RenderingWysiwygEditorRef } from './RenderingWysiwygEditor';
import EditorToolbar from './EditorToolbar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useNoteOperations } from '../hooks/useNoteOperations';
import { useWindowOperations } from '../hooks/useWindowOperations';
import { isTauri } from '../utils/tauri';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

// Helper function to check if richContent is truly empty
const isRichContentEmpty = (richContent: any): boolean => {
  if (!richContent) return true;
  if (!Array.isArray(richContent)) return false;

  // Check if all blocks are empty
  return richContent.every((node: any) => {
    if (!node.children || !Array.isArray(node.children)) return true;

    // Check if all children are empty text nodes
    return node.children.every((child: any) => {
      if (typeof child.text === 'string') {
        return !child.text.trim();
      }
      // If it's not a text node (e.g., image, hashtag), consider it non-empty
      return false;
    });
  });
};

interface NoteEditorProps {
  mode: 'create' | 'edit';
  noteId?: string; // edit 模式下需要
  showConfetti?: boolean; // 是否显示 confetti 动画（create 模式默认 true）
  placeholder?: string;
  currentNoteId?: string | null;
  editorRef?: React.RefObject<RenderingWysiwygEditorRef | null>;
}

function NoteEditor({
  mode,
  noteId,
  showConfetti = mode === 'create',
  placeholder = "此时此刻，你在想什么呢？",
  currentNoteId,
  editorRef: externalEditorRef,
}: NoteEditorProps) {
  const { notes, setNotes, deleteNote, togglePin, toggleFavorite, updateNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, setNotes);

  // Internal state
  const [content, setContent] = useState('');
  const [richContent, setRichContent] = useState<any>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);

  // Refs
  const panelRef = useRef<HTMLDivElement | null>(null);
  const notesListRef = useRef<HTMLDivElement | null>(null);
  const internalEditorRef = useRef<RenderingWysiwygEditorRef | null>(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const isExpandedRef = useRef(false);

  // Load note in edit mode
  useEffect(() => {
    if (mode === 'edit' && noteId) {
      const loadNote = async () => {
        try {
          let noteData: Note | null = null;

          if (isTauri()) {
            noteData = await invoke<Note | null>('get_temp_note', { id: noteId });
            console.log('Retrieved note from Tauri backend:', noteData);
          } else {
            noteData = notes.find(n => n.id === noteId) || null;
            console.log('Retrieved note from Jotai atom:', noteData);
          }

          if (noteData) {
            console.log('[NoteEditor] Loading note:', noteData.id);
            setCurrentNote(noteData);
            setContent(noteData.text);
            setRichContent(noteData.richContent || null);
            setCurrentTags(noteData.tags || []);
          } else {
            console.error('No note found with ID:', noteId);
          }
        } catch (error) {
          console.error('Failed to load note:', error);
        }
      };

      loadNote();
    }
  }, [mode, noteId, notes]);

  // Handle content change
  const handleContentChange = useCallback((newContent: string, tags?: string[], newRichContent?: any) => {
    console.log('[NoteEditor] Content changed:', {
      newContentLength: newContent?.length,
      hasNewRichContent: newRichContent !== undefined,
    });
    setContent(newContent);
    if (tags) setCurrentTags(tags);
    if (newRichContent !== undefined) {
      setRichContent(newRichContent);
    }
  }, []);

  // Handle submit/save
  const handleSubmit = useCallback(async () => {
    // Allow saving if either has text content or has non-empty rich content
    if (!((content && typeof content === 'string' && content.trim()) || !isRichContentEmpty(richContent))) {
      return;
    }

    if (mode === 'create') {
      // Create new note
      const firstLine = content ? content.split("\n")[0].substring(0, 50) : "Image Note";
      const title = firstLine || "Untitled Note";
      const tags = currentTags.length > 0 ? currentTags : [];

      const newNote: Note = {
        id: Date.now().toString(),
        text: content || "",
        title,
        time: new Date().toLocaleString(),
        tags,
        richContent: richContent,
      };

      console.log('[NoteEditor] Creating new note:', newNote.id);
      setNotes([...notes, newNote]);

      // Reset editor
      setContent("");
      setRichContent(null);
      setCurrentTags([]);
      editorRef.current?.resetAndFocus();

      // Show confetti animation if enabled
      if (showConfetti) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ff3366', '#ff66cc', '#ff99dd', '#9966ff', '#6699ff'],
          ticks: 200,
          gravity: 1.2,
          scalar: 1.2,
          shapes: ['star', 'circle'],
          drift: 0
        });
      }

      if (!isTauri()) return;

      // Store to backend
      await invoke("store_temp_note", { note: newNote });

      // Try to generate title using AI
      try {
        const [generatedTitle, generatedTags] = await invoke<[string, string[]]>(
          "generate_title_and_tags",
          { content: content }
        );
        newNote.title = generatedTitle;
        newNote.tags = generatedTags;
        setNotes((prev) => [...prev.slice(0, -1), newNote]);
        await invoke("store_temp_note", { note: newNote });
      } catch (error) {
        console.log("Using local title generation");
      }
    } else if (mode === 'edit' && currentNote) {
      // Update existing note
      const updatedNote: Note = {
        ...currentNote,
        text: content,
        title: content.split('\n')[0].substring(0, 50) || 'Untitled Note',
        time: new Date().toLocaleString(),
        tags: currentTags.length > 0 ? currentTags : currentNote.tags,
        richContent: richContent,
      };

      console.log('[NoteEditor] Updating note:', updatedNote.id);

      try {
        await updateNote(updatedNote);

        // Update window title
        if (isTauri()) {
          try {
            const currentWindow = getCurrentWebviewWindow();
            await currentWindow.setTitle(`Edit: ${updatedNote.title}`);
          } catch (error) {
            console.error('Failed to update window title:', error);
          }
        } else {
          document.title = `Edit: ${updatedNote.title}`;
        }

        setCurrentNote(updatedNote);

        // Show save success feedback
        const button = document.querySelector('.submit-btn') as HTMLButtonElement;
        if (button) {
          const originalText = button.textContent;
          button.textContent = 'Saved ✓';
          setTimeout(() => {
            button.textContent = originalText;
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to save note:', error);
      }
    }
  }, [mode, content, richContent, currentTags, currentNote, notes, setNotes, updateNote, editorRef, showConfetti]);

  // Toggle panel
  const handleTogglePanel = useCallback(() => {
    if (!panelRef.current) {
      console.error('Panel ref not initialized');
      return;
    }

    // Find the editor scroll container
    const editorContainer = (
      document.querySelector('[data-plate-container]') ||
      document.querySelector('.wysiwyg-container') ||
      document.querySelector('[data-slate-editor]')
    ) as HTMLElement;

    // Capture scroll state
    let wasAtBottom = false;
    if (editorContainer) {
      const { scrollTop, scrollHeight, clientHeight } = editorContainer;
      wasAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    }

    // Restore scroll helper
    const restoreBottomScroll = () => {
      if (editorContainer && wasAtBottom) {
        const { scrollHeight, clientHeight } = editorContainer;
        editorContainer.scrollTop = Math.max(0, scrollHeight - clientHeight);
      }
    };

    if (!isExpandedRef.current) {
      // Expanding
      isExpandedRef.current = true;

      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === 'height') {
          restoreBottomScroll();
          panelRef.current?.removeEventListener('transitionend', handleTransitionEnd as EventListener);
        }
      };

      panelRef.current.addEventListener('transitionend', handleTransitionEnd as EventListener);
      panelRef.current.classList.remove('hidden', 'collapsed');
      panelRef.current.classList.add('visible');
      document.querySelector('.recent-notes-toggle')?.classList.add('active');
    } else {
      // Collapsing
      isExpandedRef.current = false;

      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === 'height') {
          restoreBottomScroll();
          if (panelRef.current) {
            panelRef.current.classList.add('hidden');
            panelRef.current.classList.remove('collapsed');
          }
          panelRef.current?.removeEventListener('transitionend', handleTransitionEnd as EventListener);
        }
      };

      panelRef.current.addEventListener('transitionend', handleTransitionEnd as EventListener);
      panelRef.current.classList.remove('visible');
      panelRef.current.classList.add('collapsed');
      document.querySelector('.recent-notes-toggle')?.classList.remove('active');
    }

    setIsPanelExpanded(isExpandedRef.current);
  }, []);

  return (
    <div className="editor-section">
      <div className="editor-area">
        <RenderingWysiwygEditor
          ref={editorRef}
          initialContent={content}
          initialRichContent={richContent}
          onChange={handleContentChange}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </div>

      {/* Notes panel */}
      <div
        ref={panelRef}
        className={`recent-notes-panel ${isPanelExpanded ? 'visible' : 'hidden'}`}
      >
        <div className="notes-list" ref={notesListRef}>
          {notes.length === 0 ? (
            <div className="empty-state-enhanced">
              <div className="empty-state-logo">
                <svg className="floating-logo" viewBox="0 0 986.05 1080" xmlns="http://www.w3.org/2000/svg">
                  <g fill="currentColor">
                    <path d="M281.73,892.18V281.73C281.73,126.13,155.6,0,0,0l0,0v610.44C0,766.04,126.13,892.18,281.73,892.18z"/>
                    <path d="M633.91,1080V469.56c0-155.6-126.13-281.73-281.73-281.73l0,0v610.44C352.14,953.87,478.31,1080,633.91,1080L633.91,1080z"/>
                    <path d="M704.32,91.16L704.32,91.16v563.47l0,0c155.6,0,281.73-126.13,281.73-281.73S859.92,91.16,704.32,91.16z"/>
                  </g>
                </svg>
              </div>
              <div className="empty-state-content w-full max-w-[280px] mx-auto flex flex-col items-center">
                <h3 className="empty-state-title mx-auto">
                  <Sparkles size={16} className="icon-sparkle" />
                  开启灵感之旅
                </h3>
                <p className="empty-state-text w-full text-center">快捷键 <kbd>⌘N</kbd> 随时唤起</p>
              </div>
            </div>
          ) : (
            (() => {
              const sortedNotes = [...notes].sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return Number(b.id) - Number(a.id);
              });

              const noteRanks = new Map<string, number>();
              [...notes]
                .sort((a, b) => Number(b.id) - Number(a.id))
                .forEach((note, index) => {
                  noteRanks.set(note.id, notes.length - index);
                });

              return sortedNotes.map((note) => {
                const rank = noteRanks.get(note.id)!;
                const isTopThree = rank <= 3;

                return (
                  <div
                    key={note.id}
                    className={`note-item ${
                      currentNoteId === note.id ? 'active' : ''
                    } ${note.favorite ? 'favorite' : ''} ${
                      note.pinned ? 'pinned' : ''
                    }`}
                    onClick={() => openNoteInNewWindow(note)}
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
                          onClick={async (e) => {
                            e.stopPropagation();
                            await deleteNote(note.id);
                          }}
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
        onToggleNotes={handleTogglePanel}
        onSubmit={handleSubmit}
        submitDisabled={(!content || typeof content !== 'string' || !content.trim()) && isRichContentEmpty(richContent)}
      />
    </div>
  );
}

export default NoteEditor;
