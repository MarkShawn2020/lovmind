/**
 * Global upload manager for image uploads
 * Survives component unmount to ensure uploads complete
 */

import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as qiniu from 'qiniu-js';
import { getStoreValue, defaultCloudStorageSettings, type CloudStorageSettings } from '@/store';

interface QiniuProgress {
  total?: { percent: number };
}

interface QiniuComplete {
  key: string;
  hash: string;
}

interface QiniuError {
  message?: string;
}

export interface UploadResult {
  url: string;
  source: 'local' | 'cloud';
}

interface UploadTask {
  nodeId: string;
  file: File;
  blobUrl: string;
  subscription?: { unsubscribe: () => void };
}

// Global map of active uploads
const activeUploads = new Map<string, UploadTask>();

/**
 * Start uploading a file for an image node
 * Returns immediately, dispatches events for progress and completion
 */
export async function startImageUpload(nodeId: string, file: File, blobUrl: string): Promise<void> {
  console.log('[UploadManager] Starting upload for:', nodeId);

  // Store the task
  const task: UploadTask = { nodeId, file, blobUrl };
  activeUploads.set(nodeId, task);

  try {
    // Get cloud settings
    const cloudSettings = await getStoreValue<CloudStorageSettings>(
      'lovpen-cloud-storage',
      defaultCloudStorageSettings
    );

    const isCloudEnabled = cloudSettings.enabled &&
      cloudSettings.provider === 'qiniu' &&
      !!cloudSettings.qiniu.accessKey &&
      !!cloudSettings.qiniu.bucket &&
      !!cloudSettings.qiniu.domain;

    let result: UploadResult;

    if (isCloudEnabled) {
      try {
        result = await uploadToCloud(task, cloudSettings);
      } catch (err) {
        console.warn('[UploadManager] Cloud upload failed, falling back to local:', err);
        result = await uploadToLocal(task);
      }
    } else {
      result = await uploadToLocal(task);
    }

    // Dispatch completion event
    console.log('[UploadManager] Upload complete for:', nodeId, result.url);
    window.dispatchEvent(new CustomEvent('image-upload-complete', {
      detail: { nodeId, finalUrl: result.url }
    }));

  } catch (err) {
    console.error('[UploadManager] Upload failed:', err);
    // Keep blob URL on failure
    window.dispatchEvent(new CustomEvent('image-upload-complete', {
      detail: { nodeId, finalUrl: blobUrl }
    }));
  } finally {
    activeUploads.delete(nodeId);
  }
}

async function uploadToCloud(task: UploadTask, settings: CloudStorageSettings): Promise<UploadResult> {
  const { file, nodeId } = task;

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
  const config = {
    useCdnDomain: true,
    region: qiniu.region[settings.qiniu.region],
  };

  const putExtra = {
    fname: file.name,
    mimeType: file.type || undefined,
  };

  return new Promise((resolve, reject) => {
    const observable = qiniu.upload(file, key, token, putExtra, config);

    const observer = {
      next: (res: QiniuProgress) => {
        const percent = res.total?.percent || 0;
        // Dispatch progress event
        window.dispatchEvent(new CustomEvent('image-upload-progress', {
          detail: { nodeId, progress: Math.round(percent) }
        }));
      },
      error: (err: QiniuError) => {
        console.error('[UploadManager] Cloud upload error:', err);
        reject(new Error(err.message || 'Cloud upload failed'));
      },
      complete: (res: QiniuComplete) => {
        console.log('[UploadManager] Cloud upload complete:', res);
        const domain = settings.qiniu.domain.replace(/\/$/, '');
        const url = `${domain}/${res.key}`;
        resolve({ url, source: 'cloud' });
      },
    };

    const subscription = observable.subscribe(observer);
    task.subscription = subscription;
  });
}

async function uploadToLocal(task: UploadTask): Promise<UploadResult> {
  const { file, nodeId } = task;

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const bytes = Array.from(new Uint8Array(arrayBuffer));

  // Simulate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + 10, 90);
    window.dispatchEvent(new CustomEvent('image-upload-progress', {
      detail: { nodeId, progress }
    }));
  }, 50);

  try {
    const filePath = await invoke<string>('save_uploaded_file', {
      fileName: file.name,
      fileData: bytes,
    });

    clearInterval(progressInterval);

    window.dispatchEvent(new CustomEvent('image-upload-progress', {
      detail: { nodeId, progress: 100 }
    }));

    const assetUrl = convertFileSrc(filePath);
    return { url: assetUrl, source: 'local' };
  } finally {
    clearInterval(progressInterval);
  }
}

/**
 * Cancel an upload
 */
export function cancelUpload(nodeId: string): void {
  const task = activeUploads.get(nodeId);
  if (task?.subscription) {
    task.subscription.unsubscribe();
    activeUploads.delete(nodeId);
    console.log('[UploadManager] Cancelled upload for:', nodeId);
  }
}
