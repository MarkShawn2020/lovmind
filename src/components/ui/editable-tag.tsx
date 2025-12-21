import { memo, useState, useRef, useEffect } from 'react';

interface EditableTagProps {
  tag: string;
  onRename?: (oldTag: string, newTag: string) => void;
  onClick?: () => void;
  className?: string;
  editable?: boolean;
}

/**
 * EditableTag - A tag component that supports double-click inline editing
 *
 * Features:
 * - Double-click to enter edit mode
 * - Auto-focus and select all text
 * - Enter to save, ESC to cancel
 * - Blur to save (if changed)
 * - Validation: trim whitespace, remove # prefix, prevent empty tags
 */
export const EditableTag = memo(({
  tag,
  onRename,
  onClick,
  className = '',
  editable = true,
}: EditableTagProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tag);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus and select all when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editable) return;
    setIsEditing(true);
    setEditValue(tag);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Distinguish single click from double click
    clickCountRef.current += 1;

    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => {
        // Single click - trigger onClick if provided
        if (onClick && !isEditing) {
          onClick();
        }
        clickCountRef.current = 0;
      }, 250); // 250ms window for double-click detection
    } else if (clickCountRef.current === 2) {
      // Double click detected
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      clickCountRef.current = 0;
      handleDoubleClick(e);
    }
  };

  const validateAndSave = () => {
    const trimmed = editValue.trim().replace(/^#+/, ''); // Remove leading # symbols

    if (!trimmed) {
      // Empty tag - cancel editing
      setIsEditing(false);
      setEditValue(tag);
      return;
    }

    if (trimmed !== tag && onRename) {
      onRename(tag, trimmed);
    }

    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      validateAndSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsEditing(false);
      setEditValue(tag);
    }
  };

  const handleBlur = () => {
    validateAndSave();
  };

  const handleInputClick = (e: React.MouseEvent) => {
    // Prevent click from bubbling to parent during editing
    e.stopPropagation();
  };

  if (isEditing) {
    return (
      <span className="inline-flex items-center relative">
        <span className="text-[0.6875rem] text-primary/90 mr-0.5">#</span>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={handleInputClick}
          className={`
            inline-block
            px-1 py-0.5
            text-[0.6875rem]
            bg-primary/8
            text-primary/90
            rounded-md
            font-medium
            border border-primary/40
            focus:outline-none
            focus:ring-1
            focus:ring-primary/60
            focus:border-primary/60
            min-w-[40px]
            max-w-[120px]
          `}
          maxLength={50}
          aria-label={`Edit tag ${tag}`}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </span>
    );
  }

  return (
    <span
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        inline-flex items-center
        px-2 py-0.5
        text-[0.6875rem]
        bg-primary/8
        text-primary/90
        rounded-md
        font-medium
        border border-primary/15
        whitespace-nowrap
        ${editable ? 'cursor-pointer hover:bg-primary/12 hover:border-primary/25 transition-colors' : 'cursor-default'}
        ${className}
      `}
      title={editable ? `Double-click to edit #${tag}` : `#${tag}`}
      role="button"
      tabIndex={0}
      aria-label={`Tag: ${tag}`}
    >
      #{tag}
    </span>
  );
});

EditableTag.displayName = 'EditableTag';
