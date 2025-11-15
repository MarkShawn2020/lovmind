'use client';

import * as React from 'react';

import type { TPlaceholderElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import {
  PlaceholderPlugin,
  PlaceholderProvider,
  updateUploadHistory,
} from '@platejs/media/react';
import { CaptionPlugin } from '@platejs/caption/react';
import { AudioLines, FileUp, Film, ImageIcon, Loader2Icon } from 'lucide-react';
import { KEYS } from 'platejs';
import { PlateElement, useEditorPlugin, withHOC } from 'platejs/react';
import { useFilePicker } from 'use-file-picker';

import { cn } from '@/lib/utils';
import { useUploadFile } from '@/hooks/use-upload-file';

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

    const replaceCurrentPlaceholder = React.useCallback(
      (file: File) => {
        void uploadFile(file);
        api.placeholder.addUploadingFile(element.id as string, file);
      },
      [api.placeholder, element.id, uploadFile]
    );

    React.useEffect(() => {
      if (!uploadedFile) return;

      const path = editor.api.findPath(element);
      let insertedNodeId: string | undefined;

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
        };

        editor.tf.insertNodes(node, { at: path });

        // Get the inserted node's ID for caption auto-focus
        const insertedNode = editor.api.node({ at: path });
        if (insertedNode) {
          insertedNodeId = insertedNode[0].id as string;
        }

        updateUploadHistory(editor, node);
      });

      // ✅ Ensure editor regains focus after async operation
      setTimeout(() => {
        editor.tf.focus();
        console.log('[PlaceholderElement] 已恢复编辑器焦点');
      }, 0);

      api.placeholder.removeUploadingFile(element.id as string);

      // Auto-focus caption for image/video/audio media types
      if (
        insertedNodeId &&
        (element.mediaType === KEYS.img ||
          element.mediaType === KEYS.video ||
          element.mediaType === KEYS.audio)
      ) {
        console.log('[AutoFocus] 开始自动聚焦流程:', {
          insertedNodeId,
          mediaType: element.mediaType,
          path,
        });

        // Use requestAnimationFrame for better timing with React rendering
        requestAnimationFrame(() => {
          console.log('[AutoFocus] RAF #1 执行，设置 visibleId');
          // Set the caption as visible
          editor.setOption(CaptionPlugin, 'visibleId', insertedNodeId!);
          console.log('[AutoFocus] visibleId 已设置为:', insertedNodeId);

          // Wait for the caption to render and become visible
          requestAnimationFrame(() => {
            console.log('[AutoFocus] RAF #2 执行，开始查找 textarea');

            // Find all figcaption textareas in the document
            const allTextareas = document.querySelectorAll<HTMLTextAreaElement>(
              'figcaption textarea'
            );
            console.log('[AutoFocus] 找到的所有 figcaption textarea:', allTextareas.length);

            // Find the one that's visible (caption plugin sets visibility via CSS)
            let captionTextarea: HTMLTextAreaElement | null = null;
            for (const textarea of allTextareas) {
              const figcaption = textarea.closest('figcaption');
              const computedStyle = figcaption ? getComputedStyle(figcaption) : null;

              console.log('[AutoFocus] 检查 textarea:', {
                textarea,
                figcaption,
                hasHiddenAttr: figcaption?.hasAttribute('hidden'),
                display: computedStyle?.display,
                visibility: computedStyle?.visibility,
                opacity: computedStyle?.opacity,
              });

              if (
                figcaption &&
                !figcaption.hasAttribute('hidden') &&
                computedStyle &&
                computedStyle.display !== 'none' &&
                computedStyle.visibility !== 'hidden' &&
                computedStyle.opacity !== '0'
              ) {
                captionTextarea = textarea;
                console.log('[AutoFocus] 找到可见的 textarea');
                break;
              }
            }

            if (captionTextarea) {
              console.log('[AutoFocus] 执行 focus()');
              captionTextarea.focus();
              console.log('[AutoFocus] focus() 完成，activeElement:', document.activeElement);
            } else {
              console.error('[AutoFocus] 未找到可见的 caption textarea');
            }
          });
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uploadedFile, element.id]);

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

        {isImage && loading && (
          <ImageProgress
            file={uploadingFile}
            imageRef={imageRef}
            progress={progress}
          />
        )}

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
}: {
  file: File;
  className?: string;
  imageRef?: React.RefObject<HTMLImageElement | null>;
  progress?: number;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!objectUrl) {
    return null;
  }

  return (
    <div className={cn('relative', className)} contentEditable={false}>
      <img
        ref={imageRef}
        className="h-auto w-full rounded-sm object-cover"
        alt={file.name}
        src={objectUrl}
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
