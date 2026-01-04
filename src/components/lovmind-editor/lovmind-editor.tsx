'use client';

import React, {forwardRef, useImperativeHandle, useMemo, useEffect, useRef} from 'react';
import {useAtomValue} from 'jotai';
import type {Value} from 'platejs';
import {Plate, usePlateEditor} from 'platejs/react';

import {EditorKitWithoutFixedToolbar} from '@/components/editor/editor-kit.tsx';
import {Editor, EditorContainer} from '@/components/ui/editor.tsx';
import {HASHTAG_INPUT_KEY} from '@/components/editor/plugins/hashtag-kit.tsx';
import {FixedToolbar} from '@/components/ui/fixed-toolbar.tsx';
import {FixedToolbarButtons} from '@/components/ui/fixed-toolbar-buttons.tsx';
import {EditorContextMenu} from '@/components/editor/EditorContextMenu.tsx';
import {isEditorContentEmpty} from "@/utils/is-editor-content-empty.ts";
import {createInitialValue} from "@/utils/create-initial-value.ts";
import {useNoteLoader} from "@/hooks/useNoteLoader.ts";
import {useEditorSync} from "@/hooks/useEditorSync.ts";
import {useAutoSave} from "@/hooks/useAutoSave.ts";
import {useDraftPersistence} from "@/hooks/useDraftPersistence.ts";
import {useDraftSync} from "@/hooks/useDraftSync.ts";
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

    // Remove active combobox input nodes before replacing editor content
    // This prevents crashes when useComboboxInput tries to access removed nodes
    const removeComboboxInputNodes = React.useCallback(() => {
      try {
        const inputs = Array.from(editor.api.nodes({
          match: { type: HASHTAG_INPUT_KEY },
          at: [],
        }));
        // Remove in reverse order to avoid path invalidation
        for (let i = inputs.length - 1; i >= 0; i--) {
          const [, path] = inputs[i];
          editor.tf.removeNodes({ at: path });
        }
      } catch {
        // Ignore errors during cleanup
      }
    }, [editor]);

    // Track which version of content has been loaded into editor
    // _loadVersion is only incremented by external sources (useNoteLoader, draft restore)
    // NOT by useEditorSync (user typing)
    const loadedVersionRef = useRef<number>(-1);


    // Update editor value ONLY when _loadVersion changes (external content load)
    // This ensures we don't reload content when user is typing
    useEffect(() => {
      const loadVersion = editorContent._loadVersion ?? 0;

      // Wait until editorContent.sourceNoteId matches the noteId we want to display
      // This prevents setting old content when switching notes
      if (editorContent.sourceNoteId !== noteId) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[LovmindEditor] Waiting for content to load. Current:', editorContent.sourceNoteId, 'Expected:', noteId);
        }
        return;
      }

      // Only load content when _loadVersion changes (external source)
      // This prevents reloading when useEditorSync updates from user typing
      if (loadedVersionRef.current === loadVersion) {
        return;
      }

      loadedVersionRef.current = loadVersion;

      // Get the content to load
      const richContent = editorContent.richContent;
      const newValue = richContent && !isEditorContentEmpty(richContent)
        ? richContent
        : createInitialValue('');

      // Remove active combobox inputs before replacing content
      removeComboboxInputNodes();

      // Update editor value using Plate's API
      editor.tf.setValue(newValue);

      if (process.env.NODE_ENV === 'development') {
        console.log('[LovmindEditor] Loaded note with sourceNoteId:', editorContent.sourceNoteId, 'version:', loadVersion);
      }
    }, [noteId, editorContent.sourceNoteId, editorContent._loadVersion, editorContent.richContent, editor, removeComboboxInputNodes]);

    // Sync editor content to atoms (subscribes to input-state-changed event)
    useEditorSync(editor);

    // Auto-save on typing stop
    useAutoSave();

    // Auto-save draft for unsaved new notes
    useDraftPersistence();

    // Sync draft content from other windows
    useDraftSync(noteId ?? null);

    // Track last processed sync to avoid duplicate updates
    const lastSyncedAtRef = useRef<string | null>(null);

    // Handle sync updates from other windows
    // This watches for _syncedAt changes and updates the editor
    useEffect(() => {
      const syncedAt = (editorContent as any)._syncedAt;
      if (!syncedAt) return;

      // Skip if we already processed this sync
      if (lastSyncedAtRef.current === syncedAt) return;
      lastSyncedAtRef.current = syncedAt;

      // Update editor with synced content
      const richContent = editorContent.richContent;
      const newValue = richContent && !isEditorContentEmpty(richContent)
        ? richContent
        : createInitialValue('');

      // Remove active combobox inputs before replacing content
      removeComboboxInputNodes();

      editor.tf.setValue(newValue);

      if (process.env.NODE_ENV === 'development') {
        console.log('[LovmindEditor] Applied sync update:', syncedAt);
      }
    }, [(editorContent as any)._syncedAt, editorContent.richContent, editor, removeComboboxInputNodes]);

    // Handle submit shortcut (Cmd+Enter)
    // Use ref to avoid re-registering listener when onSubmit changes
    const onSubmitRef = useRef(onSubmit);
    useEffect(() => {
      onSubmitRef.current = onSubmit;
    }, [onSubmit]);

    useEffect(() => {
      const handleSubmitShortcut = () => {
        onSubmitRef.current?.();
      };

      if (typeof editor.on === 'function') {
        editor.on('submit-shortcut', handleSubmitShortcut);
      }

      return () => {
        if (typeof editor.off === 'function') {
          editor.off('submit-shortcut', handleSubmitShortcut);
        }
      };
    }, [editor]); // Only depend on editor, not onSubmit

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
            <EditorContainer className="relative overflow-auto flex-1 min-h-0">
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
