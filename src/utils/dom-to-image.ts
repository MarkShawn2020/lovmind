import { domToCanvas, domToPng } from 'modern-screenshot';
import { writeImage } from '@tauri-apps/plugin-clipboard-manager';
import { Image } from '@tauri-apps/api/image';

export interface CaptureOptions {
  /** Scale factor for the output image (default: 2 for retina) */
  scale?: number;
  /** Background color (default: white) */
  backgroundColor?: string;
}

const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || 'isTauri' in window);
};

/**
 * Capture a DOM element as a PNG data URL
 */
export async function captureAsDataUrl(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<string> {
  const { scale = 2, backgroundColor = '#ffffff' } = options;

  return domToPng(element, {
    scale,
    backgroundColor,
  });
}

/**
 * Capture a DOM element and copy to clipboard
 */
export async function captureToClipboard(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<void> {
  const { scale = 2, backgroundColor = '#ffffff' } = options;

  const canvas = await domToCanvas(element, {
    scale,
    backgroundColor,
  });

  // In Tauri, prefer the native clipboard plugin for image writes
  if (isTauriEnvironment()) {
    try {
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D context from canvas');
      }

      const width = canvas.width;
      const height = canvas.height;
      const imageData = context.getImageData(0, 0, width, height);
      const rgba = new Uint8Array(imageData.data.buffer);

      const image = await Image.new(rgba, width, height);
      await writeImage(image);
      return;
    } catch (error) {
      console.error('[dom-to-image] Failed to write image via Tauri clipboard, falling back to navigator.clipboard:', error);
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });

  if (navigator.clipboard && typeof (window as any).ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new (window as any).ClipboardItem({ 'image/png': blob }),
    ]);
  } else {
    throw new Error('Image clipboard API is not supported in this environment');
  }
}

/**
 * Capture a DOM element and download as PNG file
 */
export async function captureAndDownload(
  element: HTMLElement,
  filename: string = 'capture.png',
  options: CaptureOptions = {}
): Promise<void> {
  const dataUrl = await captureAsDataUrl(element, options);

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}
