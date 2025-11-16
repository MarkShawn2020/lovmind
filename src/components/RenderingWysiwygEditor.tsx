'use client';

import React, {forwardRef, useEffect, useImperativeHandle, useMemo, useRef} from 'react';
import type {Value} from 'platejs';
import {Plate, usePlateEditor} from 'platejs/react';

import {EditorKitWithoutFixedToolbar} from '@/components/editor/editor-kit';
import {Editor, EditorContainer} from '@/components/ui/editor';
import {FixedToolbar} from '@/components/ui/fixed-toolbar';
import {FixedToolbarButtons} from '@/components/ui/fixed-toolbar-buttons';
import {EditorContextMenu} from '@/components/editor/EditorContextMenu';
import {extractTextContent} from "@/utils/extract-text-content.ts";
import {isEditorContentEmpty} from "@/utils/is-editor-content-empty.ts";
import {createInitialValue} from "@/utils/create-initial-value.ts";

interface RenderingWysiwygEditorProps {
  initialContent?: string;
  initialRichContent?: Value | null;
  onChange?: (payload: EditorContentChange) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export type InputStateReason =
  | 'typing-start'      // User started typing
  | 'typing-stop'       // User stopped typing (debounced)
  | 'composition-start' // IME input began
  | 'composition-end'   // IME input ended
  | 'focus-lost'        // Editor lost focus
  | 'focus-only';       // Editor focused but no typing yet

export interface EditorContentChange {
  text: string;
  tags: string[];
  richContent: Value;
  isEmpty: boolean;
  isFocused: boolean;
  isInputting: boolean;
  inputStateReason: InputStateReason;
}

export interface RenderingWysiwygEditorRef {
  resetAndFocus: () => void;
  focus: () => void;
  insertTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  renameTag: (oldTag: string, newTag: string) => void;
}

const RenderingWysiwygEditor = forwardRef<RenderingWysiwygEditorRef, RenderingWysiwygEditorProps>(
  function RenderingWysiwygEditor({
    initialContent = '',
    initialRichContent,
    onChange,
    onSubmit,
    placeholder = "Type your amazing content here..."
  }, ref) {
    // Compute initial value only once on mount
    const initialValue = useMemo<Value>(() => {
      if (initialRichContent && !isEditorContentEmpty(initialRichContent)) {
        return initialRichContent;
      }
      const safeContent = typeof initialContent === 'string' ? initialContent : '';
      return createInitialValue(safeContent);
    }, []);

    const editor = usePlateEditor({
      plugins: EditorKitWithoutFixedToolbar,
      value: initialValue,
    });

    const hasLoadedContentRef = useRef(false);

    // Update editor content when initialContent/initialRichContent changes (async loading)
    useEffect(() => {
      if (hasLoadedContentRef.current) return;

      const hasRichContent = initialRichContent && !isEditorContentEmpty(initialRichContent);
      const hasTextContent = initialContent && typeof initialContent === 'string' && initialContent.trim();

      if (hasRichContent || hasTextContent) {
        const newValue = hasRichContent ? initialRichContent! : createInitialValue(initialContent);

        if (JSON.stringify(editor.children) !== JSON.stringify(newValue)) {
          editor.tf.setValue(newValue);
          hasLoadedContentRef.current = true;
        }
      }
    }, [initialContent, initialRichContent, editor]);

    const editorContainerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      resetAndFocus: () => {
        editor.tf.setValue([{ type: 'p', children: [{ text: '' }] }]);
        requestAnimationFrame(() => {
          try {
            editor.tf.select({ path: [0, 0], offset: 0 });
            editor.tf.focus();
          } catch (error) {
            console.error('[RenderingWysiwygEditor] Failed to set selection:', error);
            editor.tf.focus();
          }
        });
      },
      focus: () => editor.tf.focus(),
      insertTag: (tag: string) => (editor.api as any).hashtag.insert(tag),
      removeTag: (tag: string) => (editor.api as any).hashtag.remove(tag),
      renameTag: (oldTag: string, newTag: string) => (editor.api as any).hashtag.rename(oldTag, newTag),
    }), [editor]);

    useEffect(() => {
      const handleInputStateChange = (state: any) => {
        if (onChange) {
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
        }
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

    return (
      <Plate editor={editor}>
        <div className="h-full w-full grid grid-rows-[auto_1fr]">
          <FixedToolbar>
            <FixedToolbarButtons />
          </FixedToolbar>

          <EditorContextMenu editor={editor}>
            <EditorContainer ref={editorContainerRef} className="relative overflow-auto">
              <Editor
                placeholder={placeholder}
                variant="none"
                className="h-full w-full px-8 py-2 outline-none caret-primary select-text selection:bg-brand/25"
              />
            </EditorContainer>
          </EditorContextMenu>
        </div>
      </Plate>
    );
  }
);

export default RenderingWysiwygEditor;
