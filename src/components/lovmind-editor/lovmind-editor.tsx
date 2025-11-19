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
  editor: any; // Expose editor instance for sync content extraction
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

    // Track which note content has been loaded into editor
    const loadedSourceNoteIdRef = useRef<string | null | undefined>(undefined);

    // Update editor value ONLY when editorContent matches the current noteId
    // This ensures we wait for async note loading to complete before setValue
    useEffect(() => {
      // Wait until editorContent.sourceNoteId matches the noteId we want to display
      // This prevents setting old content when switching notes
      if (editorContent.sourceNoteId !== noteId) {
        console.log('[LovmindEditor] Waiting for content to load. Current sourceNoteId:', editorContent.sourceNoteId, 'Expected:', noteId);
        return;
      }

      // Check if we already loaded this content
      if (loadedSourceNoteIdRef.current === editorContent.sourceNoteId) {
        return;
      }

      loadedSourceNoteIdRef.current = editorContent.sourceNoteId;

      // Get the content to load
      const richContent = editorContent.richContent;
      const newValue = richContent && !isEditorContentEmpty(richContent)
        ? richContent
        : createInitialValue('');

      // Update editor value using Plate's API
      editor.tf.setValue(newValue);

      console.log('[LovmindEditor] Loaded note with sourceNoteId:', editorContent.sourceNoteId);
    }, [noteId, editorContent.sourceNoteId, editorContent.richContent, editor]);

    // Sync editor content to atoms
    const { handleContentChange } = useEditorSync();

    // Auto-save on typing stop
    useAutoSave();

    // Bridge plugin events to React callbacks
    useEditorEventBridge(editor, handleContentChange, onSubmit);

    // Cleanup KeyboardShortcutsPlugin document listener on unmount
    useEffect(() => {
      return () => {
        const cleanup = (editor as any).__keyboardShortcutsCleanup;
        if (typeof cleanup === 'function') {
          cleanup();
          console.log('[LovmindEditor] Cleaned up KeyboardShortcutsPlugin');
        }
      };
    }, [editor]);

    useImperativeHandle(ref, () => ({
      resetAndFocus: () => (editor.api as any).commands.resetAndFocus(),
      focus: () => editor.tf.focus(),
      insertTag: (tag: string) => (editor.api as any).hashtag.insert(tag),
      removeTag: (tag: string) => (editor.api as any).hashtag.remove(tag),
      renameTag: (oldTag: string, newTag: string) => (editor.api as any).hashtag.rename(oldTag, newTag),
      editor, // Expose editor for sync content extraction
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
