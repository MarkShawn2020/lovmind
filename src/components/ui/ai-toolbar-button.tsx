'use client';

import * as React from 'react';

import { AIChatPlugin } from '@platejs/ai/react';
import { useEditorPlugin } from 'platejs/react';

import { ToolbarButton } from './toolbar';

// Check if running in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

export function AIToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const { api } = useEditorPlugin(AIChatPlugin);
  const [aiEnabled, setAiEnabled] = React.useState(false);

  React.useEffect(() => {
    if (!isTauri) {
      setAiEnabled(false);
      return;
    }

    let cleanup: (() => void) | null = null;

    // Dynamic import Tauri APIs only in Tauri environment
    Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event')
    ]).then(async ([{ invoke }, { listen }]) => {
      // Check if AI is enabled
      try {
        const enabled = await invoke<boolean>('is_ai_enabled');
        setAiEnabled(enabled);
      } catch {
        setAiEnabled(false);
      }

      // Listen for AI enabled changes
      const unlisten = await listen<boolean>('ai-enabled-changed', (event) => {
        setAiEnabled(event.payload);
      });

      cleanup = unlisten;
    }).catch(() => {
      setAiEnabled(false);
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return (
    <ToolbarButton
      {...props}
      disabled={!aiEnabled}
      tooltip={!aiEnabled ? "正在开发，敬请期待" : props.tooltip}
      className={!aiEnabled ? "pointer-events-auto cursor-not-allowed text-muted-foreground opacity-50" : props.className}
      onClick={() => {
        if (aiEnabled) {
          api.aiChat.show();
        }
      }}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
    />
  );
}
