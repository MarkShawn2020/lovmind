import { useState, useEffect, useRef, useCallback } from 'react';
import { Archive, Crown, Pin, Sparkles, Star, X, User, Mail, LogOut, UserCircle, Info, Settings } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';
import { Note, noteStatsAtom } from '../store';
import RenderingWysiwygEditor, { type EditorContentChange, RenderingWysiwygEditorRef, isEditorContentEmpty } from './RenderingWysiwygEditor';
import EditorToolbar from './EditorToolbar';
import ProfileModal from './ProfileModal';
import { useNoteOperations } from '../hooks/useNoteOperations';
import { useWindowOperations } from '../hooks/useWindowOperations';
import { isTauri } from '../utils/tauri';
import { useAtomValue } from 'jotai';
import lovpenLogo from '../assets/lovpen-logo.svg';
import packageJson from '../../package.json';
import { NotesSidebar } from './NotesSidebar';
import { useUserProfile } from '@/hooks/useUserProfile';

interface NoteEditorProps {
  mode: 'main' | 'float';
  noteId?: string; // float 模式下需要
  showConfetti?: boolean; // 是否显示 confetti 动画（main 模式默认 true）
  placeholder?: string;
  currentNoteId?: string | null;
  editorRef?: React.RefObject<RenderingWysiwygEditorRef | null>;
}

