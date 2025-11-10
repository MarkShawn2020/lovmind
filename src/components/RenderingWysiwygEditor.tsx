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
    let lastMouseDownEvent: { clientX: number; clientY: number } | null = null;

    const handleFocus = (e: FocusEvent) => {
      console.log('[Focus Debug] ✅ Editor FOCUSED', {
        target: e.target,
        relatedTarget: e.relatedTarget,
        timestamp: new Date().toISOString(),
        selection: editor.tf.selection,
      });
    };

    const handleBlur = (e: FocusEvent) => {
      console.log('[Focus Debug] ❌ Editor BLURRED', {
        target: e.target,
        relatedTarget: e.relatedTarget,
        timestamp: new Date().toISOString(),
        selection: editor.tf.selection,
        lastMouseDownInsideEditor,
      });

      // If blur happened without a relatedTarget (focus completely lost)
      // and the last mousedown was inside the editor, restore focus
      if (!e.relatedTarget && lastMouseDownInsideEditor && lastMouseDownEvent) {
        console.log('[Focus Debug] 🔧 Auto-restoring focus (blur with null relatedTarget after internal click)');
        const { clientX, clientY } = lastMouseDownEvent;

        // Use requestAnimationFrame to avoid interfering with ongoing event handling
        requestAnimationFrame(() => {
          if (document.activeElement !== editorElement) {
            // Try to set selection at the mouse position
            try {
              // First, focus the editor
              editor.tf.focus();

              // Then try to set the selection at the click position
              const domRange = document.caretRangeFromPoint?.(clientX, clientY);

              if (domRange) {
                // Use native Selection API to set the range
                const selection = window.getSelection();
                if (selection) {
                  selection.removeAllRanges();
                  selection.addRange(domRange);
                  console.log('[Focus Debug] ✅ Focus and selection restored at click position', { clientX, clientY });
                } else {
                  console.log('[Focus Debug] ✅ Focus restored (no Selection API)');
                }
              } else {
                console.log('[Focus Debug] ✅ Focus restored (no range from point)');
              }
            } catch (error) {
              console.warn('[Focus Debug] Error restoring selection at position:', error);
              // Fallback is already done (editor.tf.focus())
              console.log('[Focus Debug] ✅ Focus restored (fallback: error)');
            }
          }
        });
      }

      // Reset the flag after handling blur
      // Use a timeout to allow the blur handler to complete first
      setTimeout(() => {
        lastMouseDownInsideEditor = false;
        lastMouseDownEvent = null;
      }, 0);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      lastMouseDownInsideEditor = true;
      lastMouseDownEvent = { clientX: e.clientX, clientY: e.clientY };

      console.log('[Focus Debug] 🖱️ MOUSEDOWN on editor area', {
        target: target.tagName,
        classList: Array.from(target.classList),
        contentEditable: target.contentEditable,
        hasPreventDeselect: target.hasAttribute('data-plate-prevent-deselect'),
        isSlateElement: target.hasAttribute('data-slate-node'),
        path: target.getAttribute('data-path'),
        clientX: e.clientX,
        clientY: e.clientY,
        timestamp: new Date().toISOString(),
      });
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
