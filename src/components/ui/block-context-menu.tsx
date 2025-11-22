'use client';

import * as React from 'react';

import { AIChatPlugin } from '@platejs/ai/react';
import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from '@platejs/selection/react';
import { serializeMd } from '@platejs/markdown';
import { KEYS } from 'platejs';
import { useEditorPlugin, usePlateState } from 'platejs/react';

import { useIsTouchDevice } from '@/hooks/use-is-touch-device';
import { blockMenuState } from '@/lib/block-menu-state';

// Helper function to extract text from Slate nodes (same as in block-selection-kit)
function getNodeString(node: any): string {
  if ('text' in node && typeof node.text === 'string') {
    return node.text;
  }

  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child: any) => getNodeString(child)).join('');
  }

  return '';
}

export function BlockContextMenu() {
  const { api, editor } = useEditorPlugin(BlockMenuPlugin);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = React.useState({ x: 0, y: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isTouch = useIsTouchDevice();
  const [readOnly] = usePlateState('readOnly');

  // Update global state when menu state changes to hide floating toolbar
  React.useEffect(() => {
    blockMenuState.setOpen(menuOpen);
  }, [menuOpen]);

  const handleTurnInto = React.useCallback(
    (type: string) => {
      editor
        .getApi(BlockSelectionPlugin)
        .blockSelection.getNodes()
        .forEach(([node, path]) => {
          if (node[KEYS.listType]) {
            editor.tf.unsetNodes([KEYS.listType, 'indent'], {
              at: path,
            });
          }
          editor.tf.toggleBlock(type, { at: path });
        });
      setMenuOpen(false);
    },
    [editor]
  );

  const handleAlign = React.useCallback(
    (align: 'center' | 'left' | 'right') => {
      editor
        .getTransforms(BlockSelectionPlugin)
        .blockSelection.setNodes({ align });
      setMenuOpen(false);
    },
    [editor]
  );

  // Adjust menu position after render to prevent overflow
  React.useLayoutEffect(() => {
    if (!menuOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const padding = 8;

    let newX = initialPosition.x;
    let newY = initialPosition.y;

    // Check horizontal overflow
    if (newX + menuRect.width + padding > window.innerWidth) {
      newX = window.innerWidth - menuRect.width - padding;
    }
    if (newX < padding) {
      newX = padding;
    }

    // Check vertical overflow - this is the critical fix
    if (newY + menuRect.height + padding > window.innerHeight) {
      // Try to position above the cursor first
      const positionAbove = newY - menuRect.height;
      if (positionAbove >= padding) {
        newY = positionAbove;
      } else {
        // If doesn't fit above, position at top with padding
        newY = padding;
      }
    }
    if (newY < padding) {
      newY = padding;
    }

    // Only update if position changed
    if (newX !== menuPosition.x || newY !== menuPosition.y) {
      setMenuPosition({ x: newX, y: newY });
    }
  }, [menuOpen, initialPosition, menuPosition.x, menuPosition.y]);

  // Only set up context menu listener, nothing else
  React.useEffect(() => {
    if (isTouch || readOnly) return;

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Only handle if it's in the editor
      if (target.closest('[data-slate-editor="true"]')) {
        event.preventDefault();
        event.stopPropagation();

        // Prevent the default mousedown behavior that might clear selection
        // This ensures the block selection remains intact when right-clicking

        // Store initial click position - will be adjusted after render
        setInitialPosition({ x: event.clientX, y: event.clientY });
        setMenuPosition({ x: event.clientX, y: event.clientY });
        setMenuOpen(true);
        api.blockMenu.show(BLOCK_CONTEXT_MENU_ID, {
          x: event.clientX,
          y: event.clientY,
        });
      }
    };

    // Prevent right-click mousedown from clearing selection
    const handleMouseDown = (event: MouseEvent) => {
      // Only prevent if it's a right-click (button 2) in the editor
      if (event.button === 2) {
        const target = event.target as HTMLElement;
        if (target.closest('[data-slate-editor="true"]')) {
          // Check if there's a block selection active
          const hasBlockSelection = editor.getApi(BlockSelectionPlugin).blockSelection.getNodes().length > 0;

          if (hasBlockSelection) {
            // Prevent the mousedown from propagating to Slate, which would clear the selection
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        api.blockMenu.hide();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (menuOpen && event.key === 'Escape') {
        setMenuOpen(false);
        api.blockMenu.hide();
      }
    };

    // Add mousedown listener with capture phase to intercept before Slate
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [api.blockMenu, isTouch, readOnly, menuOpen, editor]);

  // Don't wrap children at all, just render the menu when needed
  if (isTouch) {
    return null;
  }

  if (!menuOpen) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[8rem] max-h-[calc(100vh-16px)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md w-64"
      style={{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
      }}
    >
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
        onClick={() => {
          editor.getApi(BlockSelectionPlugin).blockSelection.focus();
          editor.getApi(AIChatPlugin).aiChat.show();
          setMenuOpen(false);
        }}
      >
        Ask AI
      </button>

      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
        onClick={() => {
          const selectedBlocks = editor
            .getApi(BlockSelectionPlugin)
            .blockSelection.getNodes();

          if (selectedBlocks.length === 0) return;

          // Extract text from selected nodes
          const nodes = selectedBlocks.map(([node]) => node);
          const plainText = nodes
            .map((node) => {
              try {
                return getNodeString(node);
              } catch {
                return '';
              }
            })
            .filter(Boolean)
            .join('\n\n');

          // Write to clipboard
          if (navigator.clipboard) {
            navigator.clipboard.writeText(plainText).catch((err) => {
              console.error('Failed to copy:', err);
            });
          }
          setMenuOpen(false);
        }}
      >
        Copy
      </button>

      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
        onClick={() => {
          const selectedBlocks = editor
            .getApi(BlockSelectionPlugin)
            .blockSelection.getNodes();

          if (selectedBlocks.length === 0) return;

          // Extract selected nodes
          const nodes = selectedBlocks.map(([node]) => node);

          try {
            // Serialize to Markdown
            const markdown = serializeMd(editor as any, { value: nodes as any });

            // Write to clipboard
            if (navigator.clipboard) {
              navigator.clipboard.writeText(markdown).catch((err) => {
                console.error('Failed to copy markdown:', err);
              });
            }
          } catch (error) {
            console.error('Failed to serialize markdown:', error);
          }

          setMenuOpen(false);
        }}
      >
        Copy as Markdown
      </button>

      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
        onClick={() => {
          editor.getTransforms(BlockSelectionPlugin).blockSelection.removeNodes();
          editor.tf.focus();
          setMenuOpen(false);
        }}
      >
        Delete
      </button>
      
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
        onClick={() => {
          editor.getTransforms(BlockSelectionPlugin).blockSelection.duplicate();
          setMenuOpen(false);
        }}
      >
        Duplicate
      </button>
      
      <div className="-mx-1 my-1 h-px bg-border" />
      
      <div className="px-2 py-1.5 text-sm font-medium">Turn into</div>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left pl-8"
        onClick={() => handleTurnInto(KEYS.p)}
      >
        Paragraph
      </button>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left pl-8"
        onClick={() => handleTurnInto(KEYS.h1)}
      >
        Heading 1
      </button>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left pl-8"
        onClick={() => handleTurnInto(KEYS.h2)}
      >
        Heading 2
      </button>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left pl-8"
        onClick={() => handleTurnInto(KEYS.h3)}
      >
        Heading 3
      </button>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left pl-8"
        onClick={() => handleTurnInto(KEYS.blockquote)}
      >
        Blockquote
      </button>
      
      <div className="-mx-1 my-1 h-px bg-border" />
      
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
        onClick={() => {
          editor.getTransforms(BlockSelectionPlugin).blockSelection.setIndent(1);
          setMenuOpen(false);
        }}
      >
        Indent
      </button>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
        onClick={() => {
          editor.getTransforms(BlockSelectionPlugin).blockSelection.setIndent(-1);
          setMenuOpen(false);
        }}
      >
        Outdent
      </button>
      
      <div className="-mx-1 my-1 h-px bg-border" />
      
      <div className="px-2 py-1.5 text-sm font-medium">Align</div>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left pl-8"
        onClick={() => handleAlign('left')}
      >
        Left
      </button>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left pl-8"
        onClick={() => handleAlign('center')}
      >
        Center
      </button>
      <button
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left pl-8"
        onClick={() => handleAlign('right')}
      >
        Right
      </button>
    </div>
  );
}