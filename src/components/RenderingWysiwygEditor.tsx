'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { HASHTAG_KEY } from '@/components/editor/plugins/hashtag-kit';
import type { THashtagElement } from '@/components/editor/plugins/hashtag-base-kit';

interface RenderingWysiwygEditorProps {
  initialContent?: string;
  initialRichContent?: any; // Plate.js Value
  onChange?: (content: string, tags?: string[], richContent?: any) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export interface RenderingWysiwygEditorRef {
  resetAndFocus: () => void;
}

const createInitialValue = (text: string = ''): Value => {
  // Ensure text is a string
  if (!text || typeof text !== 'string') {
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

const extractTextContent = (value: Value): { text: string; tags: string[] } => {
  // Track list item counters for each indent level
  const listCounters = new Map<string, number>();
  const tags = new Set<string>();

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
      // Handle hashtag elements
      if (node.type === HASHTAG_KEY) {
        const hashtagElement = node as THashtagElement;
        tags.add(hashtagElement.value);
        return `#${hashtagElement.value}`;
      }

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

      // Image nodes - represent as markdown
      if (node.type === 'img') {
        const url = node.url || '';
        const name = node.name || 'image';
        return `![${name}](${url})`;
      }

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

  return {
    text: results.join('\n'),
    tags: Array.from(tags),
  };
};

const RenderingWysiwygEditor = forwardRef<RenderingWysiwygEditorRef, RenderingWysiwygEditorProps>(
  function RenderingWysiwygEditor({
    initialContent = '',
    initialRichContent,
    onChange,
    onSubmit,
    placeholder = "Type your amazing content here..."
  }, ref) {
    // Ensure initialContent is a string
    const safeInitialContent = typeof initialContent === 'string' ? initialContent : '';

    // Use richContent if available, otherwise fallback to text content
    const initialValue = initialRichContent || createInitialValue(safeInitialContent);

    const editor = usePlateEditor({
      plugins: EditorKit,
      value: initialValue,
    });

    // Update editor value when initialRichContent changes (e.g., when loading a note)
    useEffect(() => {
      if (initialRichContent) {
        console.log('[RenderingWysiwygEditor] 更新编辑器内容为 richContent:', initialRichContent);
        editor.tf.setValue(initialRichContent);
      }
    }, [initialRichContent, editor]);

    // Expose resetAndFocus method to parent
    useImperativeHandle(ref, () => ({
      resetAndFocus: () => {
        // Reset editor content
        editor.tf.setValue([
          {
            type: 'p',
            children: [{ text: '' }],
          },
        ]);

        // Set selection to start and focus
        editor.tf.select({ path: [0, 0], offset: 0 });
        editor.tf.focus();
      }
    }), [editor]);

    // Handle content changes
    const handleChange = ({ value }: { value: Value }) => {
      console.log('[RenderingWysiwygEditor] 内容变化:', {
        valueLength: value.length,
        value: JSON.stringify(value, null, 2),
      });

      if (onChange) {
        const { text, tags } = extractTextContent(value);
        console.log('[RenderingWysiwygEditor] 提取的文本内容:', {
          textLength: text.length,
          textPreview: text.substring(0, 200),
          tags,
        });
        // Pass both text content and rich content (for images)
        onChange(text, tags, value);
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
);

export default RenderingWysiwygEditor;
