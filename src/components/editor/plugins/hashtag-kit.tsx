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
      if (text === ' ') {
        const { selection } = editor;
        if (selection) {
          try {
            // Get text before cursor
            const point = selection.anchor;
            const nodeEntry = editor.api.node(point);

            if (nodeEntry) {
              const [node, path] = nodeEntry;

              if (node && typeof node.text === 'string') {
                const textContent = node.text;
                const offset = point.offset;
                const textBeforeCursor = textContent.slice(0, offset);

                // Match hashtag pattern at the end (supports Unicode characters including Chinese)
                // Using \p{L} for Unicode letters, \p{N} for numbers, and \p{M} for combining marks
                const hashtagMatch = /#([\p{L}\p{N}_]+)$/u.exec(textBeforeCursor);

                if (hashtagMatch) {
                  const tagValue = hashtagMatch[1];
                  const matchStart = offset - hashtagMatch[0].length;

                  // Delete the #tag text
                  editor.tf.delete({
                    at: {
                      path,
                      offset: matchStart,
                    },
                    distance: hashtagMatch[0].length,
                    unit: 'character',
                  });

                  // Insert hashtag element
                  editor.tf.insertNodes(
                    {
                      type: HASHTAG_KEY,
                      value: tagValue,
                      children: [{ text: '' }],
                    },
                    {
                      at: {
                        path,
                        offset: matchStart,
                      },
                    }
                  );

                  // Move cursor after the hashtag and insert space
                  editor.tf.move({ distance: 1, unit: 'offset' });
                  editor.tf.insertText(' ');

                  // Ensure editor retains focus
                  setTimeout(() => {
                    editor.tf.focus();
                  }, 0);

                  return;
                }
              }
            }
          } catch (error) {
            console.error('Error in hashtag autoformat:', error);
          }
        }
      }

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
