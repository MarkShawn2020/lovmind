import { BaseListPlugin } from '@platejs/list';
import type { Editor } from 'platejs';
import { KEYS } from 'platejs';
import { Node } from 'slate';

import { BaseIndentKit } from '@/components/ui/indent-base-kit';
import { BlockListStatic } from '@/components/ui/block-list-static';

export const BaseListKit = [
  ...BaseIndentKit,
  BaseListPlugin.configure({
    inject: {
      targetPlugins: [
        ...KEYS.heading,
        KEYS.p,
        KEYS.blockquote,
        KEYS.codeBlock,
        KEYS.toggle,
      ],
    },
    render: {
      belowNodes: BlockListStatic,
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
        const listItemEntry = (editor as Editor).api.above({
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
          (editor as Editor).tf.insertNodes(
            (editor as Editor).api.create.block({
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
