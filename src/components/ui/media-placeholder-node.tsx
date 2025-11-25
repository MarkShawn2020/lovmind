'use client';

import * as React from 'react';

import type { TPlaceholderElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import {
  PlaceholderPlugin,
  PlaceholderProvider,
  updateUploadHistory,
} from '@platejs/media/react';
import { AudioLines, FileUp, Film, ImageIcon, Loader2Icon } from 'lucide-react';
import { KEYS } from 'platejs';
import { PlateElement, useEditorPlugin, withHOC } from 'platejs/react';
import { useFilePicker } from 'use-file-picker';

import { cn } from '@/lib/utils';
import { useUploadFile } from '@/hooks/use-upload-file';
import { startImageUpload } from '@/lib/upload-manager';

const CONTENT: Record<
  string,
  {
    accept: string[];
    content: React.ReactNode;
    icon: React.ReactNode;
  }
> = {
  [KEYS.audio]: {
    accept: ['audio/*'],
    content: 'Add an audio file',
    icon: <AudioLines />,
  },
  [KEYS.file]: {
    accept: ['*'],
    content: 'Add a file',
    icon: <FileUp />,
  },
  [KEYS.img]: {
    accept: ['image/*'],
    content: 'Add an image',
    icon: <ImageIcon />,
  },
  [KEYS.video]: {
    accept: ['video/*'],
    content: 'Add a video',
    icon: <Film />,
  },
};

export const PlaceholderElement = withHOC(
  PlaceholderProvider,
  function PlaceholderElement(props: PlateElementProps<TPlaceholderElement>) {
    const { editor, element } = props;

    const { api } = useEditorPlugin(PlaceholderPlugin);

    const { isUploading, progress, uploadedFile, uploadFile, uploadingFile } =
      useUploadFile();

    const loading = isUploading && uploadingFile;

    const currentContent = CONTENT[element.mediaType];

    const isImage = element.mediaType === KEYS.img;

    const imageRef = React.useRef<HTMLImageElement>(null);

    const { openFilePicker } = useFilePicker({
      accept: currentContent.accept,
      multiple: true,
      onFilesSelected: ({ plainFiles: updatedFiles }) => {
        const firstFile = updatedFiles[0];
        const restFiles = updatedFiles.slice(1);

        replaceCurrentPlaceholder(firstFile);

        if (restFiles.length > 0) {
          editor.getTransforms(PlaceholderPlugin).insert.media(restFiles);
        }
      },
    });

    // Track the image node ID we created (for updating URL after upload)
    const imageNodeIdRef = React.useRef<string | null>(null);
    // Store pending file for image insertion (triggers useEffect)
    const [pendingImage, setPendingImage] = React.useState<{ file: File; blobUrl: string; nodeId: string } | null>(null);

    const replaceCurrentPlaceholder = React.useCallback(
      (file: File) => {
        // For images: schedule immediate insertion of Image node with blob URL
        if (isImage) {
          const blobUrl = URL.createObjectURL(file);
          // Generate nodeId here so we can track it
          const nodeId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          imageNodeIdRef.current = nodeId;
          setPendingImage({ file, blobUrl, nodeId });
          // Start upload using global manager (survives component unmount)
          void startImageUpload(nodeId, file, blobUrl);
        } else {
          // For non-images: use original flow with hook
          void uploadFile(file);
          api.placeholder.addUploadingFile(element.id as string, file);
        }
      },
      [api.placeholder, element.id, uploadFile, isImage]
    );

    // Process pending image file - insert Image node with blob URL
    React.useEffect(() => {
      if (!pendingImage || !isImage) return;

      const pending = pendingImage;
      setPendingImage(null);

      const path = editor.api.findPath(element);
      if (!path) return;

      // Use setTimeout to ensure we're outside React's render cycle
      setTimeout(() => {
        try {
          editor.tf.removeNodes({ at: path });

          const node = {
            id: pending.nodeId,
            children: [{ text: '' }],
            isUpload: true,
            type: KEYS.img,
            url: pending.blobUrl,
            // Mark as uploading for progress display
            isUploading: true,
            uploadProgress: 0,
          };

          editor.tf.insertNodes(node, { at: path });

          console.log('[PlaceholderElement] Inserted Image node with blob URL:', pending.blobUrl, 'nodeId:', pending.nodeId);
        } catch (err) {
          console.error('[PlaceholderElement] Failed to insert image node:', err);
        }
      }, 0);
    }, [pendingImage, isImage, editor, element]);

    // Note: Upload completion is now handled via custom event 'image-upload-complete'
    // which is listened to by ImageElement

    // For non-images: original upload complete handler
    React.useEffect(() => {
      if (!uploadedFile || isImage) return;

      const path = editor.api.findPath(element);

      if (!path) return;

      editor.tf.withoutSaving(() => {
        editor.tf.removeNodes({ at: path });

        const node = {
          children: [{ text: '' }],
          initialHeight: imageRef.current?.height,
          initialWidth: imageRef.current?.width,
          isUpload: true,
          name: element.mediaType === KEYS.file ? uploadedFile.name : '',
          placeholderId: element.id as string,
          type: element.mediaType!,
          url: uploadedFile.url,
          autoFocusCaption:
            element.mediaType === KEYS.video ||
            element.mediaType === KEYS.audio,
        };

        editor.tf.insertNodes(node, { at: path });
        updateUploadHistory(editor, node);
      });

      setTimeout(() => {
        editor.tf.focus();
      }, 0);

      api.placeholder.removeUploadingFile(element.id as string);
    }, [uploadedFile, element.id, isImage]);

    // React dev mode will call React.useEffect twice
    const isReplaced = React.useRef(false);

    /** Paste and drop */
    React.useEffect(() => {
      if (isReplaced.current) return;

      isReplaced.current = true;
      const currentFiles = api.placeholder.getUploadingFile(
        element.id as string
      );

      if (!currentFiles) return;

      replaceCurrentPlaceholder(currentFiles);

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReplaced]);

    return (
      <PlateElement className="my-1" {...props}>
        {(!loading || !isImage) && (
          <div
            className={cn(
              'flex cursor-pointer items-center rounded-sm bg-muted p-3 pr-9 select-none hover:bg-primary/10'
            )}
            onClick={() => !loading && openFilePicker()}
            contentEditable={false}
          >
            <div className="relative mr-3 flex text-muted-foreground/80 [&_svg]:size-6">
              {currentContent.icon}
            </div>
            <div className="text-sm whitespace-nowrap text-muted-foreground">
              <div>
                {loading ? uploadingFile?.name : currentContent.content}
              </div>

              {loading && !isImage && (
                <div className="mt-1 flex items-center gap-1.5">
                  <div>{formatBytes(uploadingFile?.size ?? 0)}</div>
                  <div>–</div>
                  <div className="flex items-center">
                    <Loader2Icon className="mr-1 size-3.5 animate-spin text-muted-foreground" />
                    {progress ?? 0}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Note: For images, we now directly insert ImageElement with blob URL,
            so ImageProgress is no longer used for images */}

        {props.children}
      </PlateElement>
    );
  }
);

export function ImageProgress({
  className,
  file,
  imageRef,
  progress = 0,
  blobUrl,
}: {
  file: File;
  className?: string;
  imageRef?: React.RefObject<HTMLImageElement | null>;
  progress?: number;
  blobUrl?: string | null;
}) {
  // Use provided blobUrl or create our own (fallback)
  const [fallbackUrl, setFallbackUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Only create fallback URL if no blobUrl provided
    if (!blobUrl) {
      const url = URL.createObjectURL(file);
      setFallbackUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file, blobUrl]);

  const displayUrl = blobUrl || fallbackUrl;

  if (!displayUrl) {
    return null;
  }

  return (
    <div className={cn('relative', className)} contentEditable={false}>
      <img
        ref={imageRef}
        className="h-auto w-full rounded-sm object-cover"
        alt={file.name}
        src={displayUrl}
      />
      {progress < 100 && (
        <div className="absolute right-1 bottom-1 flex items-center space-x-2 rounded-full bg-black/50 px-1 py-0.5">
          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs font-medium text-white">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}

function formatBytes(
  bytes: number,
  opts: {
    decimals?: number;
    sizeType?: 'accurate' | 'normal';
  } = {}
) {
  const { decimals = 0, sizeType = 'normal' } = opts;

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];

  if (bytes === 0) return '0 Byte';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${
    sizeType === 'accurate'
      ? (accurateSizes[i] ?? 'Bytest')
      : (sizes[i] ?? 'Bytes')
  }`;
}
