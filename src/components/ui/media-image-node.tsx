'use client';

import * as React from 'react';

import type { TImageElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { useDraggable } from '@platejs/dnd';
import { Image, ImagePlugin, useMediaState } from '@platejs/media/react';
import { ResizableProvider, useResizableValue } from '@platejs/resizable';
import { PlateElement, withHOC } from 'platejs/react';

import { cn } from '@/lib/utils';

import { Caption, CaptionTextarea } from './caption';
import { MediaToolbar } from './media-toolbar';
import {
  mediaResizeHandleVariants,
  Resizable,
  ResizeHandle,
} from './resize-handle';
import { CaptionPlugin } from '@platejs/caption/react';
import { useEditorRef } from 'platejs/react';

export const ImageElement = withHOC(
  ResizableProvider,
  function ImageElement(props: PlateElementProps<TImageElement>) {
    const { align = 'center', focused, readOnly, selected } = useMediaState();
    const width = useResizableValue('width');
    const editor = useEditorRef();
    const captionRef = React.useRef<HTMLTextAreaElement>(null);

    const { isDragging, handleRef } = useDraggable({
      element: props.element,
    });

    // Auto-focus caption when image is newly inserted
    React.useEffect(() => {
      const element = props.element as any;
      console.log('[ImageElement] useEffect triggered:', {
        autoFocusCaption: element.autoFocusCaption,
        readOnly,
        captionRefCurrent: captionRef.current,
      });

      if (element.autoFocusCaption && !readOnly) {
        console.log('[ImageElement] Setting visibleId:', element.id);
        // Show the caption
        editor.setOption(CaptionPlugin, 'visibleId', element.id as string);

        // Wait for caption to render, then focus
        if (captionRef.current) {
          console.log('[ImageElement] Caption ref exists, focusing immediately');
          captionRef.current.focus();
          console.log('[ImageElement] After focus, activeElement:', document.activeElement);

          // Clear the flag to prevent re-triggering
          const path = editor.api.findPath(element);
          if (path) {
            editor.tf.setNodes(
              { autoFocusCaption: undefined },
              { at: path }
            );
            console.log('[ImageElement] Cleared autoFocusCaption flag');
          }
        } else {
          console.log('[ImageElement] Caption ref is null, will wait for next render');
        }
      }
    }, [(props.element as any).autoFocusCaption, readOnly, captionRef.current]);

    return (
      <MediaToolbar plugin={ImagePlugin}>
        <PlateElement {...props} className="py-2.5">
          <figure className="group relative m-0" contentEditable={false}>
            <Resizable
              align={align}
              options={{
                align,
                readOnly,
              }}
            >
              <ResizeHandle
                className={mediaResizeHandleVariants({ direction: 'left' })}
                options={{ direction: 'left' }}
              />
              <Image
                ref={handleRef}
                className={cn(
                  'block w-full max-w-full cursor-pointer object-cover px-0',
                  'rounded-sm',
                  focused && selected && 'ring-2 ring-ring ring-offset-2',
                  isDragging && 'opacity-50'
                )}
                alt={props.attributes.alt as string | undefined}
              />
              <ResizeHandle
                className={mediaResizeHandleVariants({
                  direction: 'right',
                })}
                options={{ direction: 'right' }}
              />
            </Resizable>

            <Caption style={{ width }} align={align}>
              <CaptionTextarea
                ref={captionRef}
                readOnly={readOnly}
                placeholder="Write a caption..."
              />
            </Caption>
          </figure>

          {props.children}
        </PlateElement>
      </MediaToolbar>
    );
  }
);
