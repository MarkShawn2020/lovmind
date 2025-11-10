'use client';

import React, { useEffect } from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';

interface RenderingWysiwygEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  onSubmit?: () => void;
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
  // Track list item counters for each indent level
  const listCounters = new Map<string, number>();

  const extractNodeText = (node: any, context?: { prevListType?: string; prevIndent?: number }): string => {
    // If node has text property, it's a text leaf node
    if (typeof node.text === 'string') {
      let text = node.text;
      // Apply text formatting marks
      if (node.bold) text = `**${text}**`;
      if (node.italic) text = `*${text}*`;
      if (node.code) text = `\`${text}\``;
      if (node.strikethrough) text = `~~${text}~~`;
      return text;
    }

    // If node has children, it's a block or inline element
    if (node.children && Array.isArray(node.children)) {
      const childText = node.children.map((child: any) => extractNodeText(child, context)).join('');

      // Handle different block types with markdown syntax
      if (node.listStyleType) {
        // List item (bullet or numbered)
        const indent = node.indent || 0;
        const indentStr = '  '.repeat(indent);

        if (node.listStyleType === 'decimal') {
          // For numbered lists, track the counter
          const counterKey = `${indent}-decimal`;

          // Reset counter if we're starting a new list or indent level
          if (context?.prevListType !== 'decimal' || context?.prevIndent !== indent) {
            listCounters.set(counterKey, 1);
          } else {
            const current = listCounters.get(counterKey) || 1;
            listCounters.set(counterKey, current + 1);
          }

          const number = listCounters.get(counterKey) || 1;
          return `${indentStr}${number}. ${childText}`;
        } else {
          // Bullet list
          return `${indentStr}- ${childText}`;
        }
      }

      // Headings
      if (node.type === 'h1') return `# ${childText}`;
      if (node.type === 'h2') return `## ${childText}`;
      if (node.type === 'h3') return `### ${childText}`;
      if (node.type === 'h4') return `#### ${childText}`;
      if (node.type === 'h5') return `##### ${childText}`;
      if (node.type === 'h6') return `###### ${childText}`;

      // Other block types
      if (node.type === 'blockquote') return `> ${childText}`;
      if (node.type === 'code_block') return `\`\`\`\n${childText}\n\`\`\``;

      return childText;
    }

    return '';
  };

  const results: string[] = [];
  let prevNode: any = null;

  for (const node of value) {
    const context = prevNode?.listStyleType ? {
      prevListType: prevNode.listStyleType,
      prevIndent: prevNode.indent || 0
    } : undefined;

    const text = extractNodeText(node, context);
    if (text.length > 0) {
      results.push(text);
    }

    // Reset counter if list type or indent changes
    if (node.listStyleType !== prevNode?.listStyleType ||
        (node.indent || 0) !== (prevNode?.indent || 0)) {
      // Counter will be reset in the next iteration
    }

    prevNode = node;
  }

  return results.join('\n');
};

export default function RenderingWysiwygEditor({
  initialContent = '',
  onChange,
  onSubmit,
  placeholder = "Type your amazing content here..."
}: RenderingWysiwygEditorProps) {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: createInitialValue(initialContent),
  });

  // Reset editor when initialContent becomes empty from a non-empty state
  useEffect(() => {
    if (initialContent === '' && editor) {
      const currentValue = editor.children;

      // Check if editor needs reset:
      // 1. Has actual text content, OR
      // 2. Has multiple blocks (even if empty), OR
      // 3. Has non-paragraph blocks
      const needsReset =
        currentValue.length !== 1 || // Not exactly one block
        currentValue[0]?.type !== 'p' || // Not a paragraph
        currentValue.some((node: any) => {
          if (node.children && Array.isArray(node.children)) {
            return node.children.some((child: any) => child.text !== '');
          }
          return false;
        });

      if (needsReset) {
        editor.tf.setValue([
          {
            type: 'p',
            children: [{ text: '' }],
          },
        ]);
      }
    }
  }, [initialContent, editor]);

  // Handle content changes
  const handleChange = ({ value }: { value: Value }) => {
    if (onChange) {
      const content = extractTextContent(value);
      onChange(content);
    }
  };

  // Handle keyboard shortcuts (Cmd+Enter to submit)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
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
            onKeyDown={handleKeyDown}
          />
        </EditorContainer>
      </Plate>
    </div>
  );
}
