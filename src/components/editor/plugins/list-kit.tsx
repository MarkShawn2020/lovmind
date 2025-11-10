'use client';

import { ListPlugin } from '@platejs/list/react';
import type { PlateEditor } from 'platejs/react';
import { KEYS } from 'platejs';
import { Node } from 'slate';

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
    extendEditor: ({ editor }) => {
      const { insertBreak } = editor;
      const originalInsertBreak = insertBreak as () => void;

      editor.insertBreak = () => {
        const { selection } = editor;

        if (!selection) {
          return originalInsertBreak();
        }

        // Check if we're in a list item
        const listItemEntry = (editor as PlateEditor).api.above({
          match: (n: any) => n.type === KEYS.li,
        });

        if (!listItemEntry) {
          return originalInsertBreak();
        }

        const [listItem] = listItemEntry;

        // Check if the list item is empty
        const isEmpty = Node.string(listItem).trim() === '';

        if (isEmpty) {
          // Instead of converting to paragraph, insert a new empty list item
          (editor as PlateEditor).tf.insertNodes(
            (editor as PlateEditor).api.create.block({
              type: KEYS.li,
              indent: (listItem as any).indent,
              listStyleType: (listItem as any).listStyleType,
            })
          );
          return;
        }

        return originalInsertBreak();
      };

      return editor;
    },
  }),
];
