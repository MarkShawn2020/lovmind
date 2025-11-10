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
        'inline-block rounded-md bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 align-baseline text-sm font-medium text-blue-700 dark:text-blue-300',
        !readOnly && 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50',
        selected && focused && 'ring-2 ring-blue-500'
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
