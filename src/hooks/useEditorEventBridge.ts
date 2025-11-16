import { useEffect } from 'react';
import type { Value } from 'platejs';
import type { MyEditor } from '@/components/editor/editor-kit';
import type { EditorContentChange } from '@/components/lovmind-editor/lovmind-editor.tsx';
import { extractTextContent } from '@/utils/extract-text-content';
import { isEditorContentEmpty } from '@/utils/is-editor-content-empty';

/**
 * Bridge plugin events to React callback props
 *
 * Listens to editor plugin events (input-state-changed, submit-shortcut)
 * and forwards them to React props (onChange, onSubmit).
 *
 * This is necessary because:
 * 1. Plugins emit events with specific data (inputStateReason, isFocused, etc.)
 * 2. Parent components expect React-style callbacks
 * 3. We need to enrich the data (extract text, tags, check isEmpty)
 */
export function useEditorEventBridge(
  editor: MyEditor,
  onChange?: (payload: EditorContentChange) => void,
  onSubmit?: () => void
) {
  useEffect(() => {
    const handleInputStateChange = (state: any) => {
      if (!onChange) return;

      const { text, tags } = extractTextContent(editor.children as Value);
      onChange({
        text,
        tags,
        richContent: editor.children as Value,
        isEmpty: isEditorContentEmpty(editor.children as Value),
        isFocused: state.isFocused,
        isInputting: state.isInputting,
        inputStateReason: state.reason,
      });
    };

    const handleSubmitShortcut = () => {
      onSubmit?.();
    };

    if (typeof editor.on === 'function') {
      editor.on('input-state-changed', handleInputStateChange);
      editor.on('submit-shortcut', handleSubmitShortcut);
    }

    return () => {
      if (typeof editor.off === 'function') {
        editor.off('input-state-changed', handleInputStateChange);
        editor.off('submit-shortcut', handleSubmitShortcut);
      }
    };
  }, [editor, onChange, onSubmit]);
}
