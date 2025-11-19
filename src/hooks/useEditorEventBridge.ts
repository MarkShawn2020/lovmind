import { useEffect, useRef } from 'react';
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
  // Use refs to store latest callbacks to avoid re-registering listeners
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);

  // Update refs when callbacks change (no effect re-run needed)
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // Deduplication: Prevent duplicate submit calls within short time window
  const lastSubmitTime = useRef(0);
  const SUBMIT_DEBOUNCE_MS = 300;

  useEffect(() => {
    const handleInputStateChange = (state: any) => {
      if (!onChangeRef.current) return;

      const { text, tags } = extractTextContent(editor.children as Value);
      onChangeRef.current({
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
      // Deduplication check to prevent duplicate submissions
      const now = Date.now();
      if (now - lastSubmitTime.current < SUBMIT_DEBOUNCE_MS) {
        console.log('[EventBridge] Ignoring duplicate submit-shortcut (debounced within 300ms)');
        return;
      }
      lastSubmitTime.current = now;

      console.log('[EventBridge] Handling submit-shortcut');
      onSubmitRef.current?.();
    };

    if (typeof editor.on === 'function') {
      editor.on('input-state-changed', handleInputStateChange);
      editor.on('submit-shortcut', handleSubmitShortcut);
      console.log('[EventBridge] Registered event listeners');
    }

    return () => {
      if (typeof editor.off === 'function') {
        editor.off('input-state-changed', handleInputStateChange);
        editor.off('submit-shortcut', handleSubmitShortcut);
        console.log('[EventBridge] Unregistered event listeners');
      }
    };
  }, [editor]); // Only depend on editor, not on callbacks
}
