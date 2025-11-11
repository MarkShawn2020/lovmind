import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { Note } from './store';
import './App.css';
import NoteEditor from './components/NoteEditor';
import { isTauri } from './utils/tauri';
import { useNoteOperations } from './hooks/useNoteOperations';
import { useWindowOperations } from './hooks/useWindowOperations';

function EditorWindow() {
  const { notes, setNotes, updateNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, setNotes);
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [richContent, setRichContent] = useState<any>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const notesListRef = useRef<HTMLDivElement | null>(null);

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
          console.log('[EditorWindow] 原始 note 数据:', noteData);
          setNote(noteData);
          setContent(noteData.text);
          setRichContent(noteData.richContent || null);
          console.log('[EditorWindow] 加载 note 数据:', {
            id: noteData.id,
            text: noteData.text,
            hasRichContent: !!noteData.richContent,
            richContentType: typeof noteData.richContent,
            richContentPreview: noteData.richContent ? JSON.stringify(noteData.richContent).substring(0, 500) : null,
            richContentFull: noteData.richContent,
          });
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
    console.log('[EditorWindow] handleSave called:', {
      hasNote: !!note,
      contentLength: content?.length,
      hasRichContent: !!richContent,
    });

    // Allow saving if either has text content or has rich content (e.g., images)
    if (note && ((content && typeof content === 'string' && content.trim()) || richContent)) {
      // Create updated note
      const updatedNote: Note = {
        ...note,
        text: content,
        title: content.split('\n')[0].substring(0, 50) || 'Untitled Note',
        time: new Date().toLocaleString(),
        tags: currentTags.length > 0 ? currentTags : note.tags,
        richContent: richContent,
      };

      try {
        // Use the hook to update the note
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

        // Update local state
        setNote(updatedNote);

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
  };

  const handleClose = async () => {
    if (isTauri()) {
      const currentWindow = getCurrentWebviewWindow();
      await currentWindow.close();
    } else {
      window.close();
    }
  };

  // Debug function to check current state
  const debugState = () => {
    console.log('=== DEBUG STATE ===');
    console.log('note:', note);
    console.log('content:', content);
    console.log('richContent:', richContent);
    console.log('currentTags:', currentTags);
    console.log('==================');
  };

  // Add keyboard shortcut for debug: Cmd+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        debugState();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [note, content, richContent, currentTags]);

  const handleToggleNotes = useCallback(() => {
    setIsPanelExpanded(prev => !prev);
  }, []);

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
      <NoteEditor
        content={content}
        richContent={note.richContent}
        onContentChange={(newContent, tags, newRichContent) => {
          console.log('[EditorWindow] onContentChange 被调用:', {
            newContentLength: newContent?.length,
            newContentPreview: newContent?.substring(0, 100),
            tags,
            hasNewRichContent: newRichContent !== undefined,
            newRichContentPreview: newRichContent ? JSON.stringify(newRichContent).substring(0, 200) : null,
          });
          setContent(newContent);
          if (tags) setCurrentTags(tags);
          // Always update richContent when provided (even if undefined/null)
          if (newRichContent !== undefined) {
            setRichContent(newRichContent);
          }
        }}
        onSubmit={handleSave}
        placeholder="此时此刻，你在想什么呢？"
        isPanelExpanded={isPanelExpanded}
        onTogglePanel={handleToggleNotes}
        panelRef={panelRef}
        notesListRef={notesListRef}
        onNoteClick={openNoteInNewWindow}
      />
    </div>
  );
}

export default EditorWindow;