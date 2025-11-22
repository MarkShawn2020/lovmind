'use client';

import { AIChatPlugin } from '@platejs/ai/react';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { getPluginTypes, isHotkey, KEYS, type TElement, type TText } from 'platejs';

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
];
