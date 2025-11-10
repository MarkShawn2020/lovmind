'use client';

import { ExitBreakPlugin } from 'platejs';

export const ExitBreakKit = [
  ExitBreakPlugin.configure({
    shortcuts: {
      // Disabled mod+enter to allow submission via Cmd+Enter
      // insert: { keys: 'mod+enter' },
      insertBefore: { keys: 'mod+shift+enter' },
    },
  }),
];
