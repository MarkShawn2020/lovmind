import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import type { Value } from 'platejs';
import { editorContentAtom } from '@/atoms/noteAtoms';
import type { MyEditor } from '@/components/editor/editor-kit';
import { extractTextContent } from '@/utils/extract-text-content';
import { isEditorContentEmpty } from '@/utils/is-editor-content-empty';

/**
 * Editor Sync Hook
 *
 * Syncs editor changes to Jotai atom (editorContentAtom).
 * Listens to editor plugin events (input-state-changed) and enriches data before syncing.
 *
 * This hook directly subscribes to editor events, eliminating the need for
 * a separate event bridge layer (KISS principle).
 */
export function useEditorSync(editor: MyEditor) {
  const setEditorContent = useSetAtom(editorContentAtom);

  useEffect(() => {
    const handleInputStateChange = (state: any) => {
      // Enrich event data by extracting text, tags, and checking isEmpty
      const { text, tags } = extractTextContent(editor.children as Value);
      const isEmpty = isEditorContentEmpty(editor.children as Value);

      setEditorContent((prev) => ({
        text,
        tags,
        richContent: editor.children as Value,
        isEmpty,
        // Keep sourceNoteId from previous state (set by useNoteLoader)
        // Don't override it with user edits
        sourceNoteId: prev.sourceNoteId,
        // CRITICAL: Preserve _loadVersion to prevent editor reload during typing
        // If this is not preserved, the load-content effect will think content changed externally
        _loadVersion: prev._loadVersion,
      }));
    };

    if (typeof editor.on === 'function') {
      editor.on('input-state-changed', handleInputStateChange);
    }

    return () => {
      if (typeof editor.off === 'function') {
        editor.off('input-state-changed', handleInputStateChange);
      }
    };
  }, [editor, setEditorContent]);
}
