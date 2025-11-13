import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "./utils/tauri";
import { useEffect } from "react";
import "./App.css";
import NoteEditor from "./components/NoteEditor";
import { useAtom } from "jotai";
import { notesAtom, Note } from "./store";

function App() {
  const [, setNotes] = useAtom(notesAtom);

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

        setNotes((prevNotes) => {
          const existingNoteIndex = prevNotes.findIndex(
            (n) => n.id === updatedNote.id
          );

          if (existingNoteIndex !== -1) {
            const newNotes = [...prevNotes];
            newNotes[existingNoteIndex] = updatedNote;
            return newNotes;
          } else {
            return [...prevNotes, updatedNote];
          }
        });
      }
    );

    // 添加键盘快捷键监听（开发者工具）
    const handleKeyDown = async (e: KeyboardEvent) => {
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
  }, [setNotes]);

  // 在浏览器环境下，监听 BroadcastChannel 的笔记更新
  useEffect(() => {
    if (isTauri()) return;

    const channel = new BroadcastChannel('lovpen-notes-channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'note-updated') {
        const updatedNote = event.data.note as Note;
        setNotes((prevNotes) => {
          const existingNoteIndex = prevNotes.findIndex((n) => n.id === updatedNote.id);
          if (existingNoteIndex !== -1) {
            const newNotes = [...prevNotes];
            newNotes[existingNoteIndex] = updatedNote;
            return newNotes;
          } else {
            return [...prevNotes, updatedNote];
          }
        });
      }
    };

    return () => channel.close();
  }, [setNotes]);

  // Load all notes from backend on startup - SIMPLIFIED
  useEffect(() => {
    if (!isTauri()) return;

    const loadAllNotes = async () => {
      try {
        const backendNotes = await invoke<Note[]>("get_all_temp_notes");
        console.log('[App] Loaded notes from backend:', backendNotes.length);
        setNotes(backendNotes);
      } catch (error) {
        console.error("Failed to load notes from backend:", error);
      }
    };

    loadAllNotes();
  }, [setNotes]);

  return <NoteEditor mode="main" placeholder="此时此刻，你在想什么呢？" />;
}

export default App;
