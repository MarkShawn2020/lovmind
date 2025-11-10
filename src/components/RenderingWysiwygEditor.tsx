'use client';

import React, { useEffect, useRef } from 'react';
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
  const editorRef = useRef<HTMLDivElement>(null);

  // Reset editor when initialContent becomes empty from a non-empty state
  useEffect(() => {
    if (initialContent === '' && editor) {
      const currentValue = editor.children;
      // Only reset if editor currently has actual text content
      const hasContent = currentValue.some((node: any) => {
        if (node.children && Array.isArray(node.children)) {
          return node.children.some((child: any) => child.text !== '');
        }
        return false;
      });

      if (hasContent) {
        editor.tf.setValue([
          {
            type: 'p',
            children: [{ text: '' }],
          },
        ]);

        // Focus editor after reset - delay to ensure all animations complete
        console.log('Editor reset, scheduling focus...');
        setTimeout(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                console.log('Attempting to focus editor...');

                // First, set selection to the start of the editor
                try {
                  editor.tf.select({ path: [0, 0], offset: 0 });
                  console.log('Set selection to start');
                } catch (e) {
                  console.warn('Could not set selection:', e);
                }

                // Try to focus using Plate API
                editor.tf.focus();
                console.log('Called editor.tf.focus()');

                // Also try direct DOM focus as fallback
                if (editorRef.current) {
                  const editableElement = editorRef.current.querySelector('[data-slate-editor="true"]') as HTMLElement;
                  if (editableElement) {
                    editableElement.focus();
                    console.log('Called editableElement.focus()');
                  } else {
                    console.warn('Could not find [data-slate-editor] element');
                  }
                } else {
                  console.warn('editorRef.current is null');
                }

                console.log('Focus attempt complete, active element:', document.activeElement);
              } catch (error) {
                console.error('Failed to focus editor:', error);
              }
            });
          });
        }, 150);
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
    <div className="h-full w-full flex flex-col" ref={editorRef}>
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
