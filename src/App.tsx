import { useEffect, useState, useCallback, useMemo } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Archive, Sparkles, Mail, LogOut, UserCircle, Info, Settings, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import "./App.css";
import { isTauri } from "./utils/tauri";
import { notesAtom, Note, imageMaxHeightAtom } from "./store";
import { NotesSidebar } from "./components/NotesSidebar";
import RenderingWysiwygEditor from "./components/RenderingWysiwygEditor";
import EditorToolbar from "./components/EditorToolbar";
import ProfileModal from "./components/ProfileModal";
import { EditorLayout } from "./components/note-editor/EditorLayout";
import { MainHeader } from "./components/note-editor/MainHeader";
import { useNoteEditorController } from "./hooks/useNoteEditorController";
import lovpenLogo from "./assets/lovpen-logo.svg";
import packageJson from "../package.json";

function App() {
  const [, setNotes] = useAtom(notesAtom);
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const setImageMaxHeight = useSetAtom(imageMaxHeightAtom);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

    // 监听图片最大高度变化事件
    console.log("Setting up image max height listener...");
    const unlistenImageHeight = listen<{ value: number }>(
      "image-max-height-changed",
      (event) => {
        const newHeight = event.payload.value;
        console.log("[App] Received image-max-height-changed:", newHeight);
        setImageMaxHeight(newHeight);
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
      unlistenImageHeight.then((fn) => fn());
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setNotes, setImageMaxHeight]);

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

  // 启动时同步 Tauri 后端存储的notes
  useEffect(() => {
    if (!isTauri()) return;

    const syncWithBackend = async () => {
      try {
        const backendNotes = await invoke<Note[]>("get_all_temp_notes");
        if (backendNotes.length > 0) {
          setNotes((prevNotes) => {
            const noteMap = new Map(prevNotes.map((n) => [n.id, n]));
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
  }, [setNotes]);

  const handleViewingModeChange = useCallback((noteId: string | null) => {
    setViewingNoteId(noteId);
  }, []);

  const openNoteInCurrentWindow = useCallback((note: Note) => {
    setViewingNoteId(note.id);
  }, []);

  const {
    notes,
    noteStats,
    userProfile,
    showArchived,
    setShowArchived,
    isUserMenuOpen,
    setIsUserMenuOpen,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isAboutModalOpen,
    setIsAboutModalOpen,
    menuPosition,
    handleUserMenuToggle,
    handleHeaderMouseDown,
    handleContentChange,
    handleSubmit,
    handleDuplicateNote,
    editorRef,
    notesListRef,
    editorContainerRef,
    userMenuRef,
    userButtonRef,
    openNoteInNewWindow,
    toggleArchive,
    deleteNote,
    togglePin,
    placeholder,
    content,
    richContent,
    currentTags,
    submitDisabled,
    handleBackToCreate,
    createNewNoteWindow,
    viewingNoteId: controllerViewingNoteId,
  } = useNoteEditorController({
    mode: "main",
    placeholder: "此时此刻，你在想什么呢？",
    viewingNoteId,
    onViewingModeChange: handleViewingModeChange,
  });

  // Wrap callbacks to close mobile sidebar after note operations
  const handleOpenNoteInCurrentWindow = useCallback((note: Note) => {
    openNoteInCurrentWindow(note);
    // Close mobile sidebar drawer on note selection
    setIsMobileSidebarOpen(false);
  }, [openNoteInCurrentWindow]);

  const handleOpenNoteInNewWindow = useCallback((note: Note) => {
    openNoteInNewWindow(note);
    // Close mobile sidebar drawer on note selection
    setIsMobileSidebarOpen(false);
  }, [openNoteInNewWindow]);

  const sidebarNode = useMemo(() => (
    <div ref={notesListRef}>
      <NotesSidebar
        notes={notes}
        currentNoteId={viewingNoteId ?? undefined}
        showArchived={showArchived}
        onOpenNote={handleOpenNoteInCurrentWindow}
        onOpenNoteInNewWindow={handleOpenNoteInNewWindow}
        onTogglePin={togglePin}
        onToggleArchive={toggleArchive}
        onDeleteNote={deleteNote}
        onDuplicateNote={handleDuplicateNote}
        onCreateNewNote={viewingNoteId ? handleBackToCreate : undefined}
      />
    </div>
  ), [notes, viewingNoteId, showArchived, handleOpenNoteInCurrentWindow, handleOpenNoteInNewWindow, togglePin, toggleArchive, deleteNote, handleDuplicateNote, handleBackToCreate]);

  const editorNode = (
    <div ref={editorContainerRef}>
      <RenderingWysiwygEditor
        key={viewingNoteId || 'create-mode'}
        ref={editorRef}
        initialContent={content}
        initialRichContent={richContent}
        onChange={handleContentChange}
        onSubmit={handleSubmit}
        placeholder={placeholder}
      />
    </div>
  );

  const userMenuNode = !isUserMenuOpen ? null : (
    <div
      ref={userMenuRef}
      className="fixed w-48 bg-white rounded-lg shadow-2xl border border-gray-200 py-1"
      style={{
        top: `${menuPosition.top}px`,
        right: `${menuPosition.right}px`,
        zIndex: 99999,
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
        onClick={async () => {
          setIsUserMenuOpen(false);
          if (isTauri()) {
            try {
              await invoke("open_settings_window");
            } catch (error) {
              console.error("Failed to open settings window:", error);
            }
          }
        }}
      >
        <Settings size={16} />
        Settings
      </button>

      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={() => {
          setIsUserMenuOpen(false);
          setShowArchived(!showArchived);
        }}
      >
        <Archive size={16} />
        {showArchived ? "Active Notes" : "Archive"}
      </button>

      <div className="border-t border-gray-200 my-1" />

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

      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={async () => {
          setIsUserMenuOpen(false);
          if (isTauri()) {
            try {
              const { openUrl } = await import("@tauri-apps/plugin-opener");
              await openUrl("mailto:shawninjuly@gmail.com");
            } catch (error) {
              console.error("Failed to open email client:", error);
            }
          } else {
            window.open("mailto:shawninjuly@gmail.com", "_blank");
          }
        }}
      >
        <Mail size={16} />
        Contact
      </button>

      <div className="border-t border-gray-200 my-1" />
      <button
        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items中心 gap-2 border-none bg-transparent cursor-pointer transition-colors"
        onClick={async () => {
          setIsUserMenuOpen(false);
          if (isTauri()) {
            try {
              await invoke("quit_app");
            } catch (error) {
              console.error("Failed to exit:", error);
            }
          }
        }}
      >
        <LogOut size={16} />
        Quit
      </button>
    </div>
  );

  const profileModalNode = <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />;

  const aboutModalNode = !isAboutModalOpen ? null : (
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

          <p className="text-gray-600 mb-6">随时随地，捕捉灵感。闪电般快速的浮动笔记应用。</p>

          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">主要特性</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>⌘N 全局快捷键</strong> - 任何时候瞬间唤起
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>浮动窗口</strong> - 置顶显示，快速记录
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>富文本编辑</strong> - 所见即所得，支持 Markdown 快捷输入
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>多窗口编辑</strong> - 每条笔记独立窗口
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>
                  <strong>数据本地存储</strong> - 当前为特发版，跨端云同步版本即将推出
                </span>
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
  );

  return (
    <EditorLayout
      header={
        <MainHeader
          noteStats={noteStats}
          userProfile={userProfile}
          onHeaderMouseDown={handleHeaderMouseDown}
          onUserMenuToggle={handleUserMenuToggle}
          userButtonRef={userButtonRef}
        />
      }
      sidebar={sidebarNode}
      editor={editorNode}
      toolbar={
        <EditorToolbar
          mode="main"
          onSubmit={handleSubmit}
          submitDisabled={submitDisabled}
          currentTags={currentTags}
          allNotes={notes}
          editorRef={editorRef}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          hideSubmitButton={true}
        />
      }
      userMenu={userMenuNode}
      profileModal={profileModalNode}
      aboutModal={aboutModalNode}
      isMobileSidebarOpen={isMobileSidebarOpen}
      onMobileSidebarChange={setIsMobileSidebarOpen}
    />
  );
}

export default App;
