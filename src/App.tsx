import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { isTauri } from "./utils/tauri";
import { useNoteOperations } from "./hooks/useNoteOperations";
import { useWindowOperations } from "./hooks/useWindowOperations";
import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import lovpenLogo from "./assets/lovpen-logo.svg";
import NoteEditor from "./components/NoteEditor";
import packageJson from "../package.json";
import { useAtom, useAtomValue } from "jotai";
import { contentAtom, noteStatsAtom, Note } from "./store";
import { RenderingWysiwygEditorRef } from "./components/RenderingWysiwygEditor";

function App() {
  const [content, setContent] = useAtom(contentAtom);
  const { notes, setNotes } = useNoteOperations();
  const { handleHeaderMouseDown, openNoteInNewWindow } = useWindowOperations(notes, setNotes);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [richContent, setRichContent] = useState<any>(null);
  const notesListRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RenderingWysiwygEditorRef | null>(null);
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

  // 在浏览器环境下，监听 BroadcastChannel 的笔记更新
  useEffect(() => {
    if (isTauri()) {
      // Tauri 环境下使用上面的事件监听器
      return;
    }

    // 浏览器环境下使用 BroadcastChannel
    const channel = new BroadcastChannel('lovpen-notes-channel');

    channel.onmessage = (event) => {
      if (event.data.type === 'note-updated') {
        const updatedNote = event.data.note as Note;
        console.log('Browser: received note update via BroadcastChannel:', updatedNote);

        setNotes((prevNotes) => {
          const existingNoteIndex = prevNotes.findIndex((n) => n.id === updatedNote.id);

          if (existingNoteIndex !== -1) {
            // 更新已存在的note
            const newNotes = [...prevNotes];
            newNotes[existingNoteIndex] = updatedNote;
            return newNotes;
          } else {
            // 如果note不存在，添加到列表
            return [...prevNotes, updatedNote];
          }
        });
      }
    };

    return () => {
      channel.close();
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

  // 启动时同步 Tauri 后端存储的notes
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
    // Allow saving if either has text content or has rich content (e.g., images)
    if ((content && typeof content === 'string' && content.trim()) || richContent) {
      // 生成标题和标签
      const firstLine = content ? content.split("\n")[0].substring(0, 50) : "Image Note";
      const title = firstLine || "Untitled Note";
      // Use tags extracted from the editor, fallback to empty array
      const tags = currentTags.length > 0 ? currentTags : [];

      const newNote: Note = {
        id: Date.now().toString(),
        text: content || "",
        title,
        time: new Date().toLocaleString(),
        tags,
        richContent: richContent, // Save rich content for images
      };

      console.log('[App] 创建新 note:', {
        id: newNote.id,
        textLength: newNote.text.length,
        hasRichContent: !!newNote.richContent,
      });

      setNotes([...notes, newNote]);

      // Reset editor and focus - unified handling for both button and keyboard submit
      setContent("");
      setRichContent(null);
      editorRef.current?.resetAndFocus();

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
        setNotes((prev) => [...prev.slice(0, -1), newNote]);
        // 更新后端存储的note
        await invoke("store_temp_note", { note: newNote });
      } catch (error) {
        console.log("Using local title generation");
      }
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


      <NoteEditor
        content={content}
        // Don't pass richContent as initialRichContent for main window (it causes infinite loop)
        // richContent is only for loading existing notes in EditorWindow
        onContentChange={(newContent, tags, newRichContent) => {
          console.log('[App] NoteEditor onContentChange:', {
            newContentLength: newContent?.length,
            hasNewRichContent: newRichContent !== undefined,
          });
          setContent(newContent);
          if (tags) setCurrentTags(tags);
          if (newRichContent !== undefined) {
            setRichContent(newRichContent);
          }
        }}
        onSubmit={handleSubmit}
        placeholder="此时此刻，你在想什么呢？"
        isPanelExpanded={isExpandedRef.current}
        onTogglePanel={handleToggleRecentNotes}
        panelRef={panelRef}
        notesListRef={notesListRef}
        editorRef={editorRef}
        onNoteClick={openNoteInNewWindow}
      />
    </div>
  );
}

export default App;
