import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { editorContentAtom, currentNoteAtom } from '@/atoms/noteAtoms';
import { useNoteOperations } from './useNoteOperations';
import { extractNoteTitle } from '@/utils/titleExtractor';
import { isTauri } from '@/utils/tauri';

/**
 * Auto-Save Hook
 *
 * Automatically saves editor content to the current note when user stops typing.
 * Replaces the auto-save logic scattered in useNoteEditorController's handleContentChange.
 *
 * Features:
 * - Triggers on typing-stop (debounced)
 * - Respects manual title (manualTitle flag)
 * - Updates window title in Tauri
 * - Prevents duplicate saves
 *
 * Usage:
 * ```typescript
 * function FloatWindow() {
 *   useAutoSave(); // That's it!
 * }
 * ```
 */
export function useAutoSave() {
  const editorContent = useAtomValue(editorContentAtom);
  const currentNote = useAtomValue(currentNoteAtom);
  const { updateNote } = useNoteOperations();

  const lastSavedContentRef = useRef<string>('');

  useEffect(() => {
    // Only auto-save if there's a current note
    if (!currentNote) return;

    // Don't save empty content
    if (editorContent.isEmpty) return;

    // Prevent duplicate saves
    const contentHash = JSON.stringify({
      text: editorContent.text,
      tags: editorContent.tags,
      richContent: editorContent.richContent,
    });

    if (contentHash === lastSavedContentRef.current) return;

    // Don't save if content matches the current note (no changes made)
    const noteContentHash = JSON.stringify({
      text: currentNote.text,
      tags: currentNote.tags,
      richContent: currentNote.richContent,
    });

    if (contentHash === noteContentHash) {
      // Content hasn't changed from saved state, just update the ref
      lastSavedContentRef.current = contentHash;
      return;
    }

    // Debounce: Only save after user stops typing
    // Note: In the future, we could listen to InputStatePlugin's typing-stop event
    // For now, we use a simple timer
    const timer = setTimeout(async () => {
      const hasTypedContent = typeof editorContent.text === 'string' && Boolean(editorContent.text.trim());

      if (hasTypedContent || !editorContent.isEmpty) {
        const updatedNote = {
          ...currentNote,
          text: editorContent.text,
          tags: editorContent.tags,
          richContent: editorContent.richContent,
          title: currentNote.manualTitle
            ? currentNote.title // Keep manual title
            : extractNoteTitle({ text: editorContent.text, richContent: editorContent.richContent }),
          time: new Date().toLocaleString(),
        };

        try {
          await updateNote(updatedNote);
          console.log('🔄 Auto-saved:', updatedNote.id);
          lastSavedContentRef.current = contentHash;

          // Update window title if in Tauri
          if (isTauri()) {
            try {
              const currentWindow = getCurrentWebviewWindow();
              await currentWindow.setTitle(`Edit: ${updatedNote.title}`);
            } catch (error) {
              console.error('Failed to update window title:', error);
            }
          }
        } catch (error) {
          console.error('Failed to auto-save:', error);
        }
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [editorContent, currentNote, updateNote]);
}
