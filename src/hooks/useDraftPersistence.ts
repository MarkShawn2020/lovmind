import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { editorContentAtom, notesAtom } from '@/atoms/noteAtoms';
import { draftContentAtom, setStoreValue, type DraftContent } from '@/store';
import { isTauri } from '@/utils/tauri';

// Track savedAt timestamps we emitted to skip our own events
export const emittedSavedAtSet = new Set<string>();

/**
 * Draft Persistence Hook
 *
 * Automatically saves unsaved content to draft when:
 * 1. In create mode (sourceNoteId === null), OR
 * 2. Editing a note that doesn't exist in backend yet (new float window)
 *
 * Also broadcasts draft updates to sync across windows.
 */
export function useDraftPersistence() {
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);
  const setDraft = useSetAtom(draftContentAtom);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteExistsCache = useRef<Map<string, boolean>>(new Map());

  // Track last emitted savedAt to prevent re-emitting synced content
  const lastEmittedSavedAtRef = useRef<string | null>(null);

  useEffect(() => {
    // Don't save empty content
    const hasContent = editorContent.text?.trim() || !editorContent.isEmpty;
    if (!hasContent) {
      return;
    }

    // Skip if this content was just synced from another window
    // This prevents the emit loop: receive sync -> setValue -> onChange -> emit again
    const syncedAt = (editorContent as any)._syncedAt;
    if (syncedAt && syncedAt === lastEmittedSavedAtRef.current) {
      return;
    }

    const sourceNoteId = editorContent.sourceNoteId;

    // Always save in create mode (sourceNoteId === null)
    if (sourceNoteId === null) {
      scheduleSave(syncedAt);
      return;
    }

    // For notes with sourceNoteId, check if note exists
    // If note doesn't exist (new note in float window), also save draft
    const checkAndSave = async () => {
      // Check cache first
      if (noteExistsCache.current.has(sourceNoteId)) {
        if (!noteExistsCache.current.get(sourceNoteId)) {
          scheduleSave(syncedAt);
        }
        return;
      }

      // Check if note exists in local notes array
      const existsLocally = notes.some(n => n.id === sourceNoteId);
      if (existsLocally) {
        noteExistsCache.current.set(sourceNoteId, true);
        return; // Note exists, don't save as draft
      }

      // Check backend
      if (isTauri()) {
        try {
          const existingNote = await invoke<any>('get_temp_note', { id: sourceNoteId });
          noteExistsCache.current.set(sourceNoteId, !!existingNote);
          if (!existingNote) {
            scheduleSave(syncedAt);
          }
        } catch {
          // If backend check fails, assume note doesn't exist
          noteExistsCache.current.set(sourceNoteId, false);
          scheduleSave(syncedAt);
        }
      }
    };

    checkAndSave();

    function scheduleSave(receivedSyncedAt: string | null) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        // If content came from sync, skip emit to prevent loop
        const isFromSync = !!receivedSyncedAt;

        const savedAt = new Date().toISOString();
        const draft: DraftContent = {
          text: editorContent.text,
          tags: editorContent.tags,
          richContent: editorContent.richContent,
          savedAt,
        };

        // Save to local atom (sync)
        setDraft(draft);

        if (isTauri()) {
          if (!isFromSync) {
            lastEmittedSavedAtRef.current = savedAt;
            emittedSavedAtSet.add(savedAt);
            setTimeout(() => emittedSavedAtSet.delete(savedAt), 5000);

            // Emit first for faster sync (don't await)
            emit('draft-updated', draft);
          }

          // Save to disk async (don't block)
          setStoreValue('lovpen-draft', draft);
        }
      }, 150);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editorContent, notes, setDraft]);
}

/**
 * Clear draft content (call after successful submission)
 */
export function useClearDraft() {
  const setDraft = useSetAtom(draftContentAtom);

  return () => {
    setDraft(null);
    console.log('[Draft] Cleared draft content');
  };
}
