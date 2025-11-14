'use client';

import React, { useImperativeHandle, forwardRef, useMemo } from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { HASHTAG_KEY } from '@/components/editor/plugins/hashtag-kit';
import type { THashtagElement } from '@/components/editor/plugins/hashtag-base-kit';

interface RenderingWysiwygEditorProps {
  initialContent?: string;
  initialRichContent?: Value | null;
  onChange?: (payload: EditorContentChange) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export interface EditorContentChange {
  text: string;
  tags: string[];
  richContent: Value;
  isEmpty: boolean;
  isFocused: boolean;
}

export interface RenderingWysiwygEditorRef {
  resetAndFocus: () => void;
  focus: () => void;
}

const createInitialValue = (text: string = ''): Value => {
  if (!text || typeof text !== 'string') {
    return [{ type: 'p', children: [{ text: '' }] }];
  }

  const lines = text.split('\n');
  return lines.map(line => ({
    type: 'p',
    children: [{ text: line }],
  }));
};

const extractTextContent = (value: Value): { text: string; tags: string[] } => {
  const listCounters = new Map<string, number>();
  const tags = new Set<string>();

  const extractNodeText = (node: any, context?: { prevListType?: string; prevIndent?: number }): string => {
    if (typeof node.text === 'string') {
      let text = node.text;
      if (node.bold) text = `**${text}**`;
      if (node.italic) text = `*${text}*`;
      if (node.code) text = `\`${text}\``;
      if (node.strikethrough) text = `~~${text}~~`;
      return text;
    }

    if (node.children && Array.isArray(node.children)) {
      if (node.type === HASHTAG_KEY) {
        const hashtagElement = node as THashtagElement;
        tags.add(hashtagElement.value);
        return `#${hashtagElement.value}`;
      }

      const childText = node.children.map((child: any) => extractNodeText(child, context)).join('');

      if (node.listStyleType) {
        const indent = node.indent || 0;
        const indentStr = '  '.repeat(indent);

        if (node.listStyleType === 'decimal') {
          const counterKey = `${indent}-decimal`;

          if (context?.prevListType !== 'decimal' || context?.prevIndent !== indent) {
            listCounters.set(counterKey, 1);
          } else {
            const current = listCounters.get(counterKey) || 1;
            listCounters.set(counterKey, current + 1);
          }

          const number = listCounters.get(counterKey) || 1;
          return `${indentStr}${number}. ${childText}`;
        } else {
          return `${indentStr}- ${childText}`;
        }
      }

      if (node.type === 'h1') return `# ${childText}`;
      if (node.type === 'h2') return `## ${childText}`;
      if (node.type === 'h3') return `### ${childText}`;
      if (node.type === 'h4') return `#### ${childText}`;
      if (node.type === 'h5') return `##### ${childText}`;
      if (node.type === 'h6') return `###### ${childText}`;

      if (node.type === 'blockquote') return `> ${childText}`;
      if (node.type === 'code_block') return `\`\`\`\n${childText}\n\`\`\``;

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

    prevNode = node;
  }

  return {
    text: results.join('\n'),
    tags: Array.from(tags),
  };
};

export const isEditorContentEmpty = (richContent: Value | null | undefined): boolean => {
  if (!richContent) return true;
  if (!Array.isArray(richContent)) return false;

  return richContent.every((node: any) => {
    if (!node.children || !Array.isArray(node.children)) return true;

    return node.children.every((child: any) => {
      if (typeof child.text === 'string') {
        return !child.text.trim();
      }
      return false;
    });
  });
};

const RenderingWysiwygEditor = forwardRef<RenderingWysiwygEditorRef, RenderingWysiwygEditorProps>(
  function RenderingWysiwygEditor({
    initialContent = '',
    initialRichContent,
    onChange,
    onSubmit,
    placeholder = "Type your amazing content here..."
  }, ref) {
    // ✅ Compute initial value only once using useMemo
    // This prevents re-computation on every render
    const initialValue = useMemo<Value>(() => {
      if (initialRichContent && !isEditorContentEmpty(initialRichContent)) {
        return initialRichContent;
      }

      const safeContent = typeof initialContent === 'string' ? initialContent : '';
      return createInitialValue(safeContent);
    }, []); // ✅ Empty deps - only compute on mount

    const editor = usePlateEditor({
      plugins: EditorKit,
      value: initialValue,
    });

    useImperativeHandle(ref, () => ({
      resetAndFocus: () => {
        editor.tf.setValue([{ type: 'p', children: [{ text: '' }] }]);
        editor.tf.select({ path: [0, 0], offset: 0 });
        editor.tf.focus();
      },
      focus: () => {
        editor.tf.focus();
      }
    }), [editor]);

    // ✅ Simple onChange handler without side effects
    const handleChange = ({ value }: { value: Value }) => {
      if (onChange) {
        const { text, tags } = extractTextContent(value);

        // Check focus state: editor has selection when focused
        // In Slate.js, selection is null when editor loses focus
        const isFocused = editor.selection !== null;

        onChange({
          text,
          tags,
          richContent: value,
          isEmpty: isEditorContentEmpty(value),
          isFocused,
        });
      }
    };

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
              className="h-full w-full px-8 py-2 outline-none caret-primary select-text selection:bg-brand/25"
              onKeyDown={handleKeyDown}
            />
          </EditorContainer>
        </Plate>
      </div>
    );
  }
);

export default RenderingWysiwygEditor;
