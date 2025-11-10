import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  WebviewWindow,
  getAllWebviewWindows,
} from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined);
};
import confetti from "canvas-confetti";
import { Clock, Pin, Play, Send, Star, Trash2, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import lovpenLogo from "./assets/lovpen-logo.svg";
import RenderingWysiwygEditor from "./components/RenderingWysiwygEditor";
import packageJson from "../package.json";
import { useAtom, useAtomValue } from "jotai";
import { notesAtom, contentAtom, noteStatsAtom, Note } from "./store";

// Memoized toolbar button to prevent re-renders
const RecentNotesButton = memo(({ 
  onClick 
}: { 
  onClick: () => void;
}) => (
  <button
    className="toolbar-btn recent-notes-toggle"
    onClick={onClick}
    title="Toggle Recent Notes"
  >
    <Clock size={18} />
  </button>
));

const SendButton = memo(({ 
  disabled, 
  onClick 
}: { 
  disabled: boolean; 
  onClick: () => void;
}) => (
  <button
    className="send-btn"
    onClick={onClick}
    disabled={disabled}
    title="Submit (⌘+Enter)"
  >
    <Send size={18} />
  </button>
));

// Memoized toolbar to prevent any re-renders
const EditorToolbar = memo(({ 
  onToggleNotes,
  onSubmit,
  submitDisabled
}: {
  onToggleNotes: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
}) => (
  <div className="editor-toolbar">
    <div className="toolbar-left">
      <RecentNotesButton onClick={onToggleNotes} />
    </div>
    <div className="toolbar-right">
      <SendButton disabled={submitDisabled} onClick={onSubmit} />
    </div>
  </div>
));

function App() {
  const [content, setContent] = useAtom(contentAtom);
  const [notes, setNotes] = useAtom(notesAtom);
  const [resumingNoteId, setResumingNoteId] = useState<string | null>(null);
  const notesListRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isExpandedRef = useRef(false);
  // Store the collapsed height to restore when collapsing
  const collapsedHeightRef = useRef<number | null>(null);
  const PANEL_HEIGHT = 250;

  // Get note statistics from derived atom
  const noteStats = useAtomValue(noteStatsAtom);

  // Initialize window state on mount
  useEffect(() => {
    // Simply mark as not expanded on mount, don't change window size
    isExpandedRef.current = false;
    console.log('Window state initialized');
  }, []); // Only run once on mount

  useEffect(() => {
    if (!isTauri()) {
      console.log("Not running in Tauri environment, skipping event listeners");
      return;
    }

    // 监听窗口切换事件
    const unlisten = listen("toggle-window", () => {
      console.log("Window toggled");
    });

    // 监听所有note更新事件（全局监听器）
    console.log("Setting up global note update listener...");
    const unlistenNoteUpdate = listen<Note>(
      "global-note-updated",
      async (event) => {
        const updatedNote = event.payload;
        console.log("Main window received global note update:", updatedNote);
        console.log("Event type:", event.event);
        console.log("Full event:", event);

        // 立即更新UI - 使用函数式更新确保获取最新状态
        setNotes((prevNotes) => {
          console.log("Previous notes count:", prevNotes.length);
          console.log("Previous notes:", prevNotes);
          const existingNoteIndex = prevNotes.findIndex(
            (n) => n.id === updatedNote.id
          );

          if (existingNoteIndex !== -1) {
            // 更新已存在的note
            console.log("Found existing note at index:", existingNoteIndex);
            const newNotes = [...prevNotes];
            newNotes[existingNoteIndex] = updatedNote;
            console.log("Notes after update:", newNotes);
            return newNotes;
          } else {
            // 如果note不存在，可能是新创建的，添加到列表
            console.log("Note not found in list, adding as new");
            return [...prevNotes, updatedNote];
          }
        });

        // 强制重新渲染
        console.log("Update complete, forcing re-render...");
      }
    );

    // 添加键盘快捷键监听（开发者工具）
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + I 打开开发者工具
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "I") {
        e.preventDefault();
        try {
          const { getCurrentWebviewWindow } = await import(
            "@tauri-apps/api/webviewWindow"
          );
          const currentWindow = getCurrentWebviewWindow();
          await invoke("open_devtools", { window: currentWindow });
        } catch (error) {
          console.error("Failed to open devtools:", error);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      unlisten.then((fn) => fn());
      unlistenNoteUpdate.then((fn) => fn());
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // 当笔记更新时，滚动到底部（仅当没有pinned notes时）
  useEffect(() => {
    if (notesListRef.current) {
      const container = notesListRef.current.parentElement;
      if (container) {
        const hasPinnedNotes = notes.some((note) => note.pinned);
        if (!hasPinnedNotes) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }
  }, [notes]);

  // 启动时同步后端存储的notes
  useEffect(() => {
    if (!isTauri()) {
      console.log("Not running in Tauri environment, skipping backend sync");
      return;
    }

    const syncWithBackend = async () => {
      try {
        const backendNotes = await invoke<Note[]>("get_all_temp_notes");
        console.log("Found notes in backend:", backendNotes.length);

        if (backendNotes.length > 0) {
          // 合并后端的notes到当前状态
          setNotes((prevNotes) => {
            const noteMap = new Map(prevNotes.map((n) => [n.id, n]));

            // 用后端的数据更新或添加notes
            backendNotes.forEach((backendNote) => {
              noteMap.set(backendNote.id, backendNote);
            });

            return Array.from(noteMap.values());
          });
        }
      } catch (error) {
        console.error("Failed to sync with backend:", error);
      }
    };

    syncWithBackend();
  }, []); // 只在组件挂载时运行一次

  const handleSubmit = async () => {
    if (content.trim()) {
      // 生成标题和标签（暂时使用简单逻辑）
      const firstLine = content.split("\n")[0].substring(0, 50);
      const title = firstLine || "Untitled Note";
      const tags = content.includes("#") ? ["markdown"] : ["text"];

      const newNote: Note = {
        id: Date.now().toString(),
        text: content,
        title,
        time: new Date().toLocaleString(),
        tags,
      };

      // 如果正在resume一个note，删除它
      let updatedNotes = notes;
      if (resumingNoteId) {
        updatedNotes = notes.filter((note) => note.id !== resumingNoteId);
        setResumingNoteId(null);
        // 从后端也删除resumed note
        if (isTauri()) {
          await invoke("remove_temp_note", { id: resumingNoteId });
        }
      }

      setNotes([...updatedNotes, newNote]);
      setContent("");

      // 触发confetti动画
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

      if (!isTauri()) return;

      // 存储到后端
      await invoke("store_temp_note", { note: newNote });

      // 尝试调用后端生成标题
      try {
        const [generatedTitle, generatedTags] = await invoke<
          [string, string[]]
        >("generate_title_and_tags", {
          content: content,
        });
        newNote.title = generatedTitle;
        newNote.tags = generatedTags;
        setNotes((prev) => {
          // 重新计算，因为可能已经删除了resumed note
          const baseNotes = resumingNoteId
            ? prev.filter((note) => note.id !== resumingNoteId)
            : prev;
          return [...baseNotes.slice(0, -1), newNote];
        });
        // 更新后端存储的note
        await invoke("store_temp_note", { note: newNote });
      } catch (error) {
        console.log("Using local title generation");
      }
    }
  };

  const handleDelete = async (noteId: string) => {
    setNotes(notes.filter((note) => note.id !== noteId));
    // 从后端删除
    if (isTauri()) {
      await invoke("remove_temp_note", { id: noteId });
    }
    // 如果删除的是正在resume的note，清理状态
    if (resumingNoteId === noteId) {
      setResumingNoteId(null);
    }
  };

  const handleFavorite = async (noteId: string) => {
    const updatedNotes = notes.map((note) =>
      note.id === noteId ? { ...note, favorite: !note.favorite } : note
    );
    setNotes(updatedNotes);
    // 更新后端
    if (isTauri()) {
      const updatedNote = updatedNotes.find((n) => n.id === noteId);
      if (updatedNote) {
        await invoke("store_temp_note", { note: updatedNote });
      }
    }
  };

  const handlePin = async (noteId: string) => {
    const updatedNotes = notes.map((note) =>
      note.id === noteId ? { ...note, pinned: !note.pinned } : note
    );
    setNotes(updatedNotes);
    // 更新后端
    if (isTauri()) {
      const updatedNote = updatedNotes.find((n) => n.id === noteId);
      if (updatedNote) {
        await invoke("store_temp_note", { note: updatedNote });
      }
    }
  };

  const handleResume = (note: Note) => {
    // 如果已经在resume这个note，取消它
    if (resumingNoteId === note.id) {
      setResumingNoteId(null);
      // 移除编辑器中的resumed内容（从开头移除）
      const separator = "\n\n---\n\n";
      const resumedContent = note.text + separator;
      if (content.startsWith(resumedContent)) {
        setContent(content.slice(resumedContent.length));
      } else if (content === note.text) {
        setContent("");
      }
    } else {
      // 开始resume这个note - 将resumed内容放在前面
      setResumingNoteId(note.id);
      const separator = content.trim() ? "\n\n---\n\n" : "";
      setContent(note.text + separator + content);
    }
  };

  const handleOpenInNewWindow = async (note: Note) => {
    if (!isTauri()) {
      console.log("Opening in new window only works in Tauri environment");
      return;
    }

    try {
      // 检查是否已经有打开的窗口
      const windowLabel = `note-editor-${note.id}`;
      const existingWindows = await getAllWebviewWindows();
      const existingWindow = existingWindows.find(
        (w) => w.label === windowLabel
      );

      if (existingWindow) {
        // 如果窗口已存在，聚焦到该窗口
        await existingWindow.setFocus();
        console.log("Focusing existing window for note:", note.id);
        return;
      }

      // 先检查后端是否已有该note的数据（可能是之前保存的）
      let noteToOpen: Note;
      try {
        const backendNote = await invoke<Note | null>("get_temp_note", {
          id: note.id,
        });
        if (backendNote) {
          console.log("Found existing note in backend:", note.id);
          noteToOpen = backendNote;
          // 同步更新主窗口的状态
          setNotes((prevNotes) =>
            prevNotes.map((n) => (n.id === note.id ? backendNote : n))
          );
        } else {
          // 如果后端没有，使用当前的note数据
          noteToOpen = notes.find((n) => n.id === note.id) || note;
          await invoke("store_temp_note", { note: noteToOpen });
          console.log("Stored new note to backend:", note.id);
        }
      } catch (error) {
        console.error("Error checking backend storage:", error);
        // 如果出错，使用当前数据
        noteToOpen = notes.find((n) => n.id === note.id) || note;
        await invoke("store_temp_note", { note: noteToOpen });
      }

      // 在开发环境中使用完整的开发服务器URL
      const isDev = window.location.hostname === "localhost";
      const url = isDev
        ? `http://localhost:1420/editor.html?noteId=${note.id}`
        : `/editor.html?noteId=${note.id}`;

      console.log("Opening window with URL:", url);

      // 创建新窗口编辑note
      const webview = new WebviewWindow(windowLabel, {
        url: url,
        title: `Edit: ${noteToOpen.title}`,
        width: 600,
        height: 500,
        resizable: true,
        center: true,
        alwaysOnTop: true, // 确保编辑窗口在最上层
        focus: true, // 立即获得焦点
        skipTaskbar: false, // 在任务栏显示
      });

      // 确保窗口获得焦点
      await webview.once("tauri://created", async () => {
        await webview.setFocus();
        console.log("Editor window created and focused for note:", note.id);
      });

      // 监听窗口关闭事件（全局监听器会处理更新）
      await webview.once("tauri://destroyed", async () => {
        console.log("Editor window closed for note:", note.id);
      });
    } catch (error) {
      console.error("Failed to open editor window:", error);
      alert(`Failed to open editor window: ${error}`);
    }
  };

  const handleHeaderMouseDown = async () => {
    if (!isTauri()) return;

    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      console.error("Failed to start dragging:", error);
    }
  };

  // Toggle function - Squeeze view internally without resizing window
  const handleToggleRecentNotes = useCallback(() => {
    if (!panelRef.current) {
      console.error('Panel ref not initialized');
      return;
    }

    // Find the editor scroll container - try multiple selectors
    const editorContainer = (
      document.querySelector('[data-plate-container]') ||
      document.querySelector('.wysiwyg-container') ||
      document.querySelector('[data-slate-editor]')
    ) as HTMLElement;

    if (!editorContainer) {
      console.warn('Could not find editor scroll container');
    }

    // Capture scroll state before resize
    let wasAtBottom = false;

    if (editorContainer) {
      const { scrollTop, scrollHeight, clientHeight } = editorContainer;
      // Consider "at bottom" if within 50px of bottom
      wasAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    }

    // Helper to restore scroll to bottom
    const restoreBottomScroll = () => {
      if (editorContainer && wasAtBottom) {
        const { scrollHeight, clientHeight } = editorContainer;
        editorContainer.scrollTop = Math.max(0, scrollHeight - clientHeight);
      }
    };

    if (!isExpandedRef.current) {
      // Expanding - show panel within existing window space
      isExpandedRef.current = true;

      // Listen for transition end, then adjust scroll
      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === 'height') {
          restoreBottomScroll();
          panelRef.current?.removeEventListener('transitionend', handleTransitionEnd as EventListener);
        }
      };

      panelRef.current.addEventListener('transitionend', handleTransitionEnd as EventListener);

      // Start the animation
      if (panelRef.current) {
        panelRef.current.classList.remove('hidden', 'collapsed');
        panelRef.current.classList.add('visible');
      }
      document.querySelector('.recent-notes-toggle')?.classList.add('active');

    } else {
      // Collapsing - hide panel
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

      if (panelRef.current) {
        panelRef.current.classList.remove('visible');
        panelRef.current.classList.add('collapsed');
      }
      document.querySelector('.recent-notes-toggle')?.classList.remove('active');
    }
  }, []);

  return (
    <div className="app-container">
      <div 
        className="app-header" 
        onMouseDown={handleHeaderMouseDown}
        style={{ cursor: 'move' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={lovpenLogo}
            alt="Lovpen"
            className="app-logo"
            style={{ height: '20px', width: 'auto' }}
          />
          <h1>Lovpen Notes</h1>
          <span 
            className="version-badge" 
            style={{ 
              fontSize: '0.7em', 
              padding: '2px 6px', 
              marginLeft: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              fontWeight: 'normal',
              opacity: 0.7,
              alignSelf: 'center'
            }}
          >
            v{packageJson.version}
          </span>
        </div>
        <div className="header-stats">
          <span className="header-stat-badge">
            {noteStats.total} {noteStats.total === 1 ? 'note' : 'notes'}
          </span>
          {noteStats.streak > 2 && (
            <span className="header-stat-badge streak-badge" title={`${noteStats.streak} day streak!`}>
              🔥 {noteStats.streak}d
            </span>
          )}
        </div>
      </div>


      <div className="editor-section">
        <div className="editor-area">
          <RenderingWysiwygEditor
            initialContent={content}
            onChange={setContent}
            onSubmit={handleSubmit}
            placeholder="Start writing your note..."
          />
        </div>

        {/* Panel always rendered but hidden by default */}
        <div ref={panelRef} className="recent-notes-panel hidden">
            <div className="notes-list" ref={notesListRef}>
              {notes.length === 0 ? (
                <p className="empty-state">No notes yet. Start writing above!</p>
              ) : (
                [...notes]
                  .sort((a, b) => {
                    // Pinned notes come first
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    // Within same pin status, sort by creation time descending (newest first)
                    return Number(b.id) - Number(a.id);
                  })
                  .map((note) => (
                    <div
                      key={note.id}
                      className={`note-item ${
                        resumingNoteId === note.id ? "resuming" : ""
                      } ${note.favorite ? "favorite" : ""} ${
                        note.pinned ? "pinned" : ""
                      }`}
                      onClick={() => handleOpenInNewWindow(note)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="note-header">
                        <div className="note-title">
                          {note.pinned && (
                            <Pin className="icon-inline pinned" size={14} />
                          )}
                          {note.favorite && (
                            <Star className="icon-inline favorited" size={14} />
                          )}
                          {note.title}
                        </div>
                        <div className="note-time">{note.time}</div>
                      </div>
                      <div className="note-preview">
                        {note.text.replace(/\n/g, ' ').substring(0, 100)}...
                      </div>
                      <div className="note-footer">
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
                              note.pinned ? "active" : ""
                            }`}
                            onClick={() => handlePin(note.id)}
                            title={note.pinned ? "Unpin note" : "Pin note"}
                          >
                            <Pin size={14} />
                          </button>
                          <button
                            className={`action-btn favorite-btn ${
                              note.favorite ? "active" : ""
                            }`}
                            onClick={() => handleFavorite(note.id)}
                            title={
                              note.favorite ? "Unfavorite note" : "Favorite note"
                            }
                          >
                            <Star size={14} />
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => handleDelete(note.id)}
                            title="Delete note"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            className={`action-btn resume-btn ${
                              resumingNoteId === note.id ? "cancel" : ""
                            }`}
                            onClick={() => handleResume(note)}
                            title={
                              resumingNoteId === note.id
                                ? "Cancel resume"
                                : "Resume this note"
                            }
                          >
                            {resumingNoteId === note.id ? (
                              <X size={14} />
                            ) : (
                              <Play size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

        <EditorToolbar
          onToggleNotes={handleToggleRecentNotes}
          onSubmit={handleSubmit}
          submitDisabled={!content.trim()}
        />
      </div>
    </div>
  );
}

export default App;
