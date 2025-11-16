'use client';

import { createSlatePlugin } from 'platejs';
import { BaseHashtagPlugin, HASHTAG_KEY } from './hashtag-base-kit';
import { HashtagElement } from '@/components/ui/hashtag-node';

// Plugin to handle hashtag autoformatting on space/enter press
const HashtagAutoformatPlugin = createSlatePlugin({
  key: 'hashtag-autoformat',
  extendEditor: ({ editor }) => {
    const { insertText, insertBreak } = editor;

    // Shared logic to convert #tag to hashtag element
    const tryConvertHashtag = (): boolean => {
      const { selection } = editor;

      if (!selection) return false;

      try {
        const point = selection.anchor;
        const nodeEntry = editor.api.node(point);

        if (!nodeEntry) return false;

        const [node, path] = nodeEntry;

        if (!node || typeof node.text !== 'string') return false;

        const textContent = node.text;
        const offset = point.offset;
        const textBeforeCursor = textContent.slice(0, offset);

        // Match hashtag pattern (supports Unicode and hyphen)
        const hashtagMatch = /#([\p{L}\p{N}_-]+)$/u.exec(textBeforeCursor);

        if (!hashtagMatch) return false;

        const tagValue = hashtagMatch[1];
        const matchStart = offset - hashtagMatch[0].length;

        // Delete the #tag text
        editor.tf.delete({
          at: { path, offset: matchStart },
          distance: hashtagMatch[0].length,
          unit: 'character',
        });

        // Insert hashtag followed by space text node
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

        return true;
      } catch (error) {
        console.error('Error in hashtag autoformat:', error);
        return false;
      }
    };

    // Intercept space character
    editor.insertText = (text: string) => {
      if (text === ' ' && tryConvertHashtag()) {
        return;
      }

      // For all other characters or if hashtag match failed, use original insertText
      (insertText as (text: string) => void)(text);
    };

    // Intercept enter key - same behavior as space
    editor.insertBreak = () => {
      if (tryConvertHashtag()) {
        return;
      }

      // If no hashtag conversion, proceed with normal line break
      (insertBreak as () => void)();
    };

    return editor;
  },
});

export const HashtagKit = [
  BaseHashtagPlugin.withComponent(HashtagElement),
  HashtagAutoformatPlugin,
];

export { HASHTAG_KEY };
