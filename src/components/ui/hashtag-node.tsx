'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement, useFocused, useReadOnly, useSelected, useEditorRef } from 'platejs/react';
import { ReactEditor } from 'slate-react';
import { cn } from '@/lib/utils';
import type { THashtagElement } from '@/components/editor/plugins/hashtag-base-kit';

export function HashtagElement(props: PlateElementProps<THashtagElement>) {
  const element = props.element;
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();
  const editor = useEditorRef();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(element.value);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(element.value);
  };

  const handleSave = () => {
    const trimmed = editValue.trim().replace(/^#+/, ''); // Remove leading # symbols

    if (!trimmed) {
      // Empty tag - cancel editing
      setIsEditing(false);
      setEditValue(element.value);
      return;
    }

    if (trimmed === element.value) {
      // No change - just exit editing
      setIsEditing(false);
      return;
    }

    try {
      // Find the path of this element in the Slate tree
      const path = ReactEditor.findPath(editor as any, element);

      // Update the node value
      editor.tf.setNodes(
        { value: trimmed } as Partial<THashtagElement>,
        { at: path }
      );

      setIsEditing(false);

      // Restore focus to editor after a brief delay to avoid conflicts
      requestAnimationFrame(() => {
        editor.tf.focus();
      });
    } catch (error) {
      console.error('[HashtagElement] Failed to update tag:', error);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent Slate from intercepting these keys
    e.stopPropagation();

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setEditValue(element.value);
      // Restore focus immediately on cancel
      requestAnimationFrame(() => {
        editor.tf.focus();
      });
    }
  };

  const handleInputClick = (e: React.MouseEvent) => {
    // Prevent event from bubbling to Slate during editing
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) {
      // While editing, prevent Slate from handling mouse events
      e.stopPropagation();
    }
  };

  const handleBlur = () => {
    // Auto-save on blur
    handleSave();
  };

  if (isEditing) {
    return (
      <PlateElement
        {...props}
        className="inline-block align-baseline"
        attributes={{
          ...props.attributes,
          contentEditable: false,
        }}
      >
        <span
          className="inline-flex items-center"
          onMouseDown={handleMouseDown}
          onClick={handleInputClick}
        >
          <span className="text-sm text-brand/90">#</span>
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onClick={handleInputClick}
            onMouseDown={handleMouseDown}
            className="inline-block px-1 py-0.5 text-sm bg-brand/10 text-brand/90 border border-brand/40 rounded outline-none focus:ring-1 focus:ring-brand/60 min-w-[40px] max-w-[150px]"
            maxLength={50}
            aria-label={`Edit tag ${element.value}`}
          />
        </span>
        {props.children}
      </PlateElement>
    );
  }

  return (
    <PlateElement
      {...props}
      className={cn(
        'inline-block rounded px-1 align-baseline text-sm font-normal',
        'bg-brand/10 text-brand/90 dark:bg-brand/15 dark:text-brand/80',
        !readOnly && 'cursor-pointer hover:bg-brand/15 dark:hover:bg-brand/20',
        selected && focused && 'ring-1 ring-brand/40'
      )}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        'data-slate-value': element.value,
        onDoubleClick: handleDoubleClick,
        onMouseDown: handleMouseDown,
      }}
    >
      #{element.value}
      {props.children}
    </PlateElement>
  );
}
