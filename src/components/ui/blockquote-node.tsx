'use client';

import { type PlateElementProps, PlateElement } from 'platejs/react';

export function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      className="my-1 border-l-2 pl-6 italic transition-all hover:border-l-4 hover:bg-muted/30 hover:rounded-r-md"
      {...props}
    />
  );
}
