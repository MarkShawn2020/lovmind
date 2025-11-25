import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as qiniu from 'qiniu-js';
import { getStoreValue, defaultCloudStorageSettings, type CloudStorageSettings } from '@/store';

// Qiniu SDK types (not exported properly from qiniu-js)
interface QiniuConfig {
  useCdnDomain?: boolean;
  region?: typeof qiniu.region[keyof typeof qiniu.region];
}

interface QiniuExtra {
  fname?: string;
  mimeType?: string;
}

interface QiniuProgress {
  total?: {
    percent: number;
  };
}

interface QiniuComplete {
  key: string;
  hash: string;
}

interface QiniuError {
  message?: string;
}

export interface UploadedFile {
  key: string;
  appUrl: string;
  name: string;
  size: number;
  type: string;
  url: string;
  source: 'local' | 'cloud'; // Track where the file is stored
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

  const subscriptionRef = React.useRef<{ unsubscribe: () => void } | null>(null);

  // Pre-load cloud settings to avoid async delay during upload
  const cloudSettingsRef = React.useRef<CloudStorageSettings>(defaultCloudStorageSettings);

  React.useEffect(() => {
    // Load settings on mount and keep ref updated
    getStoreValue<CloudStorageSettings>('lovpen-cloud-storage', defaultCloudStorageSettings)
      .then(settings => {
        cloudSettingsRef.current = settings;
        console.log('[useUploadFile] Cloud settings loaded:', {
          enabled: settings.enabled,
          provider: settings.provider,
        });
      });
  }, []);

  // Helper to check if cloud settings are valid
  const checkCloudConfigured = (settings: CloudStorageSettings): boolean => {
    if (!settings.enabled || settings.provider !== 'qiniu') return false;
    const { accessKey, secretKey, bucket, domain } = settings.qiniu;
    return !!(accessKey && secretKey && bucket && domain);
  };

  // Upload to Qiniu cloud
  async function uploadToCloud(file: File, settings: CloudStorageSettings): Promise<UploadedFile> {
    console.log('[useUploadFile] Starting cloud upload:', file.name);

    // Get upload token from backend
    const token = await invoke<string>('generate_qiniu_token', {
      accessKey: settings.qiniu.accessKey,
      secretKey: settings.qiniu.secretKey,
      bucket: settings.qiniu.bucket,
    });

    // Generate unique key
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || '';
    const key = `lovmind/${timestamp}_${randomStr}.${ext}`;

    // Configure upload
    const config: QiniuConfig = {
      useCdnDomain: true,
      region: qiniu.region[settings.qiniu.region],
    };

    const putExtra: QiniuExtra = {
      fname: file.name,
      mimeType: file.type || undefined,
    };

    return new Promise((resolve, reject) => {
      const observable = qiniu.upload(file, key, token, putExtra, config);

      const observer = {
        next: (res: QiniuProgress) => {
          const percent = res.total?.percent || 0;
          setProgress(Math.round(percent));
        },
        error: (err: QiniuError) => {
          console.error('[useUploadFile] Cloud upload error:', err);
          reject(new Error(err.message || 'Cloud upload failed'));
        },
        complete: (res: QiniuComplete) => {
          console.log('[useUploadFile] Cloud upload complete:', res);
          setProgress(100);

          // Build the full URL
          const domain = settings.qiniu.domain.replace(/\/$/, '');
          const url = `${domain}/${res.key}`;

          const result: UploadedFile = {
            key: res.key,
            appUrl: url,
            name: file.name,
            size: file.size,
            type: file.type,
            url,
            source: 'cloud',
          };

          resolve(result);
        },
      };

      const subscription = observable.subscribe(observer);
      subscriptionRef.current = subscription;
    });
  }

  // Upload to local storage (original logic)
  async function uploadToLocal(file: File): Promise<UploadedFile> {
    console.log('[useUploadFile] Starting local upload:', file.name);

    // Read file as ArrayBuffer and convert to bytes array
    const arrayBuffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));
    console.log('[useUploadFile] File read complete, bytes:', bytes.length);

    // Simulate upload progress for local
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 90));
    }, 50);

    try {
      // Save file via Tauri command (returns file system path)
      const filePath = await invoke<string>('save_uploaded_file', {
        fileName: file.name,
        fileData: bytes,
      });
      console.log('[useUploadFile] File saved at:', filePath);

      clearInterval(progressInterval);
      setProgress(100);

      // Convert file path to asset:// URL for webview
      const assetUrl = convertFileSrc(filePath);
      console.log('[useUploadFile] Asset URL:', assetUrl);

      return {
        key: filePath,
        appUrl: assetUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        url: assetUrl,
        source: 'local',
      };
    } finally {
      clearInterval(progressInterval);
    }
  }

  async function uploadThing(file: File) {
    // Immediately set UI state to prevent flicker
    setIsUploading(true);
    setUploadingFile(file);
    setProgress(0);

    // Use pre-loaded settings from ref, but also refresh from store for accuracy
    // This ensures no flicker (immediate) while still getting fresh data
    const [, freshSettings] = await Promise.all([
      Promise.resolve(), // placeholder for immediate UI update
      getStoreValue<CloudStorageSettings>('lovpen-cloud-storage', defaultCloudStorageSettings),
    ]);

    // Update ref with fresh settings for next upload
    cloudSettingsRef.current = freshSettings;

    // Use fresh settings if available, fallback to pre-loaded ref
    const cloudSettings = freshSettings;
    const isCloudEnabled = checkCloudConfigured(cloudSettings);

    console.log('[useUploadFile] Upload started:', {
      name: file.name,
      size: file.size,
      type: file.type,
      cloudEnabled: isCloudEnabled,
      cloudSettings: {
        enabled: cloudSettings.enabled,
        provider: cloudSettings.provider,
        hasAccessKey: !!cloudSettings.qiniu.accessKey,
        hasBucket: !!cloudSettings.qiniu.bucket,
        hasDomain: !!cloudSettings.qiniu.domain,
      },
    });

    try {
      let result: UploadedFile;

      // Try cloud upload first if configured
      if (isCloudEnabled) {
        try {
          result = await uploadToCloud(file, cloudSettings);
          console.log('[useUploadFile] Cloud upload successful');
        } catch (cloudError) {
          console.warn('[useUploadFile] Cloud upload failed, falling back to local:', cloudError);
          toast.error('Cloud upload failed, saving locally');
          result = await uploadToLocal(file);
        }
      } else {
        result = await uploadToLocal(file);
      }

      setUploadedFile(result);
      onUploadComplete?.(result);
      console.log('[useUploadFile] Upload complete:', result);

      return result;
    } catch (error) {
      console.error('[useUploadFile] Upload failed:', error);
      const errorMessage = getErrorMessage(error);
      const message =
        errorMessage.length > 0
          ? errorMessage
          : 'Failed to upload file. Please try again.';

      toast.error(message);
      onUploadError?.(error);

      // Fallback to blob URL for preview
      const blobUrl = URL.createObjectURL(file);
      console.log('[useUploadFile] Using blob URL fallback:', blobUrl);
      const mockUploadedFile: UploadedFile = {
        key: 'local-blob',
        appUrl: blobUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        url: blobUrl,
        source: 'local',
      };

      setUploadedFile(mockUploadedFile);
      return mockUploadedFile;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
      subscriptionRef.current = null;
    }
  }

  // Cancel upload (for cloud uploads)
  const cancelUpload = React.useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      setIsUploading(false);
      setProgress(0);
      setUploadingFile(undefined);
      console.log('[useUploadFile] Upload cancelled');
    }
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile: uploadThing,
    uploadingFile,
    cancelUpload,
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
