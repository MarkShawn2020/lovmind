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
import { useAtomValue } from 'jotai';
import { imageMaxHeightAtom } from '@/store';
import { Loader2Icon, Maximize2 } from 'lucide-react';

export const ImageElement = withHOC(
  ResizableProvider,
  function ImageElement(props: PlateElementProps<TImageElement>) {
    const { align = 'center', focused, readOnly, selected } = useMediaState();
    const width = useResizableValue('width');
    const editor = useEditorRef();
    const imageMaxHeight = useAtomValue(imageMaxHeightAtom);
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isImageTall, setIsImageTall] = React.useState(false);
    const imageRef = React.useRef<HTMLImageElement>(null);

    // Get upload state from element (set by PlaceholderElement)
    const element = props.element as TImageElement & {
      isUploading?: boolean;
      uploadProgress?: number;
    };
    const isUploading = element.isUploading;
    const uploadProgress = element.uploadProgress ?? 0;
    const nodeId = (element as any).id;

    // Listen for upload progress and complete events
    React.useEffect(() => {
      if (!isUploading || !nodeId) return;

      const handleUploadProgress = (e: CustomEvent<{ nodeId: string; progress: number }>) => {
        if (e.detail.nodeId !== nodeId) return;

        // Use props.element to find path directly
        const path = editor.api.findPath(props.element);
        if (path) {
          editor.tf.setNodes({ uploadProgress: e.detail.progress }, { at: path });
        }
      };

      const handleUploadComplete = (e: CustomEvent<{ nodeId: string; finalUrl: string }>) => {
        if (e.detail.nodeId !== nodeId) return;

        console.log('[ImageElement] Received upload complete for:', nodeId, 'URL:', e.detail.finalUrl);

        // Use props.element to find path directly
        const path = editor.api.findPath(props.element);
        if (path) {
          // Update URL in place (no DOM replacement = no flicker!)
          editor.tf.setNodes(
            {
              url: e.detail.finalUrl,
              isUploading: false,
              uploadProgress: 100,
            },
            { at: path }
          );

          console.log('[ImageElement] Updated URL in place at path:', path);
        } else {
          console.error('[ImageElement] Could not find path for element');
        }
      };

      window.addEventListener('image-upload-progress', handleUploadProgress as EventListener);
      window.addEventListener('image-upload-complete', handleUploadComplete as EventListener);
      return () => {
        window.removeEventListener('image-upload-progress', handleUploadProgress as EventListener);
        window.removeEventListener('image-upload-complete', handleUploadComplete as EventListener);
      };
    }, [isUploading, nodeId, editor, props.element]);

    const { isDragging, handleRef } = useDraggable({
      element: props.element,
    });

    // Check if image is taller than max-height
    React.useEffect(() => {
      const img = imageRef.current;
      if (img && imageMaxHeight > 0) {
        const checkHeight = () => {
          setIsImageTall(img.naturalHeight > imageMaxHeight);
        };

        if (img.complete) {
          checkHeight();
        } else {
          img.addEventListener('load', checkHeight);
          return () => img.removeEventListener('load', checkHeight);
        }
      }
    }, [imageMaxHeight]);

    // Show caption when image is newly inserted (CaptionTextarea handles focus)
    React.useEffect(() => {
      const element = props.element as any;
      if (element.autoFocusCaption && !readOnly) {
        editor.setOption(CaptionPlugin, 'visibleId', element.id as string);
      }
    }, [(props.element as any).autoFocusCaption, readOnly, editor]);

    // Calculate effective max-height (0 means unlimited)
    const effectiveMaxHeight = imageMaxHeight === 0 || isExpanded ? undefined : imageMaxHeight;

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
              <div className="relative">
                <Image
                  ref={(node) => {
                    // Combine refs: handleRef for dragging, imageRef for height checking
                    if (typeof handleRef === 'function') {
                      handleRef(node);
                    } else if (handleRef) {
                      (handleRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
                    }
                    (imageRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
                  }}
                  className={cn(
                    'block w-full max-w-full cursor-pointer object-cover px-0',
                    'rounded-sm transition-all duration-300',
                    focused && selected && 'ring-2 ring-ring ring-offset-2',
                    isDragging && 'opacity-50'
                  )}
                  style={{
                    maxHeight: effectiveMaxHeight ? `${effectiveMaxHeight}px` : undefined,
                    objectFit: 'contain',
                  }}
                  alt={props.attributes.alt as string | undefined}
                />
                {/* Upload progress indicator */}
                {isUploading && (
                  <div className="absolute right-1 bottom-1 flex items-center space-x-2 rounded-full bg-black/50 px-2 py-1">
                    <Loader2Icon className="size-3.5 animate-spin text-white" />
                    <span className="text-xs font-medium text-white">
                      {uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : 'Processing...'}
                    </span>
                  </div>
                )}
                {/* Expand/Collapse button - only show when image is tall and max-height is set */}
                {isImageTall && imageMaxHeight > 0 && (
                  <button
                    contentEditable={false}
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="absolute bottom-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
                    title={isExpanded ? 'Show less' : 'Show full image'}
                  >
                    <Maximize2 size={16} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                )}
              </div>
              <ResizeHandle
                className={mediaResizeHandleVariants({
                  direction: 'right',
                })}
                options={{ direction: 'right' }}
              />
            </Resizable>

            <Caption style={{ width }} align={align}>
              <CaptionTextarea
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
