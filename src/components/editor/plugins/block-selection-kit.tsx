'use client';

import { AIChatPlugin } from '@platejs/ai/react';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import {
  createSlatePlugin,
  getPluginTypes,
  isHotkey,
  KEYS,
  PathApi,
  type Path,
  type TElement,
  type TText,
} from 'platejs';
import { ReactEditor } from 'slate-react';

import { BlockSelection } from '@/components/ui/block-selection';

// Helper function to extract text from Slate nodes
function getNodeString(node: any): string {
  if ('text' in node) {
    return (node as TText).text;
  }

  if ('children' in node) {
    return (node as TElement).children
      .map((child) => getNodeString(child))
      .join('');
  }

  return '';
}

const BlockSelectionDragPlugin = createSlatePlugin({
  key: 'block-selection-drag',
  extendEditor: ({ editor }) => {
    if (typeof window === 'undefined') return editor;
    if ((editor as any).__blockSelectionDragInitialized) return editor;

    (editor as any).__blockSelectionDragInitialized = true;

    const state = {
      startedInEditor: false,
      hasTriggered: false,
      anchorPath: null as Path | null,
      lastFocusPath: null as Path | null,
    };

    let rafId: number | null = null;

    const getEditableElement = (): HTMLElement | null => {
      try {
        return editor.api.toDOMNode(editor) as HTMLElement;
      } catch {
        return null;
      }
    };

    const getSlateRangeFromDomSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return null;
      }

      try {
        const domRange = selection.getRangeAt(0);
        return ReactEditor.toSlateRange(editor as any, domRange, {
          exactMatch: false,
          suppressThrow: true,
        });
      } catch {
        return null;
      }
    };

    const getBlockEntryFromSelection = () => {
      const slateRange =
        (editor.selection && !editor.api.isCollapsed()
          ? editor.selection
          : null) || getSlateRangeFromDomSelection();

      if (!slateRange) return null;

      const anchorBlock = editor.api.block({ at: slateRange.anchor });
      const focusBlock = editor.api.block({ at: slateRange.focus });

      if (!anchorBlock || !focusBlock) return null;

      return { anchorBlock, focusBlock };
    };

    const clearBlockSelection = () => {
      if (!state.hasTriggered) return;

      try {
        const api = editor.getApi(BlockSelectionPlugin).blockSelection;
        api.unselect();
        editor.setOption(BlockSelectionPlugin, 'anchorId', null);
        editor.setOption(BlockSelectionPlugin, 'isSelecting', false);
      } catch {
        // Ignore if plugin API is unavailable
      }

      state.hasTriggered = false;
    };

    const updateBlockSelection = (
      anchorPath: Path,
      focusPath: Path,
      finalize = false
    ) => {
      const blockSelectionApi =
        editor.getApi(BlockSelectionPlugin)?.blockSelection;
      if (!blockSelectionApi) return;

      const targetDepth = Math.min(anchorPath.length, focusPath.length);
      const anchorPathAtDepth = anchorPath.slice(0, targetDepth);
      const focusPathAtDepth = focusPath.slice(0, targetDepth);

      const [startPath, endPath] =
        PathApi.compare(anchorPathAtDepth, focusPathAtDepth) <= 0
          ? [anchorPathAtDepth, focusPathAtDepth]
          : [focusPathAtDepth, anchorPathAtDepth];

      const candidates = editor.api.blocks({
        at: [],
        mode: 'lowest',
        match: (node, path) =>
          !!(node as any).id &&
          path.length === targetDepth &&
          blockSelectionApi.isSelectable(node as TElement, path),
      });

      const blocksInRange = candidates
        .filter(([, path]) => {
          const beforeStart = PathApi.compare(path, startPath) < 0;
          const afterEnd = PathApi.compare(path, endPath) > 0;
          return !beforeStart && !afterEnd;
        })
        .sort(([, pathA], [, pathB]) => PathApi.compare(pathA, pathB));

      if (!blocksInRange || blocksInRange.length <= 1) {
        clearBlockSelection();
        return;
      }

      const ids: string[] = [];
      blocksInRange.forEach(([node]) => {
        const id = (node as any).id as string | undefined;
        if (id && !ids.includes(id)) {
          ids.push(id);
        }
      });

      const prevSelectedIds = editor.getOption(
        BlockSelectionPlugin,
        'selectedIds'
      );
      const hasSameSelection =
        prevSelectedIds &&
        ids.length === prevSelectedIds.size &&
        ids.every((id) => prevSelectedIds.has(id));

      if (!hasSameSelection) {
        blockSelectionApi.setSelectedIds({ ids });
      } else {
        editor.setOption(BlockSelectionPlugin, 'isSelecting', true);
      }

      editor.setOption(BlockSelectionPlugin, 'anchorId', ids[0]);
      state.hasTriggered = true;

      if (finalize) {
        blockSelectionApi.focus();
        const domSelection = window.getSelection();
        domSelection?.removeAllRanges();
      }
    };

    const applyBlockSelectionFromSelection = (finalize = false) => {
      const blockEntry = getBlockEntryFromSelection();
      if (!blockEntry) {
        clearBlockSelection();
        return;
      }

      updateBlockSelection(
        blockEntry.anchorBlock[1],
        blockEntry.focusBlock[1],
        finalize
      );
    };

    const getBlockPathFromEvent = (event: MouseEvent): Path | null => {
      try {
        const range = ReactEditor.findEventRange(editor as any, event);
        const block = editor.api.block({ at: range.anchor });
        if (block) return block[1];
      } catch {
        // ignore and fallback
      }

      const target = event.target as Node;
      if (ReactEditor.hasDOMNode(editor as any, target)) {
        try {
          const slateNode = ReactEditor.toSlateNode(editor as any, target);
          const path = ReactEditor.findPath(editor as any, slateNode);
          const block = editor.api.block({ at: path });
          if (block) return block[1];
        } catch {
          // ignore
        }
      }

      return null;
    };

    const scheduleUpdate = (finalize = false) => {
      if (!state.startedInEditor && !finalize) return;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (state.anchorPath && state.lastFocusPath) {
          updateBlockSelection(state.anchorPath, state.lastFocusPath, finalize);
        } else {
          applyBlockSelectionFromSelection(finalize);
        }
      });
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;

      const editable = getEditableElement();
      if (!editable || !(event.target instanceof Node)) return;
      if (!editable.contains(event.target)) return;

      state.startedInEditor = true;
      state.hasTriggered = false;
      const anchorPath = getBlockPathFromEvent(event);
      state.anchorPath = anchorPath;
      state.lastFocusPath = anchorPath;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!state.startedInEditor) return;
      if (event.buttons !== 1) return;

      const focusPath = getBlockPathFromEvent(event);
      if (focusPath) {
        state.lastFocusPath = focusPath;
      }

      scheduleUpdate(false);
    };

    const handleSelectionChange = () => {
      if (!state.startedInEditor) return;
      scheduleUpdate(false);
    };

    const handleMouseUp = () => {
      if (!state.startedInEditor) return;

      state.startedInEditor = false;
      scheduleUpdate(true);
      requestAnimationFrame(() => {
        state.anchorPath = null;
        state.lastFocusPath = null;
      });
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);

    const cleanup = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    (editor as any).__blockSelectionDragCleanup = cleanup;

    return editor;
  },
});

