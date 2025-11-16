'use client';

import React, {forwardRef, useImperativeHandle, useMemo} from 'react';
import type {Value} from 'platejs';
import {Plate, usePlateEditor} from 'platejs/react';

import {EditorKitWithoutFixedToolbar} from '@/components/editor/editor-kit';
import {Editor, EditorContainer} from '@/components/ui/editor';
import {FixedToolbar} from '@/components/ui/fixed-toolbar';
import {FixedToolbarButtons} from '@/components/ui/fixed-toolbar-buttons';
import {EditorContextMenu} from '@/components/editor/EditorContextMenu';
import {isEditorContentEmpty} from "@/utils/is-editor-content-empty.ts";
import {createInitialValue} from "@/utils/create-initial-value.ts";
import {useEditorEventBridge} from "@/hooks/useEditorEventBridge.ts";

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
    // Note: Empty deps array is intentional - parent should use key prop to create new instances
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

    useEditorEventBridge(editor, onChange, onSubmit);

    useImperativeHandle(ref, () => ({
      resetAndFocus: () => (editor.api as any).commands.resetAndFocus(),
      focus: () => editor.tf.focus(),
      insertTag: (tag: string) => (editor.api as any).hashtag.insert(tag),
      removeTag: (tag: string) => (editor.api as any).hashtag.remove(tag),
      renameTag: (oldTag: string, newTag: string) => (editor.api as any).hashtag.rename(oldTag, newTag),
    }), [editor]);

    return (
      <Plate editor={editor}>
        <div className="h-full w-full grid grid-rows-[auto_1fr]">
          <FixedToolbar>
            <FixedToolbarButtons />
          </FixedToolbar>

          <EditorContextMenu editor={editor}>
            <EditorContainer className="relative overflow-auto">
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
