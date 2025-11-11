import { useState, useEffect, useRef, useCallback } from 'react';
import { Pin, Star, Trash2, Crown, Sparkles, Maximize2, X, User, Mail, HelpCircle, LogOut, UserCircle, Info } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';
import { Note, noteStatsAtom } from '../store';
import RenderingWysiwygEditor, { RenderingWysiwygEditorRef } from './RenderingWysiwygEditor';
import EditorToolbar from './EditorToolbar';
import ProfileModal from './ProfileModal';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useNoteOperations } from '../hooks/useNoteOperations';
import { useWindowOperations } from '../hooks/useWindowOperations';
import { isTauri } from '../utils/tauri';
import { useAtomValue } from 'jotai';
import lovpenLogo from '../assets/lovpen-logo.svg';
import packageJson from '../../package.json';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface UserProfile {
  nickname?: string;
  avatar?: string;
}

// Panel height constant
const PANEL_HEIGHT = 250;

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
  const noteStats = useAtomValue(noteStatsAtom);

  // Internal state
  const [content, setContent] = useState('');
  const [richContent, setRichContent] = useState<any>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [isWindowAlwaysOnTop, setIsWindowAlwaysOnTop] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  // Refs
  const panelRef = useRef<HTMLDivElement | null>(null);
  const notesListRef = useRef<HTMLDivElement | null>(null);
  const internalEditorRef = useRef<RenderingWysiwygEditorRef | null>(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const isExpandedRef = useRef(false);
  const collapsedHeightRef = useRef<number | undefined>(undefined);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const fixedEditorHeight = useRef<number | undefined>(undefined);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userButtonRef = useRef<HTMLButtonElement | null>(null);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (isTauri()) {
        try {
          const profile = await invoke<UserProfile | null>('get_user_profile');
          if (profile) {
            setUserProfile(profile);
          }
        } catch (error) {
          console.warn('Failed to load profile from Tauri, falling back to localStorage:', error);
          // Fallback to localStorage if Tauri command not available
          const saved = localStorage.getItem('user_profile');
          if (saved) {
            setUserProfile(JSON.parse(saved));
          }
        }
      } else {
        const saved = localStorage.getItem('user_profile');
        if (saved) {
          setUserProfile(JSON.parse(saved));
        }
      }
    };
    loadProfile();
  }, []);

  // Reload profile when modal closes
  useEffect(() => {
    if (!isProfileModalOpen) {
      const loadProfile = async () => {
        if (isTauri()) {
          try {
            const profile = await invoke<UserProfile | null>('get_user_profile');
            if (profile) {
              setUserProfile(profile);
            }
          } catch (error) {
            console.warn('Failed to load profile from Tauri, falling back to localStorage:', error);
            // Fallback to localStorage if Tauri command not available
            const saved = localStorage.getItem('user_profile');
            if (saved) {
              setUserProfile(JSON.parse(saved));
            }
          }
        } else {
          const saved = localStorage.getItem('user_profile');
          if (saved) {
            setUserProfile(JSON.parse(saved));
          }
        }
      };
      loadProfile();
    }
  }, [isProfileModalOpen]);

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

  // Handle manual window resize - keep panel fixed, let editor fill space
  useEffect(() => {
    if (!isTauri()) return;

    const handleResize = () => {
      if (!editorContainerRef.current || !panelRef.current) return;

      // Always ensure panel stays at exactly PANEL_HEIGHT when expanded
      if (isExpandedRef.current && panelRef.current) {
        // Force panel to stay at fixed height
        panelRef.current.style.flex = 'none';
        panelRef.current.style.height = `${PANEL_HEIGHT}px`;
        panelRef.current.style.minHeight = `${PANEL_HEIGHT}px`;
        panelRef.current.style.maxHeight = `${PANEL_HEIGHT}px`;
      }
    };

    window.addEventListener('resize', handleResize);

    // Also run once on mount to ensure panel constraints are set
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load note in edit mode
  useEffect(() => {
    if (mode === 'edit' && noteId) {
      const loadNote = async () => {
        try {
          let noteData: Note | null = null;

          if (isTauri()) {
            noteData = await invoke<Note | null>('get_temp_note', { id: noteId });
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

  // Handle pin toggle for edit mode
  const handleTogglePin = useCallback(async () => {
    if (mode === 'edit' && currentNote) {
      await togglePin(currentNote.id);
      // Update local state
      setCurrentNote({
        ...currentNote,
        pinned: !currentNote.pinned,
      });
    }
  }, [mode, currentNote, togglePin]);

  // Handle always on top toggle for edit mode
  const handleToggleAlwaysOnTop = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent window drag
    }
    if (mode === 'edit' && isTauri()) {
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

  // Animate window resize smoothly
  const animateWindowResize = useCallback((
    appWindow: any,
    startHeight: number,
    endHeight: number,
    width: number,
    duration: number = 300
  ) => {
    const startTime = performance.now();
    const delta = endHeight - startHeight;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Cubic bezier easing (0.4, 0, 0.2, 1) - matches CSS transition
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentHeight = startHeight + delta * eased;

      appWindow.setSize(new LogicalSize(width, Math.round(currentHeight))).catch((err: any) => {
        console.warn('Failed to resize window during animation:', err);
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // Toggle panel
  const handleTogglePanel = useCallback(async () => {
    if (!panelRef.current || !editorContainerRef.current) {
      console.warn('Panel or editor container ref not initialized');
      return;
    }

    if (!isExpandedRef.current) {
      // Expanding: LOCK editor height first, then animate window and panel
      isExpandedRef.current = true;

      // Step 1: Lock the editor container to its current height (prevent it from growing)
      const currentEditorHeight = editorContainerRef.current.clientHeight;
      fixedEditorHeight.current = currentEditorHeight;
      editorContainerRef.current.style.height = `${currentEditorHeight}px`;
      editorContainerRef.current.style.flexGrow = '0';
      editorContainerRef.current.style.flexShrink = '0';

      // Step 2: Start animated window expansion
      if (isTauri()) {
        const appWindow = getCurrentWindow();
        appWindow.innerSize().then(physicalSize => {
          return appWindow.scaleFactor().then(scaleFactor => {
            const currentSize = physicalSize.toLogical(scaleFactor);
            collapsedHeightRef.current = currentSize.height;

            // Animate window height from current to current + PANEL_HEIGHT
            animateWindowResize(
              appWindow,
              currentSize.height,
              currentSize.height + PANEL_HEIGHT,
              currentSize.width,
              300
            );
          });
        }).catch(error => {
          console.warn('Failed to start window resize animation:', error);
        });
      }

      // Step 3: Simultaneously animate panel sliding down (h-0 -> h-[250px])
      requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.classList.remove('hidden');
          // Force panel to stay at fixed height
          panelRef.current.style.flex = 'none';
          panelRef.current.style.minHeight = `${PANEL_HEIGHT}px`;
          panelRef.current.style.maxHeight = `${PANEL_HEIGHT}px`;
          // Ensure opacity is set for visibility
          panelRef.current.style.opacity = '1';
          document.querySelector('.recent-notes-toggle')?.classList.add('active');
          setIsPanelExpanded(true);
        }
      });

      // Step 4: After animation, unlock editor and clear panel opacity override
      setTimeout(() => {
        if (panelRef.current) {
          // Clear opacity override to let CSS class control it
          panelRef.current.style.opacity = '';
        }

        if (editorContainerRef.current) {
          fixedEditorHeight.current = undefined;
          editorContainerRef.current.style.height = '';
          editorContainerRef.current.style.flexGrow = '1';
        }
      }, 300);

    } else {
      // Collapsing: Mirror the expanding logic - lock editor, animate everything, then unlock
      isExpandedRef.current = false;

      // Step 1: Lock editor height to prevent layout shifts during animation
      const currentEditorHeight = editorContainerRef.current.clientHeight;
      fixedEditorHeight.current = currentEditorHeight;
      editorContainerRef.current.style.height = `${currentEditorHeight}px`;
      editorContainerRef.current.style.flexGrow = '0';
      editorContainerRef.current.style.flexShrink = '0';

      // Step 2: Remove CSS transition temporarily and use JS animation for panel height
      if (panelRef.current) {
        panelRef.current.style.transition = 'none';
      }

      document.querySelector('.recent-notes-toggle')?.classList.remove('active');

      // Step 3: Simultaneously animate panel height and window size with JS
      const startTime = performance.now();
      const duration = 300;

      const animateCollapse = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Cubic bezier easing (0.4, 0, 0.2, 1)
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Animate panel height from 250 to 0
        const currentPanelHeight = PANEL_HEIGHT * (1 - eased);
        if (panelRef.current) {
          panelRef.current.style.height = `${currentPanelHeight}px`;
          panelRef.current.style.opacity = String(1 - eased);
        }

        if (progress < 1) {
          requestAnimationFrame(animateCollapse);
        } else {
          // Animation complete
          setIsPanelExpanded(false);
          if (panelRef.current) {
            panelRef.current.style.transition = '';
            panelRef.current.style.height = '';
            panelRef.current.style.opacity = '';
          }
        }
      };

      requestAnimationFrame(animateCollapse);

      // Start window resize animation simultaneously
      if (isTauri()) {
        const appWindow = getCurrentWindow();
        appWindow.innerSize().then(physicalSize => {
          return appWindow.scaleFactor().then(scaleFactor => {
            const currentSize = physicalSize.toLogical(scaleFactor);
            const targetHeight = collapsedHeightRef.current ?? (currentSize.height - PANEL_HEIGHT);

            animateWindowResize(
              appWindow,
              currentSize.height,
              targetHeight,
              currentSize.width,
              300
            );
          });
        }).catch(error => {
          console.warn('Failed to start window resize animation:', error);
        });
      }

      // Step 4: After animations complete, hide panel and unlock editor
      setTimeout(() => {
        if (panelRef.current) {
          panelRef.current.classList.add('hidden');
          panelRef.current.style.flex = '';
          panelRef.current.style.height = '';
          panelRef.current.style.minHeight = '';
          panelRef.current.style.maxHeight = '';
          panelRef.current.style.opacity = '';
        }

        if (editorContainerRef.current) {
          fixedEditorHeight.current = undefined;
          editorContainerRef.current.style.height = '';
          editorContainerRef.current.style.flexGrow = '1';
          editorContainerRef.current.style.flexShrink = '0';
        }
      }, 300);
    }
  }, [animateWindowResize]);

  return (
    <div className="app-container">
      {/* Header */}
      {mode === 'create' ? (
        <div
          className="app-header cursor-move"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="flex items-center gap-2">
            <img
              src={lovpenLogo}
              alt="Lovpen"
              className="app-logo h-5 w-auto"
            />
            <h1>Lovpen Notes ({noteStats.total})</h1>
          </div>
          <div className="header-stats relative">
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
              <span className="header-stat-badge streak-badge ml-2" title={`${noteStats.streak} day streak!`}>
                🔥 {noteStats.streak}d
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          className="app-header cursor-move"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="text-sm font-semibold text-white flex items-center gap-1">
            {(() => {
              if (!currentNote) return 'Untitled Note';

              // Calculate rank
              const noteRanks = new Map<string, number>();
              [...notes]
                .sort((a, b) => Number(b.id) - Number(a.id))
                .forEach((note, index) => {
                  noteRanks.set(note.id, notes.length - index);
                });

              const rank = noteRanks.get(currentNote.id);
              const isTopThree = rank && rank <= 3;

              return (
                <>
                  {isTopThree && (
                    <Crown
                      className={`icon-inline rank-badge rank-${rank}`}
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
                  {rank}. {currentNote.title}
                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="toolbar-btn always-on-top-toggle"
              onClick={handleToggleAlwaysOnTop}
              title={isWindowAlwaysOnTop ? 'Disable always on top' : 'Enable always on top'}
              style={{
                background: 'transparent',
                border: 'none',
                color: isWindowAlwaysOnTop ? 'white' : 'rgba(255, 255, 255, 0.5)'
              }}
            >
              <Pin size={16} />
            </button>
            <button
              className="toolbar-btn close-btn"
              onClick={async (e) => {
                e.stopPropagation();
                if (isTauri()) {
                  const currentWindow = getCurrentWebviewWindow();
                  await currentWindow.close();
                }
              }}
              title="Close window"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Editor Section */}
      <div className="editor-section">
        {/* Fixed editor + toolbar container - height ABSOLUTELY never changes */}
        <div
          ref={editorContainerRef}
          className="flex flex-col overflow-hidden min-h-0"
          style={{
            height: fixedEditorHeight.current,
            flexShrink: 0,
            flexGrow: fixedEditorHeight.current ? 0 : 1,
          }}
        >
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

          <EditorToolbar
            mode={mode}
            onToggleNotes={handleTogglePanel}
            onSubmit={handleSubmit}
            submitDisabled={(!content || typeof content !== 'string' || !content.trim()) && isRichContentEmpty(richContent)}
          />
        </div>

        {/* Notes panel - expands below the fixed editor+toolbar */}
        <div
          ref={panelRef}
          className={`flex-shrink-0 bg-[var(--muted)] border-t border-[var(--border)] flex flex-col overflow-hidden transition-[height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[height,opacity] ${
            isPanelExpanded ? 'h-[250px] opacity-100' : 'h-0 opacity-0'
          }`}
        >
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-[var(--spacing-s)]" ref={notesListRef}>
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 gap-5 h-full">
              <div className="relative w-16 h-16">
                <svg className="floating-logo" viewBox="0 0 986.05 1080" xmlns="http://www.w3.org/2000/svg">
                  <g fill="currentColor">
                    <path d="M281.73,892.18V281.73C281.73,126.13,155.6,0,0,0l0,0v610.44C0,766.04,126.13,892.18,281.73,892.18z"/>
                    <path d="M633.91,1080V469.56c0-155.6-126.13-281.73-281.73-281.73l0,0v610.44C352.14,953.87,478.31,1080,633.91,1080L633.91,1080z"/>
                    <path d="M704.32,91.16L704.32,91.16v563.47l0,0c155.6,0,281.73-126.13,281.73-281.73S859.92,91.16,704.32,91.16z"/>
                  </g>
                </svg>
              </div>

              <div className="flex flex-col items-center gap-2 opacity-0 animate-[fadeInUpCentered_0.5s_ease_forwards_0.15s]">
                <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-[var(--foreground)] m-0">
                  <Sparkles size={16} className="icon-sparkle" />
                  开启灵感之旅
                </h3>
                <p className="text-center text-[0.8125rem] text-[var(--muted-foreground)] m-0">
                  快捷键 <kbd className="inline-block px-1.5 py-0.5 text-xs font-mono bg-[var(--muted)] border border-[var(--border)] rounded mx-0.5">⌘N</kbd> 随时唤起
                </p>
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
                    className={`note-item cursor-pointer bg-[var(--card)] p-2 px-2.5 rounded-[var(--radius)] shadow-sm transition-all relative border border-[var(--border)] h-[90px] min-h-[90px] overflow-hidden flex-shrink-0 hover:-translate-y-0.5 hover:shadow-md hover:border-primary group ${
                      currentNoteId === note.id ? 'active' : ''
                    } ${note.favorite ? 'favorite' : ''} ${
                      note.pinned ? 'pinned' : ''
                    }`}
                    onClick={() => openNoteInNewWindow(note)}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex justify-between mb-0.5">
                        <div className="text-sm font-semibold text-[var(--card-foreground)] flex items-center gap-1">
                          {isTopThree && (
                            <Crown
                              className={`icon-inline rank-badge rank-${rank}`}
                              size={16}
                              fill="currentColor"
                            />
                          )}
                          {note.pinned && (
                            <Pin className="inline-flex align-middle text-[var(--primary)]" size={14} />
                          )}
                          {note.favorite && (
                            <Star className="inline-flex align-middle text-[var(--highlight)] fill-[var(--highlight)]" size={14} />
                          )}
                          {rank}. {note.title}
                        </div>
                        <span className="text-[0.625rem] text-[var(--muted-foreground)]">{dayjs(note.time).fromNow()}</span>
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
                      <div
                        className="note-actions flex flex-col gap-0 items-stretch opacity-0 transition-opacity duration-200 absolute top-0 right-0 bottom-0 bg-white/95 p-0 rounded-r-[var(--radius)] border-l border-[var(--border)] shadow-[-2px_0_8px_rgba(0,0,0,0.05)] justify-center w-9 overflow-hidden group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className={`action-btn pin-btn py-1.5 px-1.5 bg-transparent border-none rounded-none cursor-pointer transition-all flex items-center justify-center w-full relative text-[var(--muted-foreground)] hover:bg-black/5 hover:text-[var(--primary)] hover:bg-[rgba(217,119,87,0.08)] ${
                            note.pinned ? 'active text-[var(--primary)] bg-[rgba(217,119,87,0.12)] border-[var(--primary)]' : ''
                          }`}
                          onClick={() => togglePin(note.id)}
                          title={note.pinned ? 'Unpin note' : 'Pin note'}
                        >
                          <Pin size={18} strokeWidth={2} />
                        </button>
                        <button
                          className={`action-btn favorite-btn py-1.5 px-1.5 bg-transparent border-none rounded-none cursor-pointer transition-all flex items-center justify-center w-full relative text-[var(--muted-foreground)] hover:bg-black/5 hover:text-[var(--highlight)] hover:bg-[rgba(194,192,125,0.08)] ${
                            note.favorite ? 'active text-[var(--highlight)] bg-[rgba(194,192,125,0.12)] border-[var(--highlight)]' : ''
                          }`}
                          onClick={() => toggleFavorite(note.id)}
                          title={
                            note.favorite ? 'Unfavorite note' : 'Favorite note'
                          }
                        >
                          <Star size={18} strokeWidth={2} className={note.favorite ? 'fill-[var(--highlight)]' : ''} />
                        </button>
                        <button
                          className="action-btn delete-btn py-1.5 px-1.5 bg-transparent border-none rounded-none cursor-pointer transition-all flex items-center justify-center w-full relative text-[var(--muted-foreground)] hover:bg-black/5 hover:text-[var(--destructive)] hover:bg-[rgba(200,84,80,0.08)]"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await deleteNote(note.id);
                          }}
                          title="Delete note"
                        >
                          <Trash2 size={18} strokeWidth={2} />
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
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
            onClick={() => {
              setIsUserMenuOpen(false);
              // TODO: Open help
            }}
          >
            <HelpCircle size={16} />
            Help
          </button>
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
            Contact Developer
          </button>
          <div className="border-t border-gray-200 my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between border-none bg-transparent cursor-default"
            onClick={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-2">
              <Info size={16} />
              Version
            </div>
            <span className="text-xs text-gray-500">v{packageJson.version}</span>
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
    </div>
  );
}

export default NoteEditor;
