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
import {useEditorSync} from "@/hooks/useEditorSync.ts";
import {useAutoSave} from "@/hooks/useAutoSave.ts";
import {editorContentAtom} from "@/atoms/noteAtoms.ts";

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
    // Note: useNoteLoader is called by the parent component (FloatWindow/MainWindow)
    // We just read the editor content from the atom
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

    // Track loaded note ID AND content to detect note changes
    const loadedNoteIdRef = useRef<string | null | undefined>(undefined);
    const loadedContentRef = useRef<Value | null>(null);

    // Update editor value ONLY when switching to a different note
    // Do NOT update on every editorContentAtom change (which happens during typing)
    useEffect(() => {
      const richContent = editorContent.richContent;

      // Check if noteId has actually changed
      const noteIdChanged = loadedNoteIdRef.current !== noteId;

      // Check if content has changed (for the same noteId)
      // This handles the case where noteId is the same but content loaded async
      const contentChanged = loadedContentRef.current !== richContent;

      if (!noteIdChanged && !contentChanged) {
        return; // Nothing changed, skip update
      }

      // If noteId changed, always update
      // If only content changed (for same noteId), only update if we haven't loaded this noteId yet
      if (noteIdChanged || (contentChanged && loadedNoteIdRef.current === undefined)) {
        loadedNoteIdRef.current = noteId;
        loadedContentRef.current = richContent;

        // Get the content to load
        const newValue = richContent && !isEditorContentEmpty(richContent)
          ? richContent
          : createInitialValue('');

        // Update editor value using Plate's API
        editor.tf.setValue(newValue);

        console.log('[LovmindEditor] Loaded note:', noteId, 'with content:', richContent ? 'present' : 'empty');
      } else {
        // Content changed but noteId is already loaded - this is user typing, ignore
        console.log('[LovmindEditor] Skipping setValue - content change is from user input');
      }
    }, [noteId, editorContent.richContent, editor]);

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
