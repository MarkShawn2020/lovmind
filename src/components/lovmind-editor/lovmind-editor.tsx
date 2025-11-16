'use client';

import React, {forwardRef, useImperativeHandle, useMemo, useEffect, useRef} from 'react';
import {useAtomValue} from 'jotai';
import type {Value} from 'platejs';
import {Plate, usePlateEditor} from 'platejs/react';

import {EditorKitWithoutFixedToolbar} from '@/components/editor/editor-kit.tsx';
import {Editor, EditorContainer} from '@/components/ui/editor.tsx';
import {FixedToolbar} from '@/components/ui/fixed-toolbar.tsx';
import {FixedToolbarButtons} from '@/components/ui/fixed-toolbar-buttons.tsx';
import {EditorContextMenu} from '@/components/editor/EditorContextMenu.tsx';
import {isEditorContentEmpty} from "@/utils/is-editor-content-empty.ts";
import {createInitialValue} from "@/utils/create-initial-value.ts";
import {useEditorEventBridge} from "@/hooks/useEditorEventBridge.ts";
import {useNoteLoader} from "@/hooks/useNoteLoader.ts";
import {useEditorSync} from "@/hooks/useEditorSync.ts";
import {useAutoSave} from "@/hooks/useAutoSave.ts";
import {editorContentAtom} from "@/atoms/noteAtoms.ts";
import {attachEventEmitter} from "@/utils/createEditorEventEmitter.ts";

interface LovmindEditorProps {
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

export interface LovmindEditorRef {
  resetAndFocus: () => void;
  focus: () => void;
  insertTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  renameTag: (oldTag: string, newTag: string) => void;
}

const LovmindEditor = forwardRef<LovmindEditorRef, LovmindEditorProps>(
  function RenderingWysiwygEditor({
    noteId,
    onSubmit,
    placeholder = "Type your amazing content here..."
  }, ref) {
    // Load note into atoms (handles both create mode and view mode)
    // This updates editorContentAtom with the loaded note's content
    useNoteLoader(noteId);

    // Read editor content from atom (updated by useNoteLoader)
    const editorContent = useAtomValue(editorContentAtom);

    // Compute initial value from loaded note content
    const initialValue = useMemo<Value>(() => {
      const richContent = editorContent.richContent;
      if (richContent && !isEditorContentEmpty(richContent)) {
        return richContent;
      }
      return createInitialValue('');
    }, [editorContent.richContent]);

    const editor = usePlateEditor({
      plugins: EditorKitWithoutFixedToolbar,
      value: initialValue,
    });

    // Attach event emitter to editor on first creation
    useEffect(() => {
      attachEventEmitter(editor);
    }, [editor]);

    // Track loaded rich content to detect external changes
    const loadedRichContentRef = useRef<Value | null>(null);
    const isInitialMountRef = useRef(true);

    // Update editor value when note content changes (external change, not user typing)
    useEffect(() => {
      const richContent = editorContent.richContent;

      // On initial mount, just record the content and skip
      // (initialValue already set in usePlateEditor)
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        loadedRichContentRef.current = richContent;
        console.log('[LovmindEditor] Initial mount with noteId:', noteId);
        return;
      }

      // Skip if content hasn't changed (reference equality check)
      if (loadedRichContentRef.current === richContent) {
        return;
      }

      // Compare actual editor content with new content to avoid unnecessary setValue
      // This prevents loops where setValue triggers events that update the atom
      const currentEditorContent = editor.children as Value;
      const currentEditorText = JSON.stringify(currentEditorContent);
      const newContentText = JSON.stringify(richContent);

      if (currentEditorText === newContentText) {
        console.log('[LovmindEditor] Editor content already matches, skipping setValue');
        loadedRichContentRef.current = richContent;
        return;
      }

      // Update the loaded content ref
      loadedRichContentRef.current = richContent;

      // Get the new value to display
      const newValue = richContent && !isEditorContentEmpty(richContent)
        ? richContent
        : createInitialValue('');

      // Update editor value using Plate's API
      editor.tf.setValue(newValue);

      console.log('[LovmindEditor] Updated editor value for noteId:', noteId);
    }, [editorContent.richContent, editor, noteId]);

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

export default LovmindEditor;
