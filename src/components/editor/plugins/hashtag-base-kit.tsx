'use client';

import { createSlatePlugin, type TElement } from 'platejs';

export const HASHTAG_KEY = 'hashtag' as const;

export interface THashtagElement extends TElement {
  type: typeof HASHTAG_KEY;
  value: string;
  children: [{ text: '' }];
  [key: string]: unknown;
}

// Base hashtag plugin
export const BaseHashtagPlugin = createSlatePlugin({
  key: HASHTAG_KEY,
  node: {
    isElement: true,
    isInline: true,
    isVoid: false,
  },
});

export const BaseHashtagKit = [BaseHashtagPlugin];
