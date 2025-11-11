import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./utils/tauri";
import { useEffect, useRef } from "react";
import "./App.css";
import lovpenLogo from "./assets/lovpen-logo.svg";
import NoteEditor from "./components/NoteEditor";
import packageJson from "../package.json";
import { useAtomValue, useAtom } from "jotai";
import { noteStatsAtom, notesAtom, Note } from "./store";
import { RenderingWysiwygEditorRef } from "./components/RenderingWysiwygEditor";

function App() {
  const [notes, setNotes] = useAtom(notesAtom);
  const editorRef = useRef<RenderingWysiwygEditorRef | null>(null);

  // Get note statistics from derived atom
  const noteStats = useAtomValue(noteStatsAtom);

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

  return (
    <div className="app-container">
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
          <h1>Lovpen Notes</h1>
          <span className="version-badge text-[0.7em] px-1.5 py-0.5 ml-1 bg-white/10 rounded font-normal opacity-70 self-center">
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
        mode="create"
        placeholder="此时此刻，你在想什么呢？"
        editorRef={editorRef}
      />
    </div>
  );
}

export default App;
