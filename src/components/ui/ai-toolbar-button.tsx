'use client';

import * as React from 'react';

import { AIChatPlugin } from '@platejs/ai/react';
import { useEditorPlugin } from 'platejs/react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { ToolbarButton } from './toolbar';

export function AIToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const { api } = useEditorPlugin(AIChatPlugin);
  const [aiEnabled, setAiEnabled] = React.useState(false);

  React.useEffect(() => {
    // Check if AI is enabled
    invoke<boolean>('is_ai_enabled')
      .then(setAiEnabled)
      .catch(() => setAiEnabled(false));

    // Listen for AI enabled changes
    const unlisten = listen<boolean>('ai-enabled-changed', (event) => {
      setAiEnabled(event.payload);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return (
    <ToolbarButton
      {...props}
      disabled={!aiEnabled}
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
