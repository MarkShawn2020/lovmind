'use client';

import React, { useEffect } from 'react';
import type { Value } from 'platejs';

import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
} from '@platejs/basic-nodes/react';
import {
  Plate,
  PlateContent,
  usePlateEditor,
  ParagraphPlugin,
} from 'platejs/react';

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
    plugins: [
      ParagraphPlugin,
      H1Plugin,
      H2Plugin,
      H3Plugin,
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
    ],
    value: createInitialValue(initialContent),
  });

  // Reset editor when initialContent becomes empty
  useEffect(() => {
    if (editor && initialContent === '') {
      const newValue = createInitialValue('');
      editor.children = newValue;
    }
  }, [initialContent, editor]);

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
        <PlateContent
          className="h-full w-full flex-1 px-8 py-2 outline-none caret-primary select-text selection:bg-brand/25 focus-visible:outline-none"
          placeholder={placeholder}
          style={{
            minHeight: '100%',
          }}
        />
      </Plate>
    </div>
  );
}
