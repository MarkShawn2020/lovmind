'use client';

import { ListPlugin } from '@platejs/list/react';
import type { PlateEditor } from 'platejs/react';
import { KEYS } from 'platejs';
import { Node, Range, Point } from 'slate';

import { IndentKit } from '@/components/editor/plugins/indent-kit';
import { BlockList } from '@/components/ui/block-list';

export const ListKit = [
  ...IndentKit,
  ListPlugin.configure({
    inject: {
      targetPlugins: [
        ...KEYS.heading,
        KEYS.p,
        KEYS.blockquote,
        KEYS.codeBlock,
        KEYS.toggle,
        KEYS.img,
      ],
    },
    render: {
      belowNodes: BlockList,
    },
    rules: {
      // Reset list to paragraph when backspace at start
      delete: { start: 'reset' },
    },
    handlers: {
      onKeyDown: ({ editor, event }) => {
        // Only handle Backspace
        if (event.key !== 'Backspace') return;

        const { selection } = editor;
        if (!selection || !Range.isCollapsed(selection)) return;

        // Check if in list item
        const listItemEntry = (editor as PlateEditor).api.above({
          match: (n: any) => !!n.listStyleType,
        });
        if (!listItemEntry) return;

        const [, listItemPath] = listItemEntry;

        // Check if cursor is at start of this list item
        const blockStart = (editor as PlateEditor).api.start(listItemPath);
        if (!blockStart || !Point.equals(selection.anchor, blockStart)) return;

        // Check if this is the first block (no previous sibling)
        const prevEntry = (editor as PlateEditor).api.previous({
          at: listItemPath,
        });

        // If there's a previous block, let default behavior handle it
        if (prevEntry) return;

        // First block + at start + is list item: reset to paragraph
        event.preventDefault();
        (editor as PlateEditor).tf.setNodes({
          type: KEYS.p,
          listStyleType: undefined,
          listStart: undefined,
          indent: undefined,
          checked: undefined,
        });
      },
    },
    extendEditor: ({ editor }) => {
      const { insertBreak } = editor;
      const originalInsertBreak = insertBreak as () => void;

      editor.insertBreak = () => {
        const { selection } = editor;

        if (!selection) {
          return originalInsertBreak();
        }

        // Check if we're in a list item (identified by listStyleType property)
        const listItemEntry = (editor as PlateEditor).api.above({
          match: (n: any) => !!n.listStyleType,
        });

        if (!listItemEntry) {
          return originalInsertBreak();
        }

        const [listItem] = listItemEntry;

        // Check if the list item is empty
        const isEmpty = Node.string(listItem).trim() === '';

        if (isEmpty) {
          const indent = (listItem as any).indent || 1;

          if (indent > 1) {
            // Outdent: decrease indent by 1 (go to parent level)
            (editor as PlateEditor).tf.setNodes({
              indent: indent - 1,
            });
          } else {
            // At top level: convert to paragraph (remove list properties)
            (editor as PlateEditor).tf.setNodes({
              listStyleType: undefined,
              listStart: undefined,
              indent: undefined,
              checked: undefined,
            });
          }
          return;
        }

        return originalInsertBreak();
      };

      return editor;
    },
  }),
];
