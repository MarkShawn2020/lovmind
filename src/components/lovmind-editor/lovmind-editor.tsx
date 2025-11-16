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

    // Track the last noteId and richContent we successfully loaded
    const lastLoadedStateRef = useRef<{
      noteId: string | null | undefined;
      richContent: Value | null;
    }>({ noteId: undefined, richContent: null });

    // Effect 1: When noteId changes, mark that we need to load new content
    const pendingNoteIdRef = useRef<string | null | undefined>(undefined);

    useEffect(() => {
      if (lastLoadedStateRef.current.noteId !== noteId) {
        console.log('[LovmindEditor] noteId changed, marking pending:', noteId);
        pendingNoteIdRef.current = noteId;
      }
    }, [noteId]);

    // Effect 2: When richContent changes AND we have a pending noteId, load it
    useEffect(() => {
      const richContent = editorContent.richContent;

      // Check if we have a pending note to load
      const hasPendingNote = pendingNoteIdRef.current !== undefined;

      // Check if the richContent has changed (reference equality)
      const contentChanged = lastLoadedStateRef.current.richContent !== richContent;

      console.log('[LovmindEditor] richContent effect:', {
        hasPendingNote,
        pendingNoteId: pendingNoteIdRef.current,
        currentNoteId: noteId,
        contentChanged,
        lastNoteId: lastLoadedStateRef.current.noteId
      });

      if (hasPendingNote && contentChanged) {
        // We have a pending note and content just changed - this is the async load completing
        console.log('[LovmindEditor] Loading pending note:', pendingNoteIdRef.current);

        const newValue = richContent && !isEditorContentEmpty(richContent)
          ? richContent
          : createInitialValue('');

        editor.tf.setValue(newValue);

        // Update refs
        lastLoadedStateRef.current = {
          noteId: pendingNoteIdRef.current,
          richContent: richContent
        };
        pendingNoteIdRef.current = undefined;

        console.log('[LovmindEditor] ✅ setValue completed for noteId:', noteId);
      } else if (!hasPendingNote && contentChanged) {
        // Content changed but no pending note - this is user typing
        console.log('[LovmindEditor] Content changed (user typing), skipping setValue');
        // Update the richContent ref to avoid re-triggering
        lastLoadedStateRef.current.richContent = richContent;
      }
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
