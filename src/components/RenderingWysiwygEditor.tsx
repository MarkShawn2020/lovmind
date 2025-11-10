'use client';

import React, { useEffect } from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';

interface RenderingWysiwygEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
}

const createInitialValue = (text: string = ''): Value => {
  if (!text) {
    return [
      {
        type: 'p',
        children: [{ text: '' }],
      },
    ];
  }

  // Split by newlines and create paragraphs
  const lines = text.split('\n');
  return lines.map(line => ({
    type: 'p',
    children: [{ text: line }],
  }));
};

const extractTextContent = (value: Value): string => {
  return value
    .map((node: any) => {
      if (node.children) {
        return node.children
          .map((child: any) => child.text || '')
          .join('');
      }
      return '';
    })
    .join('\n');
};

export default function RenderingWysiwygEditor({
  initialContent = '',
  onChange,
  placeholder = "Type your amazing content here..."
}: RenderingWysiwygEditorProps) {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: createInitialValue(initialContent),
  });

  // Reset editor when initialContent becomes empty
  useEffect(() => {
    if (editor && initialContent === '') {
      editor.tf.reset();
    }
  }, [initialContent, editor]);

  // Handle content changes
  const handleChange = ({ value }: { value: Value }) => {
    if (onChange) {
      const content = extractTextContent(value);
      onChange(content);
    }
  };

  // Add comprehensive focus/blur logging
  useEffect(() => {
    if (!editor) return;

    const editorElement = editor.api.toDOMNode(editor);
    if (!editorElement) return;

    console.log('[Focus Debug] Editor element found:', editorElement);

    let lastMouseDownInsideEditor = false;

    const handleFocus = (e: FocusEvent) => {
      console.log('[Focus Debug] ✅ Editor FOCUSED', {
        target: e.target,
        relatedTarget: e.relatedTarget,
        timestamp: new Date().toISOString(),
        selection: editor.tf.selection,
      });
    };

    const handleBlur = (e: FocusEvent) => {
      // Capture call stack to see who triggered the blur
      const callStack = new Error().stack;

      console.log('[Focus Debug] ❌ Editor BLUR attempted', {
        target: e.target,
        relatedTarget: e.relatedTarget,
        timestamp: new Date().toISOString(),
        selection: editor.tf.selection,
        lastMouseDownInsideEditor,
        canPreventDefault: e.cancelable,
        isTrusted: e.isTrusted,
        eventPhase: e.eventPhase,
      });

      // Log call stack to trace who caused the blur
      console.log('[Focus Debug] 📞 BLUR Call Stack:', callStack);

      // If blur is happening without a relatedTarget (focus completely lost)
      // and the last mousedown was inside the editor, prevent it entirely
      if (!e.relatedTarget && lastMouseDownInsideEditor) {
        console.log('[Focus Debug] 🚫 ATTEMPTING TO PREVENT BLUR');

        // Try to prevent (though blur events usually can't be prevented)
        if (e.cancelable) {
          e.preventDefault();
          console.log('[Focus Debug] ✅ Blur was cancelable, prevented');
        } else {
          console.log('[Focus Debug] ⚠️ Blur is NOT cancelable, will restore focus');
        }

        e.stopPropagation();
        e.stopImmediatePropagation();

        // Ensure editor stays focused
        if (document.activeElement !== editorElement) {
          editorElement.focus();
        }
        return;
      }

      console.log('[Focus Debug] ❌ Editor BLURRED (allowed)');

      // Reset the flag after handling blur
      // Use a timeout to allow the blur handler to complete first
      setTimeout(() => {
        lastMouseDownInsideEditor = false;
      }, 0);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      lastMouseDownInsideEditor = true;
      console.log('[Focus Debug] 🖱️ MOUSEDOWN on editor area', {
        target: target.tagName,
        classList: Array.from(target.classList),
        contentEditable: target.contentEditable,
        hasPreventDeselect: target.hasAttribute('data-plate-prevent-deselect'),
        isSlateElement: target.hasAttribute('data-slate-node'),
        path: target.getAttribute('data-path'),
        timestamp: new Date().toISOString(),
      });

      // If clicking on editable content, ensure focus is maintained
      // This prevents BlockSelectionPlugin from causing unwanted blur
      const isEditableContent =
        target.contentEditable === 'true' ||
        target.hasAttribute('data-slate-node');

      if (isEditableContent) {
        console.log('[Focus Debug] 🔒 Clicking on editable content, maintaining focus');
        // Schedule focus check after current event handling completes
        setTimeout(() => {
          if (document.activeElement !== editorElement) {
            console.log('[Focus Debug] 🔧 Focus was lost, restoring...');
            editorElement.focus();
          }
        }, 0);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      console.log('[Focus Debug] 🖱️ CLICK on editor area', {
        target: target.tagName,
        classList: Array.from(target.classList),
        contentEditable: target.contentEditable,
        hasPreventDeselect: target.hasAttribute('data-plate-prevent-deselect'),
        timestamp: new Date().toISOString(),
      });
    };

    editorElement.addEventListener('focus', handleFocus, true);
    editorElement.addEventListener('blur', handleBlur, true);
    editorElement.addEventListener('mousedown', handleMouseDown, true);
    editorElement.addEventListener('click', handleClick, true);

    // Also listen on document for global events
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInside = editorElement.contains(target);

      // Reset flag if clicking outside editor
      if (!isInside) {
        lastMouseDownInsideEditor = false;
      }

      console.log('[Focus Debug] 🌐 Global MOUSEDOWN', {
        target: target.tagName,
        classList: Array.from(target.classList),
        isInsideEditor: isInside,
        timestamp: new Date().toISOString(),
      });
    };

    document.addEventListener('mousedown', handleDocumentMouseDown, true);

    return () => {
      editorElement.removeEventListener('focus', handleFocus, true);
      editorElement.removeEventListener('blur', handleBlur, true);
      editorElement.removeEventListener('mousedown', handleMouseDown, true);
      editorElement.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousedown', handleDocumentMouseDown, true);
    };
  }, [editor]);

  return (
    <div className="h-full w-full flex flex-col">
      <Plate editor={editor} onChange={handleChange}>
        <EditorContainer className="h-full w-full flex flex-col flex-1">
          <Editor
            placeholder={placeholder}
            variant="none"
            className="h-full w-full flex-1 px-8 py-2 outline-none caret-primary select-text selection:bg-brand/25"
          />
        </EditorContainer>
      </Plate>
    </div>
  );
}
