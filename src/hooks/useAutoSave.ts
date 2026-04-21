import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { editorContentAtom, currentNoteAtom, currentNoteIdAtom, notesAtom } from '@/atoms/noteAtoms';
import { useNoteOperations } from './useNoteOperations';
import { extractNoteTitle } from '@/utils/titleExtractor';
import { isTauri } from '@/utils/tauri';
import { draftContentAtom, setStoreValue, type Note } from '@/store';

interface UseAutoSaveOptions {
  onNoteAutoCreated?: (noteId: string) => void;
}

/**
 * Auto-Save Hook
 *
 * Automatically saves editor content. Handles both:
 * - Existing notes: updates on typing-stop (debounced)
 * - New notes: auto-creates when content is typed in create mode
 */
export function useAutoSave(options: UseAutoSaveOptions = {}) {
  const { onNoteAutoCreated } = options;

  const editorContent = useAtomValue(editorContentAtom);
  const currentNote = useAtomValue(currentNoteAtom);
  const currentNoteId = useAtomValue(currentNoteIdAtom);
  const [notes, setNotes] = useAtom(notesAtom);
  const { updateNote } = useNoteOperations();
  const setDraft = useSetAtom(draftContentAtom);

  const lastSavedContentRef = useRef<string>('');
  const pendingSaveRef = useRef<{
    note: Note;
    contentHash: string;
  } | null>(null);
  const prevNoteIdRef = useRef<string | null>(null);
  const onNoteAutoCreatedRef = useRef(onNoteAutoCreated);
  onNoteAutoCreatedRef.current = onNoteAutoCreated;

  // Ref for updateNote to avoid stale closure in unmount-save
  const updateNoteRef = useRef(updateNote);
  updateNoteRef.current = updateNote;

  // Save pending changes when note ID changes (actual note switch)
  useEffect(() => {
    const noteId = currentNote?.id ?? null;
    const prevNoteId = prevNoteIdRef.current;

    if (prevNoteId !== null && prevNoteId !== noteId && pendingSaveRef.current) {
      const { note, contentHash } = pendingSaveRef.current;
      console.log('💾 Saving on note switch:', note.id, '→', noteId);
      updateNote(note).catch((error) => {
        console.error('Failed to save on note switch:', error);
      });
      lastSavedContentRef.current = contentHash;
      pendingSaveRef.current = null;
    }

    prevNoteIdRef.current = noteId;
  }, [currentNote?.id, updateNote]);

  // Unmount save: flush pending changes when component unmounts
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        const { note } = pendingSaveRef.current;
        console.log('💾 Saving on unmount:', note.id);
        updateNoteRef.current(note).catch((error) => {
          console.error('Failed to save on unmount:', error);
        });
        pendingSaveRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Main effect: Debounced auto-save on content changes
  useEffect(() => {
    const contentHash = JSON.stringify({
      text: editorContent.text,
      tags: editorContent.tags,
      richContent: editorContent.richContent,
    });

    if (contentHash === lastSavedContentRef.current) return;

    const hasTypedContent = typeof editorContent.text === 'string' && Boolean(editorContent.text.trim());

    // === Auto-create: no existing note but we have a noteId and content ===
    // Only auto-create when there's actual content (don't create empty notes)
    if (!currentNote && currentNoteId && hasTypedContent) {
      // Check if note already exists in notes array (might not be in currentNote yet)
      const existingInArray = notes.find(n => n.id === currentNoteId);
      if (!existingInArray) {
        const now = new Date().toISOString();
        const maxRank = notes.reduce((max, note) => Math.max(max, note.rank || 0), 0);
        const newRank = Math.max(maxRank + 1, notes.length + 1);

        const newNote: Note = {
          id: currentNoteId,
          text: editorContent.text,
          title: extractNoteTitle({ text: editorContent.text, richContent: editorContent.richContent }),
          time: new Date().toLocaleString(),
          tags: editorContent.tags,
          richContent: editorContent.richContent,
          pinned: false,
          archived: false,
          favorite: false,
          rank: newRank,
          isDraft: false,
          createdAt: now,
          updatedAt: now,
        };

        // Auto-create fires immediately (no debounce)
        setNotes((prev) => [newNote, ...prev]);
        lastSavedContentRef.current = contentHash;

        // Clear draft: note is now real, no stale draft should linger
        setDraft(null);

        // Notify parent so viewingNoteId transitions seamlessly
        onNoteAutoCreatedRef.current?.(newNote.id);

        // Persist to backend async
        (async () => {
          try {
            if (isTauri()) {
              await invoke('store_temp_note', { note: newNote });
              await invoke('broadcast_note_update', { note: newNote });
              await setStoreValue('lovpen-draft', null);
            }
            console.log('✨ Auto-created note:', newNote.id);
          } catch (error) {
            console.error('Failed to persist auto-created note:', error);
          }
        })();

        return;
      }
    }

    // === Auto-save existing note ===
    if (!currentNote) return;

    // Don't save if content matches the current note (no changes)
    const noteContentHash = JSON.stringify({
      text: currentNote.text,
      tags: currentNote.tags,
      richContent: currentNote.richContent,
    });

    if (contentHash === noteContentHash) {
      lastSavedContentRef.current = contentHash;
      return;
    }

    // Build pending save
    const now = new Date().toISOString();
    const updatedNote: Note = {
      ...currentNote,
      text: editorContent.text,
      tags: editorContent.tags,
      richContent: editorContent.richContent,
      title: currentNote.manualTitle
        ? currentNote.title
        : extractNoteTitle({ text: editorContent.text, richContent: editorContent.richContent }),
      time: new Date().toLocaleString(),
      isDraft: false,
      createdAt: currentNote.createdAt || now,
      updatedAt: now,
    };
    pendingSaveRef.current = { note: updatedNote, contentHash };

    const timer = setTimeout(async () => {
      if (!pendingSaveRef.current) return;

      const { note: savedNote, contentHash: hash } = pendingSaveRef.current;

      try {
        await updateNote(savedNote);
        console.log('🔄 Auto-saved:', savedNote.id);
        lastSavedContentRef.current = hash;
        pendingSaveRef.current = null;

        // Update window title if in Tauri
        if (isTauri()) {
          try {
            const currentWindow = getCurrentWebviewWindow();
            await currentWindow.setTitle(`Edit: ${savedNote.title}`);
          } catch (error) {
            console.error('Failed to update window title:', error);
          }
        }
      } catch (error) {
        console.error('Failed to auto-save:', error);
      }
    }, 1000);

    return () => { clearTimeout(timer); };
  }, [editorContent, currentNote, currentNoteId, notes, setNotes, updateNote]);

  // Save immediately on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!pendingSaveRef.current) return;

      const { note: updatedNote, contentHash } = pendingSaveRef.current;

      try {
        const pendingKey = `lovpen-pending-save-${updatedNote.id}`;
        localStorage.setItem(pendingKey, JSON.stringify(updatedNote));
        console.log('💾 Saved pending note to localStorage before unload:', updatedNote.id);
      } catch (e) {
        console.error('Failed to save pending note before unload:', e);
      }

      lastSavedContentRef.current = contentHash;
      pendingSaveRef.current = null;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => { window.removeEventListener('beforeunload', handleBeforeUnload); };
  }, []);
}
