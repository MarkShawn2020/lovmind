'use client';

import { createSlatePlugin } from 'platejs';
import { BaseHashtagPlugin, HASHTAG_KEY } from './hashtag-base-kit';
import { HashtagElement } from '@/components/ui/hashtag-node';

// Plugin to handle hashtag autoformatting on space press
const HashtagAutoformatPlugin = createSlatePlugin({
  key: 'hashtag-autoformat',
  extendEditor: ({ editor }) => {
    const { insertText } = editor;

    editor.insertText = (text: string) => {
      // Only intercept space character
      if (text === ' ') {
        const { selection } = editor;

        if (selection) {
          try {
            const point = selection.anchor;
            const nodeEntry = editor.api.node(point);

            if (nodeEntry) {
              const [node, path] = nodeEntry;

              if (node && typeof node.text === 'string') {
                const textContent = node.text;
                const offset = point.offset;
                const textBeforeCursor = textContent.slice(0, offset);

                // Match hashtag pattern (supports Unicode)
                const hashtagMatch = /#([\p{L}\p{N}_]+)$/u.exec(textBeforeCursor);

                if (hashtagMatch) {
                  const tagValue = hashtagMatch[1];
                  const matchStart = offset - hashtagMatch[0].length;

                  // Delete the #tag text
                  editor.tf.delete({
                    at: { path, offset: matchStart },
                    distance: hashtagMatch[0].length,
                    unit: 'character',
                  });

                  // Insert hashtag followed by space text node
                  // This ensures proper cursor positioning after the hashtag
                  const parentPath = path.slice(0, -1);

                  editor.tf.insertNodes(
                    [
                      {
                        type: HASHTAG_KEY,
                        value: tagValue,
                        children: [{ text: '' }],
                      },
                      { text: ' ' }, // Space as a separate text node
                    ],
                    { at: { path, offset: matchStart }, select: true }
                  );

                  // Selection is now automatically at the end (after the space)
                  return;
                }
              }
            }
          } catch (error) {
            console.error('Error in hashtag autoformat:', error);
          }
        }
      }

      // For all other characters or if hashtag match failed, use original insertText
      (insertText as (text: string) => void)(text);
    };

    return editor;
  },
});

export const HashtagKit = [
  BaseHashtagPlugin.withComponent(HashtagElement),
  HashtagAutoformatPlugin,
];

export { HASHTAG_KEY };
