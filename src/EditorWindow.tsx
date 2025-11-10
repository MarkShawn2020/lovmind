import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCurrentWebviewWindow, getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useAtom } from 'jotai';
import { notesAtom, Note } from './store';
import './App.css';
import RenderingWysiwygEditor from './components/RenderingWysiwygEditor';
import EditorToolbar from './components/EditorToolbar';

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined);
};

function EditorWindow() {
  const [notes, setNotes] = useAtom(notesAtom);
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split' | 'wysiwyg'>('wysiwyg');

  useEffect(() => {
    // 获取URL参数中的noteId
    const params = new URLSearchParams(window.location.search);
    const noteId = params.get('noteId');

    if (!noteId) {
      console.error('No noteId in URL parameters');
      return;
    }

    console.log('Editor window loading note with ID:', noteId);

    // 从存储中获取note数据
    const loadNote = async () => {
      try {
        let noteData: Note | null = null;

        if (isTauri()) {
          // Tauri 环境：从 Rust 后端获取
          noteData = await invoke<Note | null>('get_temp_note', { id: noteId });
          console.log('Retrieved note from Tauri backend:', noteData);
        } else {
          // 浏览器环境：从 Jotai atom 获取（自动从 localStorage 加载）
          noteData = notes.find(n => n.id === noteId) || null;
          console.log('Retrieved note from Jotai atom:', noteData);
        }

        if (noteData) {
          setNote(noteData);
          setContent(noteData.text);
        } else {
          console.error('No note found with ID:', noteId);
        }
      } catch (error) {
        console.error('Failed to load note:', error);
      }
    };

    loadNote();
  }, [notes]);

  const handleSave = async () => {
    if (note && content.trim()) {
      // 更新note
      const updatedNote: Note = {
        ...note,
        text: content,
        title: content.split('\n')[0].substring(0, 50) || 'Untitled Note',
        time: new Date().toLocaleString()
      };

      if (isTauri()) {
        // Tauri 环境：保存到 Rust 后端
        console.log('Storing updated note to Tauri backend:', updatedNote);
        try {
          await invoke('store_temp_note', { note: updatedNote });
          console.log('Successfully stored note to backend');
        } catch (error) {
          console.error('Failed to store note to backend:', error);
          return;
        }

        // 通过后端广播更新事件到所有窗口
        console.log('Broadcasting note update to all windows...');
        try {
          await invoke('broadcast_note_update', { note: updatedNote });
          console.log('Successfully broadcasted note update for:', updatedNote.id);
        } catch (error) {
          console.error('Failed to broadcast note update:', error);
          // 即使广播失败，本地更新仍应继续
        }

        // 更新窗口标题
        try {
          const currentWindow = getCurrentWebviewWindow();
          await currentWindow.setTitle(`Edit: ${updatedNote.title}`);
        } catch (error) {
          console.error('Failed to update window title:', error);
        }
      } else {
        // 浏览器环境：更新 Jotai atom（自动持久化到 localStorage）
        console.log('Browser: Updating note in Jotai atom:', updatedNote);
        setNotes((prevNotes) =>
          prevNotes.map(n => n.id === updatedNote.id ? updatedNote : n)
        );

        // 使用 BroadcastChannel 通知其他窗口
        try {
          const channel = new BroadcastChannel('lovpen-notes-channel');
          channel.postMessage({ type: 'note-updated', note: updatedNote });
          channel.close();
        } catch (error) {
          console.error('Failed to broadcast via BroadcastChannel:', error);
        }

        // 更新页面标题
        document.title = `Edit: ${updatedNote.title}`;
      }

      // 更新本地状态
      setNote(updatedNote);

      // 显示保存成功的视觉反馈
      const button = document.querySelector('.submit-btn') as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Saved ✓';
        setTimeout(() => {
          button.textContent = originalText;
        }, 1000);
      }
    }
  };

  const handleClose = async () => {
    if (isTauri()) {
      const currentWindow = getCurrentWebviewWindow();
      await currentWindow.close();
    } else {
      window.close();
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

  const handleToggleNotes = async () => {
    // 点击最近笔记按钮：关闭当前编辑窗口并返回主窗口
    if (isTauri()) {
      try {
        // 先保存当前内容
        if (content.trim() && note) {
          await handleSave();
        }

        // 查找主窗口并聚焦
        const allWindows = await getAllWebviewWindows();
        const mainWindow = allWindows.find(w => w.label === 'main');
        if (mainWindow) {
          await mainWindow.setFocus();
          // 等待主窗口获得焦点后再关闭当前窗口
          setTimeout(() => {
            const currentWindow = getCurrentWebviewWindow();
            currentWindow.close();
          }, 100);
        } else {
          // 如果找不到主窗口，直接关闭
          const currentWindow = getCurrentWebviewWindow();
          await currentWindow.close();
        }
      } catch (error) {
        console.error("Failed to toggle to main window:", error);
      }
    } else {
      // 浏览器环境：关闭当前窗口
      window.close();
    }
  };

  if (!note) {
    return (
      <div className="app-container">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading note...
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="editor-section">
        {viewMode === 'wysiwyg' ? (
          <div className="editor-area">
            <RenderingWysiwygEditor
              initialContent={content}
              onChange={setContent}
              onSubmit={handleSave}
              placeholder="Start writing your note..."
            />
          </div>
        ) : (
          <div className={`editor-container view-${viewMode}`}>
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className="editor-pane">
                <textarea
                  className="note-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Edit your note in Markdown..."
                  onKeyDown={(e) => {
                    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSave();
                    }
                    if (e.key === 'w' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleClose();
                    }
                  }}
                  autoFocus
                />
              </div>
            )}
            
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="preview-pane">
                <div className="markdown-preview">
                  {content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  ) : (
                    <p className="preview-empty">Preview will appear here...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <EditorToolbar
          onToggleNotes={handleToggleNotes}
          onSubmit={handleSave}
          submitDisabled={!content.trim()}
        />
      </div>
    </div>
  );
}

export default EditorWindow;