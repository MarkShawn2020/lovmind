import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface UploadedFile {
  key: string;
  appUrl: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface UseUploadFileProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

export function useUploadFile({
  onUploadComplete,
  onUploadError,
}: UseUploadFileProps = {}) {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  async function uploadThing(file: File) {
    setIsUploading(true);
    setUploadingFile(file);

    try {
      // Read file as ArrayBuffer and convert to bytes array
      const arrayBuffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 50);

      // Save file via Tauri command (returns file system path)
      const filePath = await invoke<string>('save_uploaded_file', {
        fileName: file.name,
        fileData: bytes,
      });

      clearInterval(progressInterval);
      setProgress(100);

      // Convert file path to asset:// URL for webview
      const assetUrl = convertFileSrc(filePath);

      const uploadedFile = {
        key: filePath,
        appUrl: assetUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        url: assetUrl,
      } as UploadedFile;

      setUploadedFile(uploadedFile);
      onUploadComplete?.(uploadedFile);

      return uploadedFile;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const message =
        errorMessage.length > 0
          ? errorMessage
          : 'Failed to upload file. Please try again.';

      toast.error(message);
      onUploadError?.(error);

      // Fallback to blob URL for preview
      const mockUploadedFile = {
        key: 'local-blob',
        appUrl: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      } as UploadedFile;

      setUploadedFile(mockUploadedFile);
      return mockUploadedFile;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile: uploadThing,
    uploadingFile,
  };
}

function getErrorMessage(err: unknown) {
  const unknownError = 'Something went wrong, please try again later.';

  if (err instanceof z.ZodError) {
    const errors = err.issues.map((issue) => {
      return issue.message;
    });

    return errors.join('\n');
  } else if (err instanceof Error) {
    return err.message;
  } else {
    return unknownError;
  }
}

export function showErrorToast(err: unknown) {
  const errorMessage = getErrorMessage(err);

  return toast.error(errorMessage);
}