export const BlockSelectionKit = [
  BlockSelectionPlugin.configure(({ editor }) => ({
    options: {
      enableContextMenu: true,
      isSelectable: (element) => {
        return !getPluginTypes(editor, [
          KEYS.column,
          KEYS.codeLine,
          KEYS.td,
        ]).includes(element.type);
      },
      onKeyDownSelecting: (e) => {
        if (isHotkey('mod+j')(e)) {
          editor.getApi(AIChatPlugin).aiChat.show();
          return;
        }

        // Handle Cmd+C (copy) for block selection
        if (isHotkey('mod+c')(e)) {
          e.preventDefault();

          const selectedBlocks = editor
            .getApi(BlockSelectionPlugin)
            .blockSelection.getNodes();

          if (selectedBlocks.length === 0) return;

          // Extract nodes from the selection (preserve full structure)
          const nodes = selectedBlocks.map(([node]) => node);

          // Serialize to plain text using Slate's built-in method
          const plainText = nodes
            .map((node) => {
              try {
                return getNodeString(node);
              } catch {
                return '';
              }
            })
            .filter(Boolean)
            .join('\n\n');

          // Serialize complete node structure as Slate fragment (preserves ALL properties)
          // This includes: listType, indent, align, and all other metadata
          const slateFragment = JSON.stringify(nodes);
          const encodedFragment = btoa(encodeURIComponent(slateFragment));

          // Create HTML with embedded Slate fragment for maximum compatibility
          const htmlWithFragment = `<div data-slate-fragment="${encodedFragment}">${nodes
            .map((node) => {
              const text = getNodeString(node);
              const type = (node as any).type || 'p';
              return `<${type}>${text}</${type}>`;
            })
            .join('')}</div>`;

          // Copy to clipboard using modern Clipboard API with multiple formats
          if (navigator.clipboard && window.ClipboardItem) {
            const clipboardItem = new ClipboardItem({
              'text/plain': new Blob([plainText], { type: 'text/plain' }),
              'text/html': new Blob([htmlWithFragment], { type: 'text/html' }),
            });

            navigator.clipboard.write([clipboardItem]).catch((err) => {
              console.error('Failed to copy:', err);
              // Fallback to simple text copy
              navigator.clipboard.writeText(plainText);
            });
          } else {
            // Fallback for older browsers
            navigator.clipboard.writeText(plainText);
          }

          return;
        }

        // Handle Cmd+V (paste) for block selection
        if (isHotkey('mod+v')(e)) {
          e.preventDefault();

          // Get clipboard data
          navigator.clipboard.read().then(async (clipboardItems) => {
            try {
              for (const item of clipboardItems) {
                // Try to get HTML first (contains Slate fragment)
                if (item.types.includes('text/html')) {
                  const blob = await item.getType('text/html');
                  const html = await blob.text();

                  // Extract Slate fragment from HTML
                  const fragmentMatch = html.match(/data-slate-fragment="([^"]+)"/);

                  if (fragmentMatch) {
                    // Decode and parse the Slate fragment
                    const encodedFragment = fragmentMatch[1];
                    const decodedFragment = decodeURIComponent(atob(encodedFragment));
                    const nodes = JSON.parse(decodedFragment);

                    // Determine insertion point
                    // If all blocks are selected (Cmd+A scenario), insert at the end
                    const selectedBlocks = editor
                      .getApi(BlockSelectionPlugin)
                      .blockSelection.getNodes();

                    const totalBlocks = editor.children.length;
                    const isAllSelected = selectedBlocks.length === totalBlocks;

                    if (isAllSelected) {
                      // Insert at the end of the document
                      const lastPath = [editor.children.length];

                      editor.tf.withoutNormalizing(() => {
                        // Insert all nodes at once
                        editor.tf.insertNodes(nodes, {
                          at: lastPath,
                          select: false
                        });

                        // Move selection to end of pasted content
                        const newLastPath = [editor.children.length - 1];
                        editor.tf.select(newLastPath);
                        editor.tf.collapse({ edge: 'end' });
                      });
                    } else {
                      // Normal paste at cursor position
                      editor.tf.withoutNormalizing(() => {
                        // Get current cursor position
                        const selection = editor.selection;
                        if (selection) {
                          editor.tf.insertNodes(nodes, {
                            at: selection,
                            select: true
                          });
                        }
                      });
                    }

                    // Clear block selection after paste
                    editor.getApi(BlockSelectionPlugin).blockSelection.unselect();

                    return;
                  }
                }

                // Fallback: paste as plain text if no Slate fragment found
                if (item.types.includes('text/plain')) {
                  const blob = await item.getType('text/plain');
                  const text = await blob.text();

                  // Insert plain text at cursor
                  if (editor.selection) {
                    editor.tf.insertText(text);
                  }
                }
              }
            } catch (err) {
              console.error('Failed to paste:', err);
            }
          }).catch((err) => {
            console.error('Failed to read clipboard:', err);
          });

          return;
        }

        // Handle Cmd+X (cut) for block selection
        if (isHotkey('mod+x')(e)) {
          e.preventDefault();

          const selectedBlocks = editor
            .getApi(BlockSelectionPlugin)
            .blockSelection.getNodes();

          if (selectedBlocks.length === 0) return;

          // Extract nodes for clipboard (preserve full structure)
          const nodes = selectedBlocks.map(([node]) => node);

          // Serialize to plain text
          const plainText = nodes
            .map((node) => {
              try {
                return getNodeString(node);
              } catch {
                return '';
              }
            })
            .filter(Boolean)
            .join('\n\n');

          // Serialize complete node structure as Slate fragment
          const slateFragment = JSON.stringify(nodes);
          const encodedFragment = btoa(encodeURIComponent(slateFragment));

          // Create HTML with embedded Slate fragment
          const htmlWithFragment = `<div data-slate-fragment="${encodedFragment}">${nodes
            .map((node) => {
              const text = getNodeString(node);
              const type = (node as any).type || 'p';
              return `<${type}>${text}</${type}>`;
            })
            .join('')}</div>`;

          // Copy to clipboard
          if (navigator.clipboard && window.ClipboardItem) {
            const clipboardItem = new ClipboardItem({
              'text/plain': new Blob([plainText], { type: 'text/plain' }),
              'text/html': new Blob([htmlWithFragment], { type: 'text/html' }),
            });

            navigator.clipboard.write([clipboardItem]).catch((err) => {
              console.error('Failed to cut:', err);
              navigator.clipboard.writeText(plainText);
            });
          } else {
            navigator.clipboard.writeText(plainText);
          }

          // Remove the selected blocks
          editor
            .getTransforms(BlockSelectionPlugin)
            .blockSelection.removeNodes();

          return;
        }
      },
    },
    render: {
      belowRootNodes: (props) => {
        if (!props.attributes.className?.includes('slate-selectable'))
          return null;

        return <BlockSelection {...(props as any)} />;
      },
    },
  })),
  BlockSelectionDragPlugin,
];
