'use client';

import * as React from 'react';

import type { VariantProps } from 'class-variance-authority';

import {
  Caption as CaptionPrimitive,
  CaptionPlugin,
  CaptionTextarea as CaptionTextareaPrimitive,
  useCaptionButton,
  useCaptionButtonState,
} from '@platejs/caption/react';
import { createPrimitiveComponent } from '@udecode/cn';
import { cva } from 'class-variance-authority';
import { useEditorRef, useElement } from 'platejs/react';
import { KEYS, PathApi } from 'platejs';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const captionVariants = cva('max-w-full', {
  defaultVariants: {
    align: 'center',
  },
  variants: {
    align: {
      center: 'mx-auto',
      left: 'mr-auto',
      right: 'ml-auto',
    },
  },
});

export function Caption({
  align,
  className,
  ...props
}: React.ComponentProps<typeof CaptionPrimitive> &
  VariantProps<typeof captionVariants>) {
  return (
    <CaptionPrimitive
      {...props}
      className={cn(captionVariants({ align }), className)}
    />
  );
}

export const CaptionTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<typeof CaptionTextareaPrimitive>
>(function CaptionTextarea(props, ref) {
  const editor = useEditorRef();
  const element = useElement();
  const [textareaElement, setTextareaElement] = React.useState<HTMLTextAreaElement | null>(null);

  // Callback ref to capture the actual DOM element
  const callbackRef = React.useCallback((node: HTMLTextAreaElement | null) => {
    setTextareaElement(node);
  }, []);

  // Merge refs
  React.useImperativeHandle(ref, () => textareaElement!);

  // Auto-focus when parent image has autoFocusCaption flag
  React.useEffect(() => {
    const parentElement = element as any;

    if (parentElement.autoFocusCaption && textareaElement) {
      textareaElement.focus();

      // Clear the flag
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes(
          { autoFocusCaption: undefined },
          { at: path }
        );
      }
    }
  }, [(element as any).autoFocusCaption, textareaElement, editor, element]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;

      // Handle Backspace on empty caption: select parent image
      if (e.key === 'Backspace' && textarea.value === '') {
        e.preventDefault();
        e.stopPropagation();

        // Hide the caption
        editor.setOption(CaptionPlugin, 'visibleId', null);

        // Select the parent media element
        const path = editor.api.findPath(element);
        if (path) {
          editor.tf.select(path);
          editor.tf.focus();
        }

        return;
      }

      // Handle Enter key to create a new block below
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        const path = editor.api.findPath(element);
        if (!path) return;

        // Hide the caption immediately
        editor.setOption(CaptionPlugin, 'visibleId', null);

        // Calculate the path for the new block (after the current element)
        const nextPath = PathApi.next(path);

        // Insert a new paragraph block after the current element
        editor.tf.insertNodes(
          editor.api.create.block({ type: KEYS.p }),
          {
            at: nextPath,
            select: true,
          }
        );

        // Force focus to the editor after the DOM updates
        setTimeout(() => {
          const insertedPath = editor.api.after(path);
          if (insertedPath) {
            editor.tf.focus({ at: insertedPath });
          } else {
            editor.tf.focus({ at: nextPath });
          }
        }, 10);

        return;
      }

      // Call the original onKeyDown if provided (for arrow keys, etc.)
      props.onKeyDown?.(e);
    },
    [editor, element, props]
  );

  return (
    <CaptionTextareaPrimitive
      ref={callbackRef}
      {...props}
      onKeyDown={handleKeyDown}
      className={cn(
        'mt-2 w-full resize-none border-none bg-inherit p-0 font-[inherit] text-inherit',
        'focus:outline-none focus:[&::placeholder]:opacity-0',
        'text-center print:placeholder:text-transparent',
        props.className
      )}
    />
  );
});

export const CaptionButton = createPrimitiveComponent(Button)({
  propsHook: useCaptionButton,
  stateHook: useCaptionButtonState,
});
