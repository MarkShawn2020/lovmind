import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';
import { useAtomValue } from 'jotai';

import type { Note } from '@/store';
import { noteStatsAtom } from '@/store';
import type { RenderingWysiwygEditorRef, EditorContentChange } from '@/components/RenderingWysiwygEditor';
import { isEditorContentEmpty } from '@/components/RenderingWysiwygEditor';
import { isTauri } from '@/utils/tauri';
import { useNoteOperations } from '@/hooks/useNoteOperations';
import { useWindowOperations } from '@/hooks/useWindowOperations';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { NoteStatsSummary } from '@/features/note/types';

interface UseNoteEditorControllerOptions {
  mode: 'main' | 'float';
  noteId?: string;
  showConfetti?: boolean;
  placeholder?: string;
  currentNoteId?: string | null;
  editorRef?: React.RefObject<RenderingWysiwygEditorRef | null>;
}

export const useNoteEditorController = ({
  mode,
  noteId,
  showConfetti = mode === 'main',
  placeholder = "此时此刻，你在想什么呢？",
  currentNoteId,
  editorRef: externalEditorRef,
}: UseNoteEditorControllerOptions) => {
  const { notes, setNotes, deleteNote, togglePin, toggleArchive, updateNote } = useNoteOperations();
  const { openNoteInNewWindow } = useWindowOperations(notes, setNotes);
  const noteStats = useAtomValue(noteStatsAtom) as NoteStatsSummary;
  const { userProfile, reloadProfile } = useUserProfile();

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

  const notesListRef = useRef<HTMLDivElement | null>(null);
  const internalEditorRef = useRef<RenderingWysiwygEditorRef | null>(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleUserMenuToggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (userButtonRef.current) {
      const rect = userButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsUserMenuOpen((prev) => !prev);
  }, []);

  const handleFloatWindowClose = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTauri()) {
      const currentWindow = getCurrentWebviewWindow();
      await currentWindow.close();
    }
  }, []);

  const handleTitleChange = useCallback((value: string) => {
    setEditingTitle(value);
  }, []);

  const handleStartEditingTitle = useCallback((title: string) => {
    setEditingTitle(title);
    setIsEditingTitle(true);
  }, []);

  const handleCancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  useEffect(() => {
    if (!isProfileModalOpen) {
      reloadProfile();
    }
  }, [isProfileModalOpen, reloadProfile]);

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

  const handleHeaderMouseDown = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      console.error("Failed to start dragging:", error);
    }
  }, []);

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
            console.log('[useNoteEditorController] Note data received:', {
              id: noteData.id,
              hasText: Boolean(noteData.text),
              textPreview: noteData.text?.substring(0, 100),
              hasRichContent: Boolean(noteData.richContent),
              richContentPreview: noteData.richContent ? JSON.stringify(noteData.richContent).substring(0, 200) : null,
            });

            setCurrentNote(noteData);
            setContent(noteData.text);
            setRichContent(noteData.richContent || null);
            setCurrentTags(noteData.tags || []);
            const hasText = Boolean(noteData.text?.trim());
            setIsEditorEmpty(!hasText && isEditorContentEmpty(noteData.richContent));
          } else {
            const urlParams = new URLSearchParams(window.location.search);
            const rankParam = urlParams.get('rank');
            const rank = rankParam ? parseInt(rankParam, 10) : undefined;

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

  const handleContentChange = useCallback((payload: EditorContentChange) => {
    console.log("handleContentChange: ", payload);
    console.log(`  📝 Input State: ${payload.isInputting ? '✍️  INPUTTING' : '⏸️  STOPPED'} (${payload.inputStateReason})`);
    console.log(`  🎯 Focus State: ${payload.isFocused ? '👀 FOCUSED' : '👁️  BLURRED'}`);

    setContent(payload.text);
    setCurrentTags(payload.tags);
    setRichContent(payload.richContent);
    setIsEditorEmpty(payload.isEmpty);

    // Input state is now available for conditional logic:
    // - payload.isInputting: true when user is actively typing, false when stopped
    // - payload.inputStateReason: why the input state changed
    // - payload.isFocused: whether editor has focus
    //
    // Example use cases:
    // 1. Auto-save only when typing stops:
    //    if (!payload.isInputting && payload.inputStateReason === 'typing-stop') { autoSave() }
    // 2. Show toolbar when focused but not typing:
    //    if (payload.isFocused && !payload.isInputting) { showToolbar() }
    // 3. Track active engagement:
    //    if (payload.isInputting) { trackEngagement() }
  }, []);

  const handleSubmit = useCallback(async () => {
    const hasTypedContent = typeof content === 'string' && Boolean(content.trim());
    if (!hasTypedContent && isEditorEmpty) {
      return;
    }

    if (mode === 'main') {
      const firstLine = content ? content.split("\n")[0].substring(0, 50) : "Image Note";
      const title = firstLine || "Untitled Note";
      const tags = currentTags.length > 0 ? currentTags : [];

      const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
      const newRank = Math.max(maxRank + 1, notes.length + 1);

      const newNote: Note = {
        id: Date.now().toString(),
        text: content || "",
        title,
        time: new Date().toLocaleString(),
        tags,
        richContent: richContent,
        rank: newRank,
      };

      setNotes([...notes, newNote]);
      setContent("");
      setRichContent(null);
      setCurrentTags([]);
      setIsEditorEmpty(true);
      editorRef.current?.resetAndFocus();

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

      await invoke("store_temp_note", { note: newNote });

      try {
        const [generatedTitle, generatedTags] = await invoke<[string, string[]]>(
          "generate_title_and_tags",
          { content }
        );
        newNote.title = generatedTitle;
        newNote.tags = generatedTags;
        setNotes((prev) => [...prev.slice(0, -1), newNote]);
        await invoke("store_temp_note", { note: newNote });
      } catch (error) {
        console.log("Using local title generation");
      }
    } else if (mode === 'float' && currentNote) {
      const updatedNote: Note = {
        ...currentNote,
        text: content,
        title: content.split('\n')[0].substring(0, 50) || 'Untitled Note',
        time: new Date().toLocaleString(),
        tags: currentTags.length > 0 ? currentTags : currentNote.tags,
        richContent: richContent,
      };

      try {
        await updateNote(updatedNote);

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

      } catch (error) {
        console.error('Failed to save note:', error);
      }
    }
  }, [content, currentTags, currentNote, editorRef, isEditorEmpty, mode, notes, richContent, showConfetti, updateNote]);

  const handleTogglePin = useCallback(async () => {
    if (mode === 'float' && currentNote) {
      await togglePin(currentNote.id);
      setCurrentNote({
        ...currentNote,
        pinned: !currentNote.pinned,
      });
    }
  }, [mode, currentNote, togglePin]);

  const handleToggleAlwaysOnTop = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (mode === 'float' && isTauri()) {
      try {
        const currentWindow = getCurrentWindow();
        const newState = !isWindowAlwaysOnTop;
        await currentWindow.setAlwaysOnTop(newState);
        setIsWindowAlwaysOnTop(newState);
      } catch (error) {
        console.error('Failed to toggle always on top:', error);
      }
    }
  }, [mode, isWindowAlwaysOnTop]);

  const handleDuplicateNote = useCallback(async (note: Note) => {
    try {
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

      setNotes([...notes, duplicatedNote]);

      if (isTauri()) {
        await invoke("store_temp_note", { note: duplicatedNote });
      }
    } catch (error) {
      console.error('Failed to duplicate note:', error);
    }
  }, [notes, setNotes]);

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

  const submitDisabled = (!content || typeof content !== 'string' || !content.trim()) && isEditorEmpty;

  return {
    mode,
    noteId,
    placeholder,
    currentNoteId,
    notes,
    noteStats,
    userProfile,
    content,
    richContent,
    currentTags,
    currentNote,
    showArchived,
    setShowArchived,
    isUserMenuOpen,
    setIsUserMenuOpen,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isAboutModalOpen,
    setIsAboutModalOpen,
    menuPosition,
    setMenuPosition,
    isEditingTitle,
    setIsEditingTitle,
    editingTitle,
    setEditingTitle,
    isEditorEmpty,
    isWindowAlwaysOnTop,
    notesListRef,
    editorRef,
    editorContainerRef,
    userMenuRef,
    userButtonRef,
    openNoteInNewWindow,
    deleteNote,
    togglePin,
    toggleArchive,
    handleUserMenuToggle,
    handleHeaderMouseDown,
    handleContentChange,
    handleSubmit,
    handleTogglePin,
    handleToggleAlwaysOnTop,
    handleDuplicateNote,
    handleSaveTitle,
    handleTitleChange,
    handleStartEditingTitle,
    handleCancelEditingTitle,
    handleFloatWindowClose,
    submitDisabled,
  };
};
