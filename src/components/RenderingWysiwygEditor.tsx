'use client';

import React, {forwardRef, useEffect, useImperativeHandle, useMemo, useRef} from 'react';
import type {Value} from 'platejs';
import {Plate, usePlateEditor} from 'platejs/react';

import {EditorKitWithoutFixedToolbar} from '@/components/editor/editor-kit';
import {Editor, EditorContainer} from '@/components/ui/editor';
import {FixedToolbar} from '@/components/ui/fixed-toolbar';
import {FixedToolbarButtons} from '@/components/ui/fixed-toolbar-buttons';
import {HASHTAG_KEY} from '@/components/editor/plugins/hashtag-kit';
import type {THashtagElement} from '@/components/editor/plugins/hashtag-base-kit';
import {EditorContextMenu} from '@/components/editor/EditorContextMenu';
import {extractTextContent} from "@/utils/extract-text-content.ts";
import {isEditorContentEmpty} from "@/utils/is-editor-content-empty.ts";
import {createInitialValue} from "@/utils/create-initial-value.ts";

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
    const editorContainerRef = useRef<HTMLDivElement>(null);

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

    // Helpers to reason about Slate shadow input + event scope
    const isSlateShadowInput = (node: EventTarget | null): node is HTMLElement => {
      return !!(node && node instanceof HTMLElement && node.classList.contains('slate-shadow-input'));
    };

    const isEventFromEditor = (event: Event): boolean => {
      const container = editorContainerRef.current;
      if (!container) return false;

      const targetNode = event.target instanceof Node ? event.target : null;
      const activeElement = document.activeElement;

      const targetInside = targetNode ? container.contains(targetNode) : false;
      const activeInside = activeElement ? container.contains(activeElement) : false;

      return targetInside || activeInside || isSlateShadowInput(targetNode) || isSlateShadowInput(activeElement);
    };

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

    // Force Cmd/Ctrl+A to select the Plate editor content even when the shadow
    // input temporarily grabs focus (Tauri on macOS issue)
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!event || !(event.metaKey || event.ctrlKey)) return;
        if (event.key.toLowerCase() !== 'a') return;
        if (!isEventFromEditor(event)) return;

        event.preventDefault();

        const startPoint = editor.api.start([]);
        const endPoint = editor.api.end([]);

        if (startPoint && endPoint) {
          const fullRange = editor.api.range(startPoint, endPoint);
          editor.tf.select(fullRange);
          editor.tf.focus({ edge: 'start' });
        }
      };

      document.addEventListener('keydown', handleKeyDown, true);
      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }, [editor]);

    // Clipboard handling: let Plate serialize the fragment, then mirror that
    // data to the Tauri system clipboard. In browser mode we stay passive.
    useEffect(() => {
      const isTauri = '__TAURI_INTERNALS__' in window || 'isTauri' in window;

      const handleCopy = async (e: ClipboardEvent) => {
        if (!isEventFromEditor(e)) return;

        if (!isTauri) {
          return;
        }

        // Ensure we have a Slate selection – Cmd+A can temporarily collapse it.
        if (!editor.selection) {
          return;
        }

        const { anchor, focus } = editor.selection;
        const isCollapsed =
          anchor.path.toString() === focus.path.toString() &&
          anchor.offset === focus.offset;

        if (isCollapsed) {
          return;
        }

        setTimeout(async () => {
          try {
            if (!e.clipboardData) {
              return;
            }

            const htmlData = e.clipboardData.getData('text/html');
            const textData = e.clipboardData.getData('text/plain');

            if (textData || htmlData) {
              const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
              await writeText(textData || htmlData);
            }
          } catch (error) {
            console.error('[Clipboard] Failed to mirror copy:', error);
          }
        }, 0);
      };

      const handleCut = async (e: ClipboardEvent) => {
        if (!isEventFromEditor(e)) return;
        if (!isTauri) return;

        setTimeout(async () => {
          try {
            if (!e.clipboardData) return;

            const textData = e.clipboardData.getData('text/plain');
            const htmlData = e.clipboardData.getData('text/html');

            if (textData || htmlData) {
              const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
              await writeText(textData || htmlData);
            }
          } catch (error) {
            console.error('[Clipboard] Failed to mirror cut:', error);
          }
        }, 0);
      };

      const handlePaste = async (e: ClipboardEvent) => {
        if (!isEventFromEditor(e)) return;
        if (!isTauri) return;

        e.preventDefault();

        try {
          const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
          const text = await readText();

          if (text) {
            editor.tf.insertText(text);
          }
        } catch (error) {
          console.error('[Clipboard] Failed to paste from Tauri clipboard:', error);
        }
      };

      document.addEventListener('copy', handleCopy);
      document.addEventListener('cut', handleCut);
      document.addEventListener('paste', handlePaste);

      return () => {
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('cut', handleCut);
        document.removeEventListener('paste', handlePaste);
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
          <EditorContextMenu editor={editor}>
            <EditorContainer ref={editorContainerRef} className="relative overflow-auto">
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
      </Plate>
    );
  }
);

export default RenderingWysiwygEditor;
