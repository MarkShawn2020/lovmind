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
  const extractNodeText = (node: any): string => {
    // If node has text property, return it
    if (typeof node.text === 'string') {
      return node.text;
    }

    // If node has children, recursively extract text from all children
    if (node.children && Array.isArray(node.children)) {
      return node.children.map(extractNodeText).join('');
    }

    return '';
  };

  return value
    .map((node: any) => extractNodeText(node))
    .filter(text => text.length > 0) // Filter out empty strings
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

  // Handle content changes
  const handleChange = ({ value }: { value: Value }) => {
    if (onChange) {
      const content = extractTextContent(value);
      onChange(content);
    }
  };


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
