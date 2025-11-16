/**
 * Clipboard Fix Plugin
 *
 * Fixes Slate.js edge case where getFragment() returns empty array after Cmd+A.
 * This ensures copy/paste works correctly for both manual selection and Select All.
 *
 * Technical Background:
 * - Manual drag selection: getFragment() works correctly
 * - Cmd+A (Select All): getFragment() returns [] due to Slate's shadow input focus
 *
 * Solution:
 * - Override setFragmentData to detect empty fragment
 * - Fallback to editor.children when fragment is empty but selection exists
 * - Preserve multi-format clipboard data (HTML + plain text + Slate fragment)
 */

import { createSlatePlugin } from 'platejs';

export const ClipboardFixPlugin = createSlatePlugin({
  key: 'clipboard-fix',
  extendEditor: ({ editor }) => {
    const originalSetFragmentData = editor.setFragmentData as ((data: DataTransfer) => void) | undefined;

    // Override setFragmentData to fix Cmd+A edge case
    editor.setFragmentData = (data: DataTransfer) => {
      const { selection } = editor;

      // If no selection at all, use original behavior
      if (!selection) {
        if (originalSetFragmentData) {
          originalSetFragmentData.call(editor, data);
        }
        return;
      }

      try {
        // Get the selected fragment
        let fragment = (editor.getFragment as () => any[])();

        // CRITICAL FIX: Handle Cmd+A edge case where getFragment() returns []
        // This happens because Slate's shadow input gets focus during Select All
        if (!fragment || fragment.length === 0) {
          console.log('[ClipboardFix] Fragment is empty, using editor.children as fallback');
          fragment = editor.children as any;
        }

        // Verify we have content to copy
        if (!fragment || fragment.length === 0) {
          console.warn('[ClipboardFix] No content to copy');
          if (originalSetFragmentData) {
            originalSetFragmentData.call(editor, data);
          }
          return;
        }

        // Serialize fragment to Slate JSON format for internal copy/paste
        const string = JSON.stringify(fragment);
        const encoded = window.btoa(encodeURIComponent(string));

        // Set multiple clipboard formats for maximum compatibility:
        // 1. application/x-slate-fragment: For perfect copy/paste within Plate.js editors
        data.setData('application/x-slate-fragment', encoded);

        // 2. text/html: For pasting into other rich text editors
        const htmlString = serializeToHtml(fragment);
        data.setData('text/html', htmlString);

        // 3. text/plain: For pasting into plain text fields
        const plainText = serializeToPlainText(fragment);
        data.setData('text/plain', plainText);

        console.log('[ClipboardFix] Successfully set clipboard data with', fragment.length, 'nodes');
      } catch (error) {
        console.error('[ClipboardFix] Error setting clipboard data:', error);
        // Fall back to original behavior on error
        if (originalSetFragmentData) {
          originalSetFragmentData.call(editor, data);
        }
      }
    };

    return editor;
  },
});

/**
 * Serialize Slate nodes to HTML string
 * This provides rich formatting when pasting into external applications
 */
function serializeToHtml(nodes: any[]): string {
  const htmlNodes = nodes.map(node => nodeToHtml(node));
  return htmlNodes.join('');
}

/**
 * Convert a single Slate node to HTML
 */
function nodeToHtml(node: any): string {
  // Text node
  if (node.text !== undefined) {
    let text = escapeHtml(node.text);

    // Apply marks
    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    if (node.strikethrough) text = `<s>${text}</s>`;
    if (node.code) text = `<code>${text}</code>`;

    return text;
  }

  // Element node with children
  const children = node.children?.map((child: any) => nodeToHtml(child)).join('') || '';

  // Map Slate types to HTML tags
  switch (node.type) {
    case 'h1': return `<h1>${children}</h1>`;
    case 'h2': return `<h2>${children}</h2>`;
    case 'h3': return `<h3>${children}</h3>`;
    case 'h4': return `<h4>${children}</h4>`;
    case 'h5': return `<h5>${children}</h5>`;
    case 'h6': return `<h6>${children}</h6>`;
    case 'blockquote': return `<blockquote>${children}</blockquote>`;
    case 'code_block': return `<pre><code>${children}</code></pre>`;
    case 'a': return `<a href="${node.url || ''}">${children}</a>`;
    case 'img': return `<img src="${node.url || ''}" alt="${node.name || ''}" />`;
    case 'p':
    default:
      // Handle list styling
      if (node.listStyleType === 'disc') {
        return `<li>${children}</li>`;
      } else if (node.listStyleType === 'decimal') {
        return `<li>${children}</li>`;
      }
      return `<p>${children}</p>`;
  }
}

/**
 * Serialize Slate nodes to plain text
 */
function serializeToPlainText(nodes: any[]): string {
  return nodes.map(node => nodeToPlainText(node)).join('\n');
}

/**
 * Convert a single Slate node to plain text
 */
function nodeToPlainText(node: any): string {
  // Text node
  if (node.text !== undefined) {
    return node.text;
  }

  // Element node with children
  const children = node.children?.map((child: any) => nodeToPlainText(child)).join('') || '';

  // Add prefix for lists
  if (node.listStyleType === 'disc') {
    return `- ${children}`;
  } else if (node.listStyleType === 'decimal') {
    return `1. ${children}`;
  }

  return children;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export const ClipboardFixKit = [ClipboardFixPlugin];
