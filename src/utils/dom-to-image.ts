import { domToCanvas, domToPng } from 'modern-screenshot';

export interface CaptureOptions {
  /** Scale factor for the output image (default: 2 for retina) */
  scale?: number;
  /** Background color (default: white) */
  backgroundColor?: string;
}

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

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
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
