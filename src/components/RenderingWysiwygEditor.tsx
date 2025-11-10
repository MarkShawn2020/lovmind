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
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      console.log('[Focus Debug] 🖱️ MOUSEDOWN on editor area', {
        target: target.tagName,
        classList: Array.from(target.classList),
        contentEditable: target.contentEditable,
        hasPreventDeselect: target.hasAttribute('data-plate-prevent-deselect'),
        isSlateElement: target.hasAttribute('data-slate-node'),
        path: target.getAttribute('data-path'),
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
      console.log('[Focus Debug] 🌐 Global MOUSEDOWN', {
        target: target.tagName,
        classList: Array.from(target.classList),
        isInsideEditor: editorElement.contains(target),
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
