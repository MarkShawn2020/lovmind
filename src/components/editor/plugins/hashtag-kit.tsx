'use client';

import { createSlatePlugin, createTSlatePlugin, type PluginConfig } from 'platejs';
import {
  type TriggerComboboxPluginOptions,
  withTriggerCombobox,
} from '@platejs/combobox';
import { HASHTAG_KEY, type THashtagElement } from './hashtag-base-kit';
import { HashtagElement } from '@/components/ui/hashtag-node';
import { HashtagInputElement } from '@/components/ui/hashtag-input-node';

export const HASHTAG_INPUT_KEY = 'hashtag_input';

// HashtagInputPlugin - renders the combobox input when # is typed
export const HashtagInputPlugin = createSlatePlugin({
  key: HASHTAG_INPUT_KEY,
  node: {
    isElement: true,
    isInline: true,
    isVoid: true,
  },
}).withComponent(HashtagInputElement);

// Type config for HashtagPlugin
type HashtagConfig = PluginConfig<
  typeof HASHTAG_KEY,
  TriggerComboboxPluginOptions & {
    insertSpaceAfterHashtag?: boolean;
  }
>;

// HashtagPlugin with trigger combobox - triggers on # character
export const HashtagPlugin = createTSlatePlugin<HashtagConfig>({
  key: HASHTAG_KEY,
  node: {
    isElement: true,
    isInline: true,
    isVoid: true,
  },
  options: {
    trigger: '#',
    triggerPreviousCharPattern: /^$|^[\s"']$/,
    createComboboxInput: () => ({
      children: [{ text: '' }],
      type: HASHTAG_INPUT_KEY,
    }),
    insertSpaceAfterHashtag: true,
  },
  plugins: [HashtagInputPlugin],
})
  .overrideEditor(withTriggerCombobox)
  .withComponent(HashtagElement);

export const HashtagKit = [HashtagPlugin];

export { HASHTAG_KEY };

// Helper to create hashtag node
export const createHashtagNode = (value: string): THashtagElement => ({
  type: HASHTAG_KEY,
  value,
  children: [{ text: '' }],
});
