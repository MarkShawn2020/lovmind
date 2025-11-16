/**
 * EditorContextMenu
 * Provides right-click context menu for the editor with multiple copy/paste options
 */

import React from 'react';
import type { TPlateEditor } from 'platejs/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { copyAsMarkdown, copyAsPlainText } from '@/utils/editorClipboard';

interface EditorContextMenuProps {
  editor: any; // Accept any editor type to avoid complex generic constraints
  children: React.ReactNode;
}

export function EditorContextMenu({ editor, children }: EditorContextMenuProps) {
  const [hasSelection, setHasSelection] = React.useState(false);

  // Check if editor has selection to enable/disable copy options
  React.useEffect(() => {
    const checkSelection = () => {
      setHasSelection(!!editor.selection);
    };

    // Check initially
    checkSelection();

    // Listen for selection changes
    document.addEventListener('selectionchange', checkSelection);

    return () => {
      document.removeEventListener('selectionchange', checkSelection);
    };
  }, [editor]);

  const handleCopy = async () => {
    // Use browser's native copy (preserves all formats)
    document.execCommand('copy');
  };

  const handleCopyAsMarkdown = async () => {
    const success = await copyAsMarkdown(editor);
    if (!success) {
      console.warn('[EditorContextMenu] Failed to copy as Markdown');
    }
  };

  const handleCopyAsPlainText = async () => {
    const success = await copyAsPlainText(editor);
    if (!success) {
      console.warn('[EditorContextMenu] Failed to copy as plain text');
    }
  };

  const handleCut = async () => {
    // Use browser's native cut
    document.execCommand('cut');
  };

  const handlePaste = async () => {
    // Use browser's native paste
    document.execCommand('paste');
  };

  const handleSelectAll = () => {
    // Select all content in editor
    const startPoint = editor.api.start([]);
    const endPoint = editor.api.end([]);

    if (startPoint && endPoint) {
      editor.tf.select(editor.api.range(startPoint, endPoint));
      editor.tf.focus();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onClick={handleCopy} disabled={!hasSelection}>
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyAsMarkdown} disabled={!hasSelection}>
          Copy as Markdown
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyAsPlainText} disabled={!hasSelection}>
          Copy as Plain Text
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCut} disabled={!hasSelection}>
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePaste}>
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleSelectAll}>
          Select All
          <ContextMenuShortcut>⌘A</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
