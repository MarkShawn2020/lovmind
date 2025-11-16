'use client';

import { createSlatePlugin } from 'platejs';
import { serializeMd } from '@platejs/markdown';

/**
 * Plugin to override clipboard behavior to output Markdown format.
 *
 * When copying content from the editor:
 * - text/plain: Markdown format (customized)
 * - text/html: Removed (to prevent rich text paste)
 * - application/x-slate-fragment: Preserved (for internal paste)
 *
 * This allows copying content as Markdown while maintaining
 * full fidelity when pasting within the same editor.
 */
export const ClipboardMarkdownPlugin = createSlatePlugin({
  key: 'clipboard-markdown',
  extendEditor: ({ editor }) => {
    const originalSetFragmentData = editor.setFragmentData as ((data: DataTransfer) => void) | undefined;

    editor.setFragmentData = (data: DataTransfer) => {
      console.log('🎯 [ClipboardMarkdown] setFragmentData called!');

      const { selection } = editor;

      // If no selection, fall back to default behavior
      if (!selection) {
        console.log('❌ [ClipboardMarkdown] No selection, using fallback');
        if (originalSetFragmentData) {
          originalSetFragmentData(data);
        }
        return;
      }

      try {
        // Get the selected fragment
        let fragment = (editor.getFragment as () => any)();

        // Debug logging - very detailed
        console.log('✅ [ClipboardMarkdown] Has selection!');
        console.log('📍 [ClipboardMarkdown] Selection anchor:', selection.anchor);
        console.log('📍 [ClipboardMarkdown] Selection focus:', selection.focus);
        console.log('📦 [ClipboardMarkdown] Fragment:', fragment);
        console.log('📦 [ClipboardMarkdown] Fragment length:', fragment?.length);
        console.log('📚 [ClipboardMarkdown] Editor children:', editor.children);
        console.log('📚 [ClipboardMarkdown] Editor children length:', editor.children?.length);

        // Handle edge case: getFragment() returns empty array
        // This can happen with Cmd+A in some scenarios
        if (!fragment || fragment.length === 0) {
          console.warn('⚠️ [ClipboardMarkdown] Fragment is EMPTY! This is the Cmd+A bug.');
          console.log('🔧 [ClipboardMarkdown] Falling back to editor.children');
          // Use entire editor content as fallback
          fragment = editor.children;
          console.log('🔧 [ClipboardMarkdown] Fallback fragment length:', fragment?.length);
        }

        // Verify we have content to serialize
        if (!fragment || fragment.length === 0) {
          console.warn('[ClipboardMarkdown] No content to serialize');
          if (originalSetFragmentData) {
            originalSetFragmentData(data);
          }
          return;
        }

        // Serialize to Markdown using Plate's markdown plugin
        const markdown = serializeMd(editor as any, { value: fragment });

        console.log('[ClipboardMarkdown] Serialized markdown length:', markdown.length);
        console.log('[ClipboardMarkdown] Markdown preview:', markdown.substring(0, 100));

        // Set Markdown as plain text in clipboard
        data.setData('text/plain', markdown);

        // Clear HTML to prevent rich text paste in external apps
        data.setData('text/html', '');

        // Preserve Slate fragment for internal paste (maintains full fidelity)
        const encoded = window.btoa(
          encodeURIComponent(JSON.stringify(fragment))
        );
        data.setData('application/x-slate-fragment', encoded);

        console.log('[ClipboardMarkdown] Successfully set clipboard data');
      } catch (error) {
        console.error('[ClipboardMarkdown] Failed to serialize:', error);
        // Fall back to default behavior on error
        if (originalSetFragmentData) {
          originalSetFragmentData(data);
        }
      }
    };

    return editor;
  },
});

export const ClipboardMarkdownKit = [ClipboardMarkdownPlugin];
