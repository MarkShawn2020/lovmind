import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { listen } from '@tauri-apps/api/event';
import { editorContentAtom, notesAtom } from '@/atoms/noteAtoms';
import { draftContentAtom, type DraftContent } from '@/store';
import { isTauri } from '@/utils/tauri';
import { emittedSavedAtSet } from './useDraftPersistence';

/**
 * Draft Sync Hook
 *
 * Listens for draft-updated events from other windows and syncs content
 * to the current editor if it's editing a draft (unsaved note).
 *
 * Key features:
 * - Only syncs for create mode (main window) or unsaved notes (float window)
 * - Adds _syncedAt marker to prevent re-emitting received content
 * - Skips if local content is newer than received update
 */
export function useDraftSync(noteId: string | null) {
  const setEditorContent = useSetAtom(editorContentAtom);
  const setDraftContent = useSetAtom(draftContentAtom);
  const editorContent = useAtomValue(editorContentAtom);
  const notes = useAtomValue(notesAtom);

  // Track last received draft to prevent loops
  const lastReceivedDraftRef = useRef<string | null>(null);
  // Track latest editorContent to avoid stale closure
  const editorContentRef = useRef(editorContent);
  editorContentRef.current = editorContent;

  useEffect(() => {
    if (!isTauri()) return;

    const unlistenPromise = listen<DraftContent>('draft-updated', (event) => {
      const draft = event.payload;

      // Skip if this is our own emitted event
      if (emittedSavedAtSet.has(draft.savedAt)) {
        console.log('[DraftSync] Skipping own emitted event:', draft.savedAt);
        return;
      }

      // Skip if this is the same draft we just received (prevent loops)
      if (lastReceivedDraftRef.current === draft.savedAt) {
        return;
      }

      lastReceivedDraftRef.current = draft.savedAt;

      // Always update draftContentAtom so handleBackToCreate can read it
      setDraftContent(draft);

      // Read fresh editorContent from ref (avoids stale closure)
      const currentEditorContent = editorContentRef.current;

      // Check if we should also sync to editor:
      // 1. Main window in create mode (noteId === null, sourceNoteId === null)
      // 2. Float window with unsaved note (noteId exists but note not in backend)
      const isMainWindowCreateMode = noteId === null && currentEditorContent.sourceNoteId === null;
      const isFloatWindowNewNote = noteId !== null && !notes.some(n => n.id === noteId);

      if (!isMainWindowCreateMode && !isFloatWindowNewNote) {
        console.log('[DraftSync] Updated draftContentAtom only (not in edit mode)');
        return;
      }

      // Skip if our local content is newer (user is actively typing here)
      const localSyncedAt = (currentEditorContent as any)._syncedAt;
      if (localSyncedAt && localSyncedAt > draft.savedAt) {
        return;
      }

      console.log('[DraftSync] Syncing to editor:', draft.savedAt);

      // Update editor content with synced draft
      // Add _syncedAt marker so useDraftPersistence knows this came from sync
      setEditorContent((prev) => ({
        text: draft.text,
        tags: draft.tags,
        richContent: draft.richContent,
        isEmpty: !draft.text?.trim(),
        sourceNoteId: noteId, // Keep current noteId association
        _loadVersion: (prev._loadVersion ?? 0) + 1, // Force editor reload
        _syncedAt: draft.savedAt, // Mark as synced to prevent re-emit loop
      } as any));
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [noteId, notes, setEditorContent, setDraftContent]);
}
