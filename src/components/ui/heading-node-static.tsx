import * as React from 'react';

import type { SlateElementProps } from 'platejs';

import { type VariantProps, cva } from 'class-variance-authority';
import { SlateElement } from 'platejs';

const headingVariants = cva('relative mb-1', {
  variants: {
    variant: {
      h1: 'mt-[1em] pb-0.5 font-heading text-2xl font-bold md:mt-[1.1em] md:pb-0.5 md:text-3xl',
      h2: 'mt-[0.9em] pb-px font-heading text-xl font-semibold tracking-tight md:mt-[1em] md:text-2xl',
      h3: 'mt-[0.75em] pb-px font-heading text-lg font-semibold tracking-tight md:mt-[0.8em] md:text-lg',
      h4: 'mt-[0.6em] font-heading text-base font-semibold tracking-tight md:mt-[0.65em] md:text-base',
      h5: 'mt-[0.6em] text-base font-semibold tracking-tight md:mt-[0.65em] md:text-base',
      h6: 'mt-[0.6em] text-sm font-semibold tracking-tight md:mt-[0.65em] md:text-sm',
    },
  },
});

export function HeadingElementStatic({
  variant = 'h1',
  ...props
}: SlateElementProps & VariantProps<typeof headingVariants>) {
  return (
    <SlateElement
      as={variant!}
      className={headingVariants({ variant })}
      {...props}
    >
      {props.children}
    </SlateElement>
  );
}

export function H1ElementStatic(props: SlateElementProps) {
  return <HeadingElementStatic variant="h1" {...props} />;
}

export function H2ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h2" {...props} />;
}

export function H3ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h3" {...props} />;
}

export function H4ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h4" {...props} />;
}

export function H5ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h5" {...props} />;
}

export function H6ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h6" {...props} />;
}
