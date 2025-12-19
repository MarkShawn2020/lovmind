/**
 * EditorContextMenu
 * Provides right-click context menu for the editor with multiple copy/paste options
 */

import React from 'react';
import { BlockSelectionPlugin } from '@platejs/selection/react';
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
  const containerRef = React.useRef<HTMLDivElement | null>(null);

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

  // EditorContextMenu is disabled - using only BlockContextMenu for all selections
  // React.useEffect(() => {
  //   // Use provided targetElement or fall back to containerRef
  //   const target = targetElement || containerRef.current;
  //   if (!target) return;

  //   const handleContextMenu = (event: MouseEvent) => {
  //     if (!(event.target instanceof Node)) return;
  //     if (!target.contains(event.target)) return;

  //     // Check if there's a text selection
  //     const hasTextSelection = editor.selection && !editor.api.isCollapsed();

  //     // Check if there's an active block selection (e.g., from Cmd+A)
  //     let blockSelectionNodes: any[] = [];
  //     let hasBlockSelection = false;
  //     try {
  //       blockSelectionNodes = editor.getApi(BlockSelectionPlugin).blockSelection.getNodes();
  //       hasBlockSelection = blockSelectionNodes.length > 0;
  //     } catch (e) {
  //       // BlockSelectionPlugin may not be available
  //     }

  //     console.log('[EditorContextMenu] handleContextMenu:', {
  //       hasTextSelection,
  //       hasBlockSelection,
  //       blockSelectionCount: blockSelectionNodes.length,
  //       selection: editor.selection
  //     });

  //     // Only handle context menu if there's a text selection WITHOUT block selection
  //     // If block selection is active (e.g., Cmd+A), let BlockContextMenu handle it
  //     if (!hasTextSelection || hasBlockSelection) {
  //       console.log('[EditorContextMenu] ⏭️ Skipping - either no text selection or block selection active');
  //       return;
  //     }

  //     console.log('[EditorContextMenu] ✅ Handling - pure text selection, showing editor menu');
  //     event.preventDefault();
  //     event.stopPropagation();

  //     const { clientX, clientY } = event;
  //     setInitialPosition({ x: clientX, y: clientY });
  //     setMenuPosition({ x: clientX, y: clientY });
  //     setMenuOpen(true);
  //   };

  //   document.addEventListener('contextmenu', handleContextMenu, true);
  //   return () => {
  //     document.removeEventListener('contextmenu', handleContextMenu, true);
  //   };
  // }, [targetElement, editor]);

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
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (event.type === 'contextmenu' && targetElement?.contains(target)) {
        return;
      }
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
  }, [menuOpen, closeMenu, targetElement]);

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
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left min-w-0',
      disabled && 'pointer-events-none opacity-50 text-muted-foreground'
    );

  const handleContainerMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest(
          'button, [role="button"], a, input, textarea, select, [data-plate-prevent-deselect]'
        )
      ) {
        return;
      }

      const inSlateEditor = target.closest('[data-slate-editor]');
      const inSlateNode = target.closest('[data-slate-node="element"], [data-slate-node="text"]');

      if (inSlateEditor && inSlateNode) return;

      event.preventDefault();
      event.stopPropagation();

      const endPoint = editor.api.end([]);
      if (endPoint) {
        editor.tf.select(editor.api.range(endPoint, endPoint));
      }
      requestAnimationFrame(() => {
        editor.tf.focus();
      });
    },
    [editor]
  );

  return (
    <>
      <div
        ref={containerRef}
        className="min-w-0 w-full h-full min-h-0 flex flex-col"
        onMouseDownCapture={handleContainerMouseDown}
      >
        {children}
      </div>
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[8rem] w-64 max-h-[calc(100vh-16px)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }}
          role="menu"
        >
          <button className={itemClassName(!hasSelection)} onClick={handleCopy} disabled={!hasSelection}>
            <span className="flex-1 truncate">Copy</span>
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </button>
          <button className={itemClassName(!hasSelection)} onClick={handleCopyAsMarkdown} disabled={!hasSelection}>
            <span className="flex-1 truncate">Copy as Markdown</span>
          </button>
          <button className={itemClassName(!hasSelection)} onClick={handleCopyAsPlainText} disabled={!hasSelection}>
            <span className="flex-1 truncate">Copy as Plain Text</span>
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button className={itemClassName(!hasSelection)} onClick={handleCut} disabled={!hasSelection}>
            <span className="flex-1 truncate">Cut</span>
            <ContextMenuShortcut>⌘X</ContextMenuShortcut>
          </button>
          <button className={itemClassName()} onClick={handlePaste}>
            <span className="flex-1 truncate">Paste</span>
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button className={itemClassName()} onClick={handleSelectAll}>
            <span className="flex-1 truncate">Select All</span>
            <ContextMenuShortcut>⌘A</ContextMenuShortcut>
          </button>
        </div>
      )}
    </>
  );
}
