'use client';

import React, { useImperativeHandle, forwardRef, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKitWithoutFixedToolbar } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { FixedToolbarButtons } from '@/components/ui/fixed-toolbar-buttons';
import { HASHTAG_KEY } from '@/components/editor/plugins/hashtag-kit';
import type { THashtagElement } from '@/components/editor/plugins/hashtag-base-kit';
import { EditorContextMenu } from '@/components/editor/EditorContextMenu';

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
  insertTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  renameTag: (oldTag: string, newTag: string) => void;
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

  // Empty editor = only one block + that block contains only empty text nodes + no other node types
  if (richContent.length === 0) return true;
  if (richContent.length > 1) return false;  // Multiple blocks = has content

  const singleNode = richContent[0];

  // Check node type: non-paragraph types = has content (e.g., image, heading, etc.)
  if (singleNode.type && singleNode.type !== 'p') return false;

  // Check children
  if (!singleNode.children || !Array.isArray(singleNode.children)) return true;

  // All children must be empty text nodes (no element nodes)
  return singleNode.children.every((child: any) => {
    // Element node (has type property) = has content
    if (child.type) return false;
    // Text node: check if empty
    if (typeof child.text === 'string') return !child.text.trim();
    // Other cases: treat as having content
    return false;
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
      plugins: EditorKitWithoutFixedToolbar,
      value: initialValue,
    });

    // Track if content has been loaded (non-empty)
    const hasLoadedContentRef = useRef(false);

    // ✅ Update editor content when initialContent/initialRichContent changes
    // This handles the case where FloatWindow loads note data asynchronously
    useEffect(() => {
      // Skip if content was already loaded
      if (hasLoadedContentRef.current) return;

      const hasRichContent = initialRichContent && !isEditorContentEmpty(initialRichContent);
      const hasTextContent = initialContent && typeof initialContent === 'string' && initialContent.trim();

      if (hasRichContent || hasTextContent) {
        const newValue = hasRichContent
          ? initialRichContent!
          : createInitialValue(initialContent);

        // Only update if the value is actually different
        if (JSON.stringify(editor.children) !== JSON.stringify(newValue)) {
          console.log('[RenderingWysiwygEditor] Loading async content into editor');
          editor.tf.setValue(newValue);
          hasLoadedContentRef.current = true;
        }
      }
    }, [initialContent, initialRichContent, editor]);

    // ✅ Track the editor container ref to check DOM focus
    const editorContainerRef = useRef<HTMLDivElement | null>(null);
    const [contextMenuTarget, setContextMenuTarget] = React.useState<HTMLDivElement | null>(null);
    const setEditorContainerNode = useCallback((node: HTMLDivElement | null) => {
      editorContainerRef.current = node;
      setContextMenuTarget(node);
    }, []);

    // Input state tracking
    const isComposingRef = useRef(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastInputStateRef = useRef<{ isInputting: boolean; reason: InputStateReason }>({
      isInputting: false,
      reason: 'focus-lost',
    });

    // Auto-save toast state
    const [showAutoSaveToast, setShowAutoSaveToast] = React.useState(false);
    const autoSaveToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useImperativeHandle(ref, () => ({
      resetAndFocus: () => {
        const emptyValue = [{ type: 'p', children: [{ text: '' }] }];
        editor.tf.setValue(emptyValue);

        // Delay selection to ensure DOM is updated and plugins are ready
        requestAnimationFrame(() => {
          try {
            editor.tf.select({ path: [0, 0], offset: 0 });
            editor.tf.focus();
          } catch (error) {
            console.error('[RenderingWysiwygEditor] Failed to set selection after reset:', error);
            // Fallback: just focus
            editor.tf.focus();
          }
        });
      },
      focus: () => {
        editor.tf.focus();
      },
      insertTag: (tag: string) => {
        // Insert hashtag at cursor position or end of document
        try {
          const { selection } = editor;

          // If no selection, insert at the end of the last node
          if (!selection) {
            const lastPath = [editor.children.length - 1];
            editor.tf.select(editor.api.end(lastPath));
          }

          editor.tf.insertNodes(
            [
              { text: ' ' }, // Leading space
              {
                type: HASHTAG_KEY,
                value: tag,
                children: [{ text: '' }],
              },
              { text: ' ' }, // Trailing space
            ],
            { select: true }
          );

          editor.tf.focus();
        } catch (error) {
          console.error('[RenderingWysiwygEditor] Failed to insert tag:', error);
        }
      },
      removeTag: (tag: string) => {
        // Find and remove all instances of this hashtag
        try {
          const nodes = Array.from(
            editor.api.nodes({
              at: [],
              match: (n: any) => n.type === HASHTAG_KEY && n.value === tag,
            })
          );

          // Remove in reverse order to maintain valid paths
          for (let i = nodes.length - 1; i >= 0; i--) {
            const [, path] = nodes[i];
            editor.tf.removeNodes({ at: path });
          }

          editor.tf.focus();
        } catch (error) {
          console.error('[RenderingWysiwygEditor] Failed to remove tag:', error);
        }
      },
      renameTag: (oldTag: string, newTag: string) => {
        // Find all instances of the old hashtag and update their value
        try {
          const nodes = Array.from(
            editor.api.nodes({
              at: [],
              match: (n: any) => n.type === HASHTAG_KEY && n.value === oldTag,
            })
          );

          // If new tag already exists, remove old tag instances (merge strategy)
          const hasNewTag = editor.api.some({
            at: [],
            match: (n: any) => n.type === HASHTAG_KEY && n.value === newTag,
          });

          if (hasNewTag) {
            // Merge: just remove old tag instances
            for (let i = nodes.length - 1; i >= 0; i--) {
              const [, path] = nodes[i];
              editor.tf.removeNodes({ at: path });
            }
          } else {
            // Rename: update value of all old tag instances
            for (const [node, path] of nodes) {
              editor.tf.setNodes(
                { value: newTag } as Partial<THashtagElement>,
                { at: path }
              );
            }
          }

          editor.tf.focus();
        } catch (error) {
          console.error('[RenderingWysiwygEditor] Failed to rename tag:', error);
        }
      }
    }), [editor]);

    // Cleanup timeouts on unmount
    useEffect(() => {
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        if (autoSaveToastTimeoutRef.current) {
          clearTimeout(autoSaveToastTimeoutRef.current);
        }
      };
    }, []);

    // Handle keyboard shortcuts in Tauri (PredefinedMenuItem removed to let frontend handle)
    useEffect(() => {
      const selectDomRange = () => {
        if (typeof window === 'undefined') return;
        const container = editorContainerRef.current;
        if (!container) return;
        const editorRoot = container.querySelector('[data-slate-editor="true"]') as HTMLElement | null;
        if (!editorRoot) return;

        const selection = window.getSelection?.();
        if (!selection) return;

        const range = document.createRange();
        range.selectNodeContents(editorRoot);
        selection.removeAllRanges();
        selection.addRange(range);
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        // Check if the event target is within the editor
        const target = e.target as HTMLElement;
        if (!editorContainerRef.current?.contains(target)) {
          return; // Not our editor, ignore
        }

        const isMod = e.metaKey || e.ctrlKey;

        // Handle Cmd+A (Select All) - prevent shadow input issue
        if (isMod && e.key === 'a') {
          e.preventDefault();
          try {
            const startPoint = editor.api.start([]);
            const endPoint = editor.api.end([]);
            if (startPoint && endPoint) {
              editor.tf.select(editor.api.range(startPoint, endPoint));
              editor.tf.focus();
            }
          } catch (error) {
            console.error('[SelectAll] Failed:', error);
          }
          selectDomRange();
          return;
        }

        // Handle Cmd+C/X/V - trigger browser commands, let Plate.js handle serialization
        if (isMod && (e.key === 'c' || e.key === 'x' || e.key === 'v')) {
          // Don't prevent default - let Plate.js handle it through copy/cut/paste events
          // But Tauri WebView doesn't fire these events, so we manually trigger them
          e.preventDefault();

          if (e.key === 'c') {
            document.execCommand('copy');
          } else if (e.key === 'x') {
            document.execCommand('cut');
          } else if (e.key === 'v') {
            document.execCommand('paste');
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [editor]);

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
      // Cmd+Enter / Ctrl+Enter: Submit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSubmit?.();
        return;
      }

      // Cmd+S / Ctrl+S: Show auto-save toast
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();

        // Show toast
        setShowAutoSaveToast(true);

        // Clear existing timeout
        if (autoSaveToastTimeoutRef.current) {
          clearTimeout(autoSaveToastTimeoutRef.current);
        }

        // Auto-hide after 2 seconds
        autoSaveToastTimeoutRef.current = setTimeout(() => {
          setShowAutoSaveToast(false);
        }, 2000);
        return;
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
      <Plate editor={editor} onChange={handleChange}>
        <div className="h-full w-full grid grid-rows-[auto_1fr]">
          {/* Row 1: Fixed Toolbar Area */}
          <FixedToolbar>
            <FixedToolbarButtons />
          </FixedToolbar>

          {/* Row 2: Content Area with Toast */}
          <div ref={setEditorContainerNode} className="relative h-full w-full">
            <EditorContextMenu editor={editor} targetElement={contextMenuTarget}>
              <EditorContainer className="relative overflow-auto">
                <Editor
                  placeholder={placeholder}
                  variant="none"
                  className="h-full w-full px-8 py-2 outline-none caret-primary select-text selection:bg-brand/25"
                  onKeyDown={handleKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                >
                  {/* Auto-save toast - fixed positioning below header to stay visible when scrolled */}
                  {showAutoSaveToast && (
                    <div
                      className="fixed top-[68px] right-2 z-50 px-3 py-1.5 bg-background/95 backdrop-blur-sm border border-border/40 rounded-md shadow-sm text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200 pointer-events-none"
                      role="status"
                      aria-live="polite"
                    >
                      已自动保存
                    </div>
                  )}
                </Editor>
              </EditorContainer>
            </EditorContextMenu>
          </div>
        </div>
      </Plate>
    );
  }
);

export default RenderingWysiwygEditor;
