'use client';

import { CaptionPlugin } from '@platejs/caption/react';
import {
  AudioPlugin,
  FilePlugin,
  ImagePlugin,
  MediaEmbedPlugin,
  PlaceholderPlugin,
  VideoPlugin,
} from '@platejs/media/react';
import { KEYS, isType } from 'platejs';
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
      const { insertBreak } = editor;
      const originalInsertBreak = insertBreak as () => void;

      editor.insertBreak = () => {
        const { selection } = editor;

        if (!selection) {
          return originalInsertBreak();
        }

        // Check if we're in an image node
        const imageEntry = (editor as PlateEditor).api.above({
          match: (n) => isType(editor, n, KEYS.img),
        });

        if (imageEntry) {
          const [, imagePath] = imageEntry;

          // Insert a new paragraph block before the image
          (editor as PlateEditor).tf.insertNodes(
            (editor as PlateEditor).api.create.block({ type: KEYS.p }),
            {
              at: imagePath,
              select: true,
            }
          );

          return;
        }

        return originalInsertBreak();
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
