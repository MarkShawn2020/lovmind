import { useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { editorContentAtom } from '@/atoms/noteAtoms';
import type { EditorContentChange } from '@/components/lovmind-editor/lovmind-editor.tsx';

/**
 * Editor Sync Hook
 *
 * Syncs editor changes to Jotai atom (editorContentAtom).
 * Replaces the manual state synchronization in useNoteEditorController.
 *
 * Usage:
 * ```typescript
 * const { handleContentChange } = useEditorSync();
 * <RenderingWysiwygEditor onChange={handleContentChange} />
 * ```
 */
export function useEditorSync() {
  const setEditorContent = useSetAtom(editorContentAtom);

  const handleContentChange = useCallback((payload: EditorContentChange) => {
    console.log("Content changed:", payload);
    console.log(`  📝 Input State: ${payload.isInputting ? '✍️  INPUTTING' : '⏸️  STOPPED'} (${payload.inputStateReason})`);
    console.log(`  🎯 Focus State: ${payload.isFocused ? '👀 FOCUSED' : '👁️  BLURRED'}`);

    setEditorContent({
      text: payload.text,
      tags: payload.tags,
      richContent: payload.richContent,
      isEmpty: payload.isEmpty,
    });
  }, [setEditorContent]);

  return { handleContentChange };
}
