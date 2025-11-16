'use client';

import React, {forwardRef, useImperativeHandle, useMemo} from 'react';
import {useAtomValue} from 'jotai';
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
import {useNoteLoader} from "@/hooks/useNoteLoader";
import {useEditorSync} from "@/hooks/useEditorSync";
import {useAutoSave} from "@/hooks/useAutoSave";
import {currentNoteAtom} from "@/atoms/noteAtoms";

interface RenderingWysiwygEditorProps {
  noteId?: string | null;
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
    noteId,
    onSubmit,
    placeholder = "Type your amazing content here..."
  }, ref) {
    // Load note into atoms (handles both create mode and view mode)
    useNoteLoader(noteId);

    // Read current note from atom
    const currentNote = useAtomValue(currentNoteAtom);

    // Compute initial value from loaded note
    const initialValue = useMemo<Value>(() => {
      const richContent = currentNote?.richContent;
      if (richContent && !isEditorContentEmpty(richContent)) {
        return richContent;
      }
      return createInitialValue('');
    }, []);

    const editor = usePlateEditor({
      plugins: EditorKitWithoutFixedToolbar,
      value: initialValue,
    });

    // Sync editor content to atoms
    const { handleContentChange } = useEditorSync();

    // Auto-save on typing stop
    useAutoSave();

    // Bridge plugin events to React callbacks
    useEditorEventBridge(editor, handleContentChange, onSubmit);

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
