/**
 * EditorContextMenu
 * Provides right-click context menu for the editor with multiple copy/paste options
 */

import React from 'react';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { copyAsMarkdown, copyAsPlainText } from '@/utils/editorClipboard';

interface EditorContextMenuProps {
  editor: any; // Accept any editor type to avoid complex generic constraints
  children: React.ReactNode;
  targetElement?: HTMLElement | null;
}

export function EditorContextMenu({ editor, children, targetElement }: EditorContextMenuProps) {
  const [hasSelection, setHasSelection] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = React.useState({ x: 0, y: 0 });
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // Check if editor has selection to enable/disable copy options
  React.useEffect(() => {
    const checkSelection = () => {
      setHasSelection(!!editor?.selection);
    };

    checkSelection();
    document.addEventListener('selectionchange', checkSelection);

    return () => {
      document.removeEventListener('selectionchange', checkSelection);
    };
  }, [editor]);

  React.useEffect(() => {
    if (!targetElement) return;

    const handleContextMenu = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!targetElement.contains(event.target)) return;

      event.preventDefault();
      event.stopPropagation();

      const { clientX, clientY } = event;
      setInitialPosition({ x: clientX, y: clientY });
      setMenuPosition({ x: clientX, y: clientY });
      setMenuOpen(true);
    };

    targetElement.addEventListener('contextmenu', handleContextMenu);
    return () => {
      targetElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [targetElement]);

  React.useLayoutEffect(() => {
    if (!menuOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const padding = 8;

    let nextX = initialPosition.x;
    let nextY = initialPosition.y;

    if (nextX + rect.width + padding > window.innerWidth) {
      nextX = window.innerWidth - rect.width - padding;
    }
    if (nextX < padding) {
      nextX = padding;
    }

    if (nextY + rect.height + padding > window.innerHeight) {
      const above = nextY - rect.height;
      nextY = above >= padding ? above : window.innerHeight - rect.height - padding;
    }
    if (nextY < padding) {
      nextY = padding;
    }

    setMenuPosition(prev => {
      if (prev.x === nextX && prev.y === nextY) {
        return prev;
      }
      return { x: nextX, y: nextY };
    });
  }, [menuOpen, initialPosition]);

  const closeMenu = React.useCallback(() => {
    setMenuOpen(false);
  }, []);

  React.useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    const handleScrollOrBlur = () => closeMenu();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('contextmenu', handlePointerDown);
    document.addEventListener('scroll', handleScrollOrBlur, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrBlur);
    window.addEventListener('blur', handleScrollOrBlur);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('contextmenu', handlePointerDown);
      document.removeEventListener('scroll', handleScrollOrBlur, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrBlur);
      window.removeEventListener('blur', handleScrollOrBlur);
    };
  }, [menuOpen, closeMenu]);

  React.useEffect(() => {
    if (!targetElement) {
      closeMenu();
    }
  }, [targetElement, closeMenu]);

  const handleCopy = async () => {
    document.execCommand('copy');
    closeMenu();
  };

  const handleCopyAsMarkdown = async () => {
    const success = await copyAsMarkdown(editor);
    if (!success) {
      console.warn('[EditorContextMenu] Failed to copy as Markdown');
    }
    closeMenu();
  };

  const handleCopyAsPlainText = async () => {
    const success = await copyAsPlainText(editor);
    if (!success) {
      console.warn('[EditorContextMenu] Failed to copy as plain text');
    }
    closeMenu();
  };

  const handleCut = async () => {
    document.execCommand('cut');
    closeMenu();
  };

  const handlePaste = async () => {
    document.execCommand('paste');
    closeMenu();
  };

  const handleSelectAll = () => {
    const startPoint = editor.api.start([]);
    const endPoint = editor.api.end([]);

    if (startPoint && endPoint) {
      editor.tf.select(editor.api.range(startPoint, endPoint));
      editor.tf.focus();
    }
    closeMenu();
  };

  const itemClassName = (disabled?: boolean) =>
    cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left',
      disabled && 'pointer-events-none opacity-50 text-muted-foreground'
    );

  return (
    <>
      {children}
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[8rem] w-64 max-h-[calc(100vh-16px)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }}
          role="menu"
        >
          <button className={itemClassName(!hasSelection)} onClick={handleCopy} disabled={!hasSelection}>
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </button>
          <button className={itemClassName(!hasSelection)} onClick={handleCopyAsMarkdown} disabled={!hasSelection}>
            Copy as Markdown
          </button>
          <button className={itemClassName(!hasSelection)} onClick={handleCopyAsPlainText} disabled={!hasSelection}>
            Copy as Plain Text
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button className={itemClassName(!hasSelection)} onClick={handleCut} disabled={!hasSelection}>
            Cut
            <ContextMenuShortcut>⌘X</ContextMenuShortcut>
          </button>
          <button className={itemClassName()} onClick={handlePaste}>
            Paste
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button className={itemClassName()} onClick={handleSelectAll}>
            Select All
            <ContextMenuShortcut>⌘A</ContextMenuShortcut>
          </button>
        </div>
      )}
    </>
  );
}