function NoteEditor({
  mode,
  noteId,
  showConfetti = mode === 'main',
  placeholder = "此时此刻，你在想什么呢？",
  currentNoteId,
  editorRef: externalEditorRef,
}: NoteEditorProps) {
  const { notes, setNotes, deleteNote, togglePin, toggleFavorite, toggleArchive, updateNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, setNotes);
  const noteStats = useAtomValue(noteStatsAtom);
  const { userProfile, reloadProfile } = useUserProfile();

  // Internal state
  const [content, setContent] = useState('');
  const [richContent, setRichContent] = useState<EditorContentChange['richContent'] | null>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [isWindowAlwaysOnTop, setIsWindowAlwaysOnTop] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);

  // Refs
  const notesListRef = useRef<HTMLDivElement | null>(null);
  const internalEditorRef = useRef<RenderingWysiwygEditorRef | null>(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isProfileModalOpen) {
      reloadProfile();
    }
  }, [isProfileModalOpen, reloadProfile]);

  // Handle click outside to close user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node) &&
        userButtonRef.current &&
        !userButtonRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  // Handle window dragging
  const handleHeaderMouseDown = async () => {
    if (!isTauri()) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      console.error("Failed to start dragging:", error);
    }
  };


  // Load note in float mode
  useEffect(() => {
    if (mode === 'float' && noteId) {
      const perfLabel = `[Perf] NoteEditor load note ${noteId}`;
      const perfInvokeLabel = `[Perf] Invoke get_temp_note ${noteId}`;

      console.time(perfLabel);
      const loadNote = async () => {
        try {
          let noteData: Note | null = null;

          if (isTauri()) {
            console.time(perfInvokeLabel);
            noteData = await invoke<Note | null>('get_temp_note', { id: noteId });
            console.timeEnd(perfInvokeLabel);
            console.log('Retrieved note from Tauri backend:', noteData);

            // Check current window always-on-top status
            try {
              const currentWindow = getCurrentWindow();
              const isOnTop = await currentWindow.isAlwaysOnTop?.() || false;
              setIsWindowAlwaysOnTop(isOnTop);
            } catch (error) {
              console.error('Failed to get always-on-top status:', error);
            }
          } else {
            noteData = notes.find(n => n.id === noteId) || null;
            console.log('Retrieved note from Jotai atom:', noteData);
          }

          if (noteData) {
            console.log('[NoteEditor] Loading note in edit mode:', {
              id: noteData.id,
              rank: noteData.rank,
              title: noteData.title,
              hasRank: noteData.rank !== undefined,
            });
            setCurrentNote(noteData);
            setContent(noteData.text);
            setRichContent(noteData.richContent || null);
            setCurrentTags(noteData.tags || []);
            const hasText = Boolean(noteData.text?.trim());
            setIsEditorEmpty(!hasText && isEditorContentEmpty(noteData.richContent));
          } else {
            // No note found in backend - this is a new note created by toggle_float_windows
            // Get rank from URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const rankParam = urlParams.get('rank');
            const rank = rankParam ? parseInt(rankParam, 10) : undefined;

            console.log('[NoteEditor] Creating new note from URL params:', {
              noteId,
              rank,
              hasRank: rank !== undefined,
            });

            // Create a temporary note object (will be persisted when user saves)
            const newNote: Note = {
              id: noteId,
              text: '',
              title: 'Untitled Note',
              time: new Date().toISOString(),
              tags: [],
              rank: rank,
            };

            setCurrentNote(newNote);
            setContent('');
            setRichContent(null);
            setCurrentTags([]);
            setIsEditorEmpty(true);
          }
        } catch (error) {
          console.error('Failed to load note:', error);
        } finally {
          console.timeEnd(perfLabel);
        }
      };

      loadNote();
    }
  }, [mode, noteId, notes]);

  // Handle content change
  const handleContentChange = useCallback((payload: EditorContentChange) => {
    console.log('[NoteEditor] Content changed:', {
      newContentLength: payload.text?.length,
      hasNewRichContent: payload.richContent !== undefined,
    });
    setContent(payload.text);
    setCurrentTags(payload.tags);
    setRichContent(payload.richContent);
    setIsEditorEmpty(payload.isEmpty);
  }, []);

  // Handle submit/save
  const handleSubmit = useCallback(async () => {
    const hasTypedContent = typeof content === 'string' && Boolean(content.trim());
    if (!hasTypedContent && isEditorEmpty) {
      return;
    }

    if (mode === 'main') {
      // Create new note
      const firstLine = content ? content.split("\n")[0].substring(0, 50) : "Image Note";
      const title = firstLine || "Untitled Note";
      const tags = currentTags.length > 0 ? currentTags : [];

      // Calculate rank: max existing rank + 1, or notes.length + 1 for backward compatibility
      const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
      const newRank = Math.max(maxRank + 1, notes.length + 1);

      console.log('[NoteEditor] Creating new note with rank:', {
        existingNotesCount: notes.length,
        maxRank,
        newRank,
        notesWithRank: notes.filter(n => n.rank).length,
      });

      const newNote: Note = {
        id: Date.now().toString(),
        text: content || "",
        title,
        time: new Date().toLocaleString(),
        tags,
        richContent: richContent,
        rank: newRank,
      };

      console.log('[NoteEditor] Created new note:', {
        id: newNote.id,
        rank: newNote.rank,
        title: newNote.title,
      });
      setNotes([...notes, newNote]);

      // Reset editor
      setContent("");
      setRichContent(null);
      setCurrentTags([]);
      setIsEditorEmpty(true);
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
    } else if (mode === 'float' && currentNote) {
      // Update existing note
      const updatedNote: Note = {
        ...currentNote,
        text: content,
        title: content.split('\n')[0].substring(0, 50) || 'Untitled Note',
        time: new Date().toLocaleString(),
        tags: currentTags.length > 0 ? currentTags : currentNote.tags,
        richContent: richContent,
      };

      console.log('[NoteEditor] Updating note in edit mode:', {
        id: updatedNote.id,
        rank: updatedNote.rank,
        hasRank: updatedNote.rank !== undefined,
        title: updatedNote.title,
        currentNoteRank: currentNote.rank,
      });

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
  }, [mode, content, richContent, currentTags, currentNote, notes, setNotes, updateNote, editorRef, showConfetti, isEditorEmpty]);

  // Handle pin toggle for float mode
  const handleTogglePin = useCallback(async () => {
    if (mode === 'float' && currentNote) {
      await togglePin(currentNote.id);
      // Update local state
      setCurrentNote({
        ...currentNote,
        pinned: !currentNote.pinned,
      });
    }
  }, [mode, currentNote, togglePin]);

  // Handle always on top toggle for float mode
  const handleToggleAlwaysOnTop = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent window drag
    }
    if (mode === 'float' && isTauri()) {
      try {
        const currentWindow = getCurrentWindow();
        const newState = !isWindowAlwaysOnTop;
        await currentWindow.setAlwaysOnTop(newState);
        setIsWindowAlwaysOnTop(newState);
        console.log('Window always on top set to:', newState);
      } catch (error) {
        console.error('Failed to toggle always on top:', error);
      }
    }
  }, [mode, isWindowAlwaysOnTop]);

  // Handle duplicate note
  const handleDuplicateNote = useCallback(async (note: Note) => {
    try {
      // Calculate new rank: max existing rank + 1
      const maxRank = notes.reduce((max, n) => Math.max(max, n.rank || 0), 0);
      const newRank = Math.max(maxRank + 1, notes.length + 1);

      const duplicatedNote: Note = {
        ...note,
        id: Date.now().toString(),
        title: `${note.title} (副本)`,
        time: new Date().toLocaleString(),
        rank: newRank,
        pinned: false,
        favorite: false,
      };

      console.log('[NoteEditor] Duplicating note:', {
        originalId: note.id,
        newId: duplicatedNote.id,
        newRank,
      });

      setNotes([...notes, duplicatedNote]);

      // Store to backend if in Tauri
      if (isTauri()) {
        await invoke("store_temp_note", { note: duplicatedNote });
      }
    } catch (error) {
      console.error('Failed to duplicate note:', error);
    }
  }, [notes, setNotes]);

  // Handle title edit save
  const handleSaveTitle = useCallback(async () => {
    if (!currentNote || !editingTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    const updatedNote: Note = {
      ...currentNote,
      title: editingTitle.trim(),
    };

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
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Failed to save title:', error);
      setIsEditingTitle(false);
    }
  }, [currentNote, editingTitle, updateNote]);

  // Notes sidebar is rendered via dedicated component now

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-transparent rounded-xl">
      {/* Header */}
      {mode === 'main' ? (
        <div
          className="h-[60px] px-[var(--spacing-text)] py-[var(--spacing-s)] bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex justify-between items-center rounded-t-xl select-none flex-shrink-0 cursor-move"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="flex items-center gap-2">
            <img
              src={lovpenLogo}
              alt="Lovmind"
              className="h-5 w-auto brightness-0 invert select-none"
              draggable={false}
            />
            <h1 className="text-lg font-semibold tracking-tight">Lovmind ({noteStats.total})</h1>
          </div>
          <div className="flex gap-2 items-center">
            <button
              ref={userButtonRef}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-none overflow-hidden"
              onClick={(e) => {
                e.stopPropagation();
                if (userButtonRef.current) {
                  const rect = userButtonRef.current.getBoundingClientRect();
                  setMenuPosition({
                    top: rect.bottom + 8,
                    right: window.innerWidth - rect.right
                  });
                }
                setIsUserMenuOpen(!isUserMenuOpen);
              }}
              title={userProfile.nickname || 'User menu'}
            >
              {userProfile.avatar ? (
                <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : userProfile.nickname ? (
                <span className="text-white text-sm font-semibold uppercase">
                  {userProfile.nickname.charAt(0)}
                </span>
              ) : (
                <User size={18} className="text-white" />
              )}
            </button>

            {noteStats.streak > 2 && (
              <span className="px-2.5 py-1 bg-gradient-to-br from-[#ff6b6b] to-[#ffd93d] text-white rounded-xl text-xs font-medium tracking-tight backdrop-blur-lg streak-badge ml-2" title={`${noteStats.streak} day streak!`}>
                🔥 {noteStats.streak}d
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          className="h-[60px] px-[var(--spacing-text)] py-[var(--spacing-s)] bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center gap-3 rounded-t-xl select-none flex-shrink-0 cursor-move"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="text-sm font-semibold text-white flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
            {(() => {
              if (!currentNote) return 'Untitled Note';

              // Use stored rank if available, otherwise calculate dynamically (for backward compatibility)
              let rank: number | undefined;
              if (currentNote.rank) {
                rank = currentNote.rank;
                console.log('[NoteEditor] Using stored rank:', {
                  noteId: currentNote.id,
                  rank,
                  title: currentNote.title,
                });
              } else {
                const noteRanks = new Map<string, number>();

                // Try to sort by numeric ID first (timestamp-based), fallback to string comparison for UUIDs
                const sortedNotes = [...notes].sort((a, b) => {
                  const aNum = Number(a.id);
                  const bNum = Number(b.id);

                  // If both are valid numbers (timestamp IDs), compare numerically
                  if (!isNaN(aNum) && !isNaN(bNum)) {
                    return bNum - aNum;
                  }

                  // Otherwise, compare as strings (for UUID or mixed cases)
                  return b.id.localeCompare(a.id);
                });

                sortedNotes.forEach((note, index) => {
                  noteRanks.set(note.id, index + 1);
                });

                rank = noteRanks.get(currentNote.id);

                console.log('[NoteEditor] Calculated dynamic rank:', {
                  noteId: currentNote.id,
                  rank,
                  title: currentNote.title,
                  totalNotes: notes.length,
                  noteHasRank: currentNote.rank !== undefined,
                  noteFoundInArray: notes.some(n => n.id === currentNote.id),
                  firstFewNoteIds: notes.slice(0, 3).map(n => n.id),
                });
              }

              const isTopThree = rank && rank <= 3;

              return (
                <>
                  {isTopThree && (
                    <Crown
                      className={`inline-flex align-middle rank-badge rank-${rank}`}
                      size={16}
                      fill="currentColor"
                    />
                  )}
                  {currentNote.pinned && (
                    <Pin className="inline-flex align-middle text-white" size={14} />
                  )}
                  {currentNote.favorite && (
                    <Star className="inline-flex align-middle text-white fill-white" size={14} />
                  )}
                  {rank}.{' '}
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={handleSaveTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveTitle();
                        } else if (e.key === 'Escape') {
                          setIsEditingTitle(false);
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
                        setEditingTitle(currentNote.title);
                        setIsEditingTitle(true);
                      }}
                      title={currentNote.title}
                    >
                      {currentNote.title}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="w-9 h-9 bg-transparent border-none flex items-center justify-center cursor-pointer transition-colors duration-150"
              onClick={handleToggleAlwaysOnTop}
              title={isWindowAlwaysOnTop ? 'Disable always on top' : 'Enable always on top'}
              style={{
                color: isWindowAlwaysOnTop ? 'white' : 'rgba(255, 255, 255, 0.5)'
              }}
            >
              <Pin size={16} />
            </button>
            <button
              className="w-9 h-9 bg-transparent border-none flex items-center justify-center cursor-pointer transition-colors duration-150 text-white/50 hover:text-white"
              onClick={async (e) => {
                e.stopPropagation();
                if (isTauri()) {
                  const currentWindow = getCurrentWebviewWindow();
                  await currentWindow.close();
                }
              }}
              title="Close window"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area - contains sidebar + editor */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - only visible on md+ screens */}
        <aside className="hidden sm:flex w-80 border-r border-border bg-muted flex-shrink-0 overflow-hidden flex-col">
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-[var(--spacing-s)]" ref={notesListRef}>
            <NotesSidebar
              notes={notes}
              currentNoteId={currentNoteId}
              showArchived={showArchived}
              onOpenNote={openNoteInNewWindow}
              onTogglePin={togglePin}
              onToggleArchive={toggleArchive}
              onDeleteNote={deleteNote}
              onDuplicateNote={handleDuplicateNote}
            />
          </div>
        </aside>

        {/* Editor + Toolbar Container */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor Area - grows to fill space */}
          <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden min-h-0 bg-background" ref={editorContainerRef}>
            <RenderingWysiwygEditor
              ref={editorRef}
              initialContent={content}
              initialRichContent={richContent}
              onChange={handleContentChange}
              onSubmit={handleSubmit}
              placeholder={placeholder}
            />
          </div>

          {/* Toolbar - fixed height */}
          <EditorToolbar
            mode={mode}
            onSubmit={handleSubmit}
            submitDisabled={(!content || typeof content !== 'string' || !content.trim()) && isEditorEmpty}
          />
        </div>
      </div>

      {/* User Menu - Fixed positioning to be above all other elements */}
      {isUserMenuOpen && (
        <div
          ref={userMenuRef}
          className="fixed w-48 bg-white rounded-lg shadow-2xl border border-gray-200 py-1"
          style={{
            top: `${menuPosition.top}px`,
            right: `${menuPosition.right}px`,
            zIndex: 99999
          }}
        >
          {/* Profile */}
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
            onClick={() => {
              setIsUserMenuOpen(false);
              setIsProfileModalOpen(true);
            }}
          >
            <UserCircle size={16} />
            Profile
          </button>

          {/* Keyboard Shortcuts */}
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
            onClick={async () => {
              setIsUserMenuOpen(false);
              if (isTauri()) {
                try {
                  await invoke('open_settings_window');
                } catch (error) {
                  console.error('Failed to open settings window:', error);
                }
              }
            }}
          >
            <Settings size={16} />
            Keyboard Shortcuts
          </button>

          {/* Archive */}
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
            onClick={() => {
              setIsUserMenuOpen(false);
              setShowArchived(!showArchived);
            }}
          >
            <Archive size={16} />
            {showArchived ? '活跃笔记' : '档案库'}
          </button>

          <div className="border-t border-gray-200 my-1" />

          {/* About */}
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
            onClick={() => {
              setIsUserMenuOpen(false);
              setIsAboutModalOpen(true);
            }}
          >
            <Info size={16} />
            About
          </button>

          {/* Version */}
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between border-none bg-transparent cursor-default"
            onClick={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              Version
            </div>
            <span className="text-xs text-gray-500">v{packageJson.version}</span>
          </button>

          {/* Contact */}
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
            onClick={async () => {
              setIsUserMenuOpen(false);
              if (isTauri()) {
                try {
                  const { openUrl } = await import('@tauri-apps/plugin-opener');
                  await openUrl('mailto:shawninjuly@gmail.com');
                } catch (error) {
                  console.error('Failed to open email client:', error);
                }
              } else {
                window.open('mailto:shawninjuly@gmail.com', '_blank');
              }
            }}
          >
            <Mail size={16} />
            Contact
          </button>

          <div className="border-t border-gray-200 my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
            onClick={async () => {
              setIsUserMenuOpen(false);
              if (isTauri()) {
                try {
                  await invoke('quit_app');
                } catch (error) {
                  console.error('Failed to exit:', error);
                }
              }
            }}
          >
            <LogOut size={16} />
            Quit
          </button>
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* About Modal */}
      {isAboutModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]"
          onClick={() => setIsAboutModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[90vw] max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img src={lovpenLogo} alt="Lovmind" className="w-10 h-10" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Lovmind</h2>
                    <p className="text-sm text-gray-500">v{packageJson.version}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAboutModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                随时随地，捕捉灵感。闪电般快速的浮动笔记应用。
              </p>

              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">主要特性</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong>⌘N 全局快捷键</strong> - 任何时候瞬间唤起</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong>浮动窗口</strong> - 置顶显示，快速记录</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong>富文本编辑</strong> - 所见即所得，支持 Markdown 快捷输入</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong>多窗口编辑</strong> - 每条笔记独立窗口</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong>数据本地存储</strong> - 当前为特发版，跨端云同步版本即将推出</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Lovpen</p>
                  <p className="text-xs text-gray-500">专注于创造高效优雅的效率工具</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">关注公众号</p>
                  <p className="text-sm font-medium text-gray-700">手工川</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NoteEditor;
