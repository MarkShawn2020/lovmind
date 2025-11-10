'use client';

import * as React from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement, useFocused, useReadOnly, useSelected } from 'platejs/react';
import { cn } from '@/lib/utils';
import type { THashtagElement } from '@/components/editor/plugins/hashtag-base-kit';

export function HashtagElement(props: PlateElementProps<THashtagElement>) {
  const element = props.element;
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();

  return (
    <PlateElement
      {...props}
      className={cn(
        'inline-block rounded px-1 align-baseline text-sm font-normal',
        'bg-brand/10 text-brand/90 dark:bg-brand/15 dark:text-brand/80',
        !readOnly && 'cursor-pointer hover:bg-brand/15 dark:hover:bg-brand/20',
        selected && focused && 'ring-1 ring-brand/40'
      )}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        'data-slate-value': element.value,
      }}
    >
      #{element.value}
      {props.children}
    </PlateElement>
  );
}
