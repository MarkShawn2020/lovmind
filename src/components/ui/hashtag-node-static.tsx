import * as React from 'react';

import type { SlateElementProps } from 'platejs';
import type { THashtagElement } from '@/components/editor/plugins/hashtag-base-kit';

import { SlateElement } from 'platejs';

export function HashtagElementStatic(props: SlateElementProps<THashtagElement>) {
  return (
    <SlateElement
      {...props}
      className="inline-block rounded px-1 align-baseline text-sm font-normal bg-brand/10 text-brand/90 dark:bg-brand/15 dark:text-brand/80"
      attributes={{
        ...props.attributes,
        contentEditable: false,
        'data-slate-value': props.element.value,
      }}
    >
      #{props.element.value}
      {props.children}
    </SlateElement>
  );
}
