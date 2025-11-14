'use client';

import * as React from 'react';

import { AIChatPlugin } from '@platejs/ai/react';
import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from '@platejs/selection/react';
import { KEYS } from 'platejs';
import { useEditorPlugin, usePlateState } from 'platejs/react';

import { useIsTouchDevice } from '@/hooks/use-is-touch-device';

export function BlockContextMenu() {
  const { api, editor } = useEditorPlugin(BlockMenuPlugin);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isTouch = useIsTouchDevice();
  const [readOnly] = usePlateState('readOnly');

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

  // Only set up context menu listener, nothing else
  React.useEffect(() => {
    if (isTouch || readOnly) return;

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Only handle if it's in the editor
      if (target.closest('[data-slate-editor="true"]')) {
        event.preventDefault();

        // Calculate position with viewport boundaries
        const menuWidth = 256; // w-64 = 16rem = 256px
        const menuMaxHeight = window.innerHeight - 16; // max-h with padding
        const padding = 8;

        let x = event.clientX;
        let y = event.clientY;

        // Adjust horizontal position if overflowing right
        if (x + menuWidth + padding > window.innerWidth) {
          x = window.innerWidth - menuWidth - padding;
        }

        // Adjust horizontal position if overflowing left
        if (x < padding) {
          x = padding;
        }

        // Adjust vertical position if overflowing bottom
        // Estimate menu height (rough calculation based on content)
        const estimatedHeight = Math.min(500, menuMaxHeight);
        if (y + estimatedHeight + padding > window.innerHeight) {
          y = Math.max(padding, window.innerHeight - estimatedHeight - padding);
        }

        // Ensure menu doesn't go above top
        if (y < padding) {
          y = padding;
        }

        setMenuPosition({ x, y });
        setMenuOpen(true);
        api.blockMenu.show(BLOCK_CONTEXT_MENU_ID, {
          x: event.clientX,
          y: event.clientY,
        });
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

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [api.blockMenu, isTouch, readOnly, menuOpen]);

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