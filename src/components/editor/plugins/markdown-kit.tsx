import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import { KEYS } from 'platejs';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { HASHTAG_KEY } from './hashtag-base-kit';
import type { THashtagElement } from './hashtag-base-kit';

export const MarkdownKit = [
  MarkdownPlugin.configure({
    options: {
      disallowedNodes: [KEYS.suggestion],
      remarkPlugins: [remarkMath, remarkGfm, remarkMdx, remarkMention],
      // Custom serialization rules for Hashtag elements
      rules: {
        [HASHTAG_KEY]: {
          serialize: (node: THashtagElement) => {
            // Serialize hashtag as MDX text element to preserve it as #tag
            return {
              type: 'mdxJsxTextElement' as const,
              name: 'hashtag',
              attributes: [
                {
                  type: 'mdxJsxAttribute' as const,
                  name: 'value',
                  value: node.value,
                },
              ],
              children: [{ type: 'text' as const, value: `#${node.value}` }],
            };
          },
        },
      },
    },
  }),
];
