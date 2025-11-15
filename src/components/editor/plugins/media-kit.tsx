'use client';

import { CaptionPlugin, showCaption } from '@platejs/caption/react';
import {
  AudioPlugin,
  FilePlugin,
  ImagePlugin,
  MediaEmbedPlugin,
  PlaceholderPlugin,
  VideoPlugin,
} from '@platejs/media/react';
import { KEYS } from 'platejs';
import type { PlateEditor } from 'platejs/react';

import { AudioElement } from '@/components/ui/media-audio-node';
import { MediaEmbedElement } from '@/components/ui/media-embed-node';
import { FileElement } from '@/components/ui/media-file-node';
import { ImageElement } from '@/components/ui/media-image-node';
import { PlaceholderElement } from '@/components/ui/media-placeholder-node';
import { MediaPreviewDialog } from '@/components/ui/media-preview-dialog';
import { MediaUploadToast } from '@/components/ui/media-upload-toast';
import { VideoElement } from '@/components/ui/media-video-node';

export const MediaKit = [
  ImagePlugin.configure({
    options: { disableUploadInsert: false },
    render: { afterEditable: MediaPreviewDialog, node: ImageElement },
    extendEditor: ({ editor }) => {
      const { insertNodes } = editor;

      editor.insertNodes = (nodes: any, options?: any) => {
        const result = (insertNodes as any)(nodes, options);

        // Check if we're inserting media nodes (for URL/manual insertion)
        const nodeArray = Array.isArray(nodes) ? nodes : [nodes];
        const mediaNode = nodeArray.find((node: any) =>
          node.type === KEYS.img || node.type === KEYS.video || node.type === KEYS.audio
        ) as any;

        if (mediaNode && mediaNode.url && !mediaNode.placeholderId) {
          // Only auto-focus for direct URL insertion (not placeholder replacement)
          // Use queueMicrotask for reliable timing without setTimeout
          queueMicrotask(() => {
            if (mediaNode.id) {
              const element = editor.api.node({
                match: (n: any) => n.id === mediaNode.id,
              });

              if (element && 'type' in element[0]) {
                showCaption(editor as PlateEditor, element[0] as any);
              }
            }
          });
        }

        return result;
      };

      return editor;
    },
  }),
  MediaEmbedPlugin.withComponent(MediaEmbedElement),
  VideoPlugin.withComponent(VideoElement),
  AudioPlugin.withComponent(AudioElement),
  FilePlugin.withComponent(FileElement),
  PlaceholderPlugin.configure({
    options: { disableEmptyPlaceholder: true },
    render: { afterEditable: MediaUploadToast, node: PlaceholderElement },
  }),
  CaptionPlugin.configure({
    options: {
      query: {
        allow: [KEYS.img, KEYS.video, KEYS.audio, KEYS.file, KEYS.mediaEmbed],
      },
    },
  }),
];
