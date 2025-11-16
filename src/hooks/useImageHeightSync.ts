import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { listen } from '@tauri-apps/api/event';

import { isTauri } from '@/utils/tauri';
import { imageMaxHeightAtom } from '@/store';

/**
 * Synchronizes image max height setting across windows via Tauri events
 */
export function useImageHeightSync() {
  const setImageMaxHeight = useSetAtom(imageMaxHeightAtom);

  useEffect(() => {
    if (!isTauri()) return;

    console.log('Setting up image max height listener...');
    const unlistenImageHeight = listen<{ value: number }>(
      'image-max-height-changed',
      (event) => {
        const newHeight = event.payload.value;
        console.log('Received image-max-height-changed:', newHeight);
        setImageMaxHeight(newHeight);
      }
    );

    return () => {
      unlistenImageHeight.then((fn) => fn());
    };
  }, [setImageMaxHeight]);
}
