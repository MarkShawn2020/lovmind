'use client';

import React, { useImperativeHandle, forwardRef, useMemo, useRef, useEffect } from 'react';
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

export type InputStateReason =
  | 'typing-start'      // User started typing
  | 'typing-stop'       // User stopped typing (debounced)
  | 'composition-start' // IME input began
  | 'composition-end'   // IME input ended
  | 'focus-lost'        // Editor lost focus
  | 'focus-only';       // Editor focused but no typing yet

export interface EditorContentChange {
  text: string;
  tags: string[];
  richContent: Value;
  isEmpty: boolean;
  isFocused: boolean;
  isInputting: boolean;
  inputStateReason: InputStateReason;
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

    // Track if content has been loaded (non-empty)
    const hasLoadedContentRef = useRef(false);

    // ✅ Update editor content when initialContent/initialRichContent changes
    // This handles the case where FloatWindow loads note data asynchronously
    useEffect(() => {
      // Skip if content was already loaded
      if (hasLoadedContentRef.current) return;

      // 🎯 CRITICAL: Always prioritize richContent over text
      // richContent preserves rich formatting (images, styles, etc.)
      // text is just a markdown fallback
      const hasRichContent = initialRichContent && !isEditorContentEmpty(initialRichContent);
      const hasTextContent = initialContent && typeof initialContent === 'string' && initialContent.trim();

      console.log('[RenderingWysiwygEditor] Content update check:', {
        hasRichContent,
        hasTextContent,
        initialRichContent: initialRichContent ? JSON.stringify(initialRichContent).substring(0, 200) : null,
        initialContent: initialContent ? initialContent.substring(0, 100) : null,
      });

      // Only proceed if we have ANY content to load
      if (!hasRichContent && !hasTextContent) return;

      // ✅ Priority: richContent > text
      const newValue = hasRichContent
        ? initialRichContent!
        : createInitialValue(initialContent);

      // Only update if the value is actually different
      if (JSON.stringify(editor.children) !== JSON.stringify(newValue)) {
        console.log('[RenderingWysiwygEditor] Loading async content into editor:', {
          usingRichContent: hasRichContent,
          newValuePreview: JSON.stringify(newValue).substring(0, 200),
        });
        editor.tf.setValue(newValue);
        hasLoadedContentRef.current = true;
      }
    }, [initialContent, initialRichContent, editor]);

    // ✅ Track the editor container ref to check DOM focus
    const editorContainerRef = useRef<HTMLDivElement>(null);

    // Input state tracking
    const isComposingRef = useRef(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastInputStateRef = useRef<{ isInputting: boolean; reason: InputStateReason }>({
      isInputting: false,
      reason: 'focus-lost',
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

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }, []);

    // ✅ onChange handler with input state tracking
    const handleChange = ({ value }: { value: Value }) => {
      if (onChange) {
        const { text, tags } = extractTextContent(value);

        // Check focus state with a hybrid approach:
        // 1. Slate selection check: editor.selection !== null
        // 2. DOM focus check: does the editor container have focus?
        // This prevents false "focus lost" during programmatic operations
        const slateHasFocus = editor.selection !== null;
        const domHasFocus = editorContainerRef.current?.contains(document.activeElement) ?? false;

        // Consider focused if either Slate OR DOM indicates focus
        // This handles cases where Slate temporarily clears selection during node operations
        const isFocused = slateHasFocus || domHasFocus;

        // Determine input state and reason
        let isInputting = false;
        let inputStateReason: InputStateReason = 'focus-lost';

        if (!isFocused) {
          // Editor lost focus
          isInputting = false;
          inputStateReason = 'focus-lost';

          // Clear any pending typing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
        } else if (isComposingRef.current) {
          // IME composition active
          isInputting = true;
          inputStateReason = 'composition-start';
        } else {
          // Editor is focused and not composing
          // User is typing if onChange was triggered by user input
          isInputting = true;
          inputStateReason = 'typing-start';

          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          // Set timeout to detect when user stops typing
          typingTimeoutRef.current = setTimeout(() => {
            if (onChange) {
              const currentState = lastInputStateRef.current;

              // Only emit if state changed
              if (currentState.isInputting) {
                lastInputStateRef.current = {
                  isInputting: false,
                  reason: 'typing-stop',
                };

                // Re-extract current content
                const { text: currentText, tags: currentTags } = extractTextContent(editor.children as Value);

                onChange({
                  text: currentText,
                  tags: currentTags,
                  richContent: editor.children as Value,
                  isEmpty: isEditorContentEmpty(editor.children as Value),
                  isFocused: editor.selection !== null,
                  isInputting: false,
                  inputStateReason: 'typing-stop',
                });
              }
            }
          }, 1000); // 1 second debounce
        }

        // Update state tracking
        lastInputStateRef.current = { isInputting, reason: inputStateReason };

        onChange({
          text,
          tags,
          richContent: value,
          isEmpty: isEditorContentEmpty(value),
          isFocused,
          isInputting,
          inputStateReason,
        });
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSubmit?.();
      }
    };

    // Composition event handlers for IME input (Chinese, Japanese, Korean, etc.)
    const handleCompositionStart = () => {
      isComposingRef.current = true;

      // Clear typing timeout when composition starts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;

      // Trigger a state update with composition-end reason
      if (onChange && editor.selection !== null) {
        const { text, tags } = extractTextContent(editor.children as Value);

        lastInputStateRef.current = {
          isInputting: true,
          reason: 'composition-end',
        };

        onChange({
          text,
          tags,
          richContent: editor.children as Value,
          isEmpty: isEditorContentEmpty(editor.children as Value),
          isFocused: true,
          isInputting: true,
          inputStateReason: 'composition-end',
        });

        // Set timeout to detect when user stops typing after composition
        typingTimeoutRef.current = setTimeout(() => {
          if (onChange && lastInputStateRef.current.isInputting) {
            lastInputStateRef.current = {
              isInputting: false,
              reason: 'typing-stop',
            };

            const { text: currentText, tags: currentTags } = extractTextContent(editor.children as Value);

            onChange({
              text: currentText,
              tags: currentTags,
              richContent: editor.children as Value,
              isEmpty: isEditorContentEmpty(editor.children as Value),
              isFocused: editor.selection !== null,
              isInputting: false,
              inputStateReason: 'typing-stop',
            });
          }
        }, 1000);
      }
    };

    return (
      <div className="h-full w-full flex flex-col">
        <Plate editor={editor} onChange={handleChange}>
          <EditorContainer ref={editorContainerRef} className="h-full w-full flex flex-col flex-1">
            <Editor
              placeholder={placeholder}
              variant="none"
              className="h-full w-full px-8 py-2 outline-none caret-primary select-text selection:bg-brand/25"
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
            />
          </EditorContainer>
        </Plate>
      </div>
    );
  }
);

export default RenderingWysiwygEditor;
