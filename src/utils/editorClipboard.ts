/**
 * Editor clipboard utility functions
 * Provides multiple copy formats: standard (HTML), Markdown, and plain text
 */

import type { Value } from 'platejs';
import { serializeMd } from '@platejs/markdown';
import type { TPlateEditor } from 'platejs/react';

/**
 * Copy selected content as Markdown format
 */
export async function copyAsMarkdown(editor: TPlateEditor): Promise<boolean> {
  try {
    const { selection } = editor;
    if (!selection) return false;

    // Get the selected fragment
    let fragment = (editor.getFragment as () => any)?.() || [];

    // Fallback to entire document if fragment is empty (Cmd+A edge case)
    if (!fragment || fragment.length === 0) {
      fragment = editor.children;
    }

    if (!fragment || fragment.length === 0) {
      return false;
    }

    // Serialize to Markdown
    const markdown = serializeMd(editor as any, { value: fragment });

    // Write to clipboard
    await navigator.clipboard.writeText(markdown);

    return true;
  } catch (error) {
    console.error('[EditorClipboard] Failed to copy as Markdown:', error);
    return false;
  }
}

/**
 * Copy selected content as plain text (no formatting)
 */
export async function copyAsPlainText(editor: TPlateEditor): Promise<boolean> {
  try {
    const { selection } = editor;
    if (!selection) return false;

    // Get plain text from selection
    const text = getPlainTextFromSelection(editor);

    if (!text) return false;

    // Write to clipboard
    await navigator.clipboard.writeText(text);

    return true;
  } catch (error) {
    console.error('[EditorClipboard] Failed to copy as plain text:', error);
    return false;
  }
}

/**
 * Extract plain text from editor selection
 */
function getPlainTextFromSelection(editor: TPlateEditor): string {
  try {
    const { selection } = editor;
    if (!selection) return '';

    let fragment = (editor.getFragment as () => any)?.() || [];

    // Fallback to entire document if fragment is empty
    if (!fragment || fragment.length === 0) {
      fragment = editor.children;
    }

    return extractPlainText(fragment as Value);
  } catch (error) {
    console.error('[EditorClipboard] Failed to extract plain text:', error);
    return '';
  }
}

/**
 * Recursively extract plain text from Slate nodes
 */
function extractPlainText(nodes: Value): string {
  const extractNodeText = (node: any): string => {
    if (typeof node.text === 'string') {
      return node.text;
    }

    if (node.children && Array.isArray(node.children)) {
      return node.children.map((child: any) => extractNodeText(child)).join('');
    }

    return '';
  };

  return nodes.map(node => extractNodeText(node)).filter(text => text.length > 0).join('\n');
}

/**
 * Perform standard copy operation (uses browser's default behavior)
 * This preserves rich formatting via HTML and Slate fragment
 */
export async function copyStandard(): Promise<boolean> {
  try {
    // Use browser's built-in copy command
    const success = document.execCommand('copy');
    return success;
  } catch (error) {
    console.error('[EditorClipboard] Failed to perform standard copy:', error);
    return false;
  }
}

/**
 * Perform standard cut operation (uses browser's default behavior)
 */
export async function cutStandard(): Promise<boolean> {
  try {
    // Use browser's built-in cut command
    const success = document.execCommand('cut');
    return success;
  } catch (error) {
    console.error('[EditorClipboard] Failed to perform standard cut:', error);
    return false;
  }
}

/**
 * Perform standard paste operation (uses browser's default behavior)
 */
export async function pasteStandard(): Promise<boolean> {
  try {
    // Use browser's built-in paste command
    const success = document.execCommand('paste');
    return success;
  } catch (error) {
    console.error('[EditorClipboard] Failed to perform standard paste:', error);
    return false;
  }
}
