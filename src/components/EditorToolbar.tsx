import { memo, useState } from 'react';
import { Send, Pin, Tag, Plus, Menu } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { TagManagerPopover } from '@/components/TagManagerPopover';
import type { Note } from '@/store';
import type { RenderingWysiwygEditorRef } from '@/components/RenderingWysiwygEditor';

const PinButton = memo(({
  onClick,
  isPinned
}: {
  onClick: () => void;
  isPinned: boolean;
}) => (
  <button
    className={`w-9 h-9 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-[var(--radius)] border border-border flex items-center justify-center cursor-pointer transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] transform-gpu will-change-auto contain-[layout_style_paint] hover:bg-secondary hover:text-foreground hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-95 touch-manipulation pin-toggle ${isPinned ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
    onClick={onClick}
    title={isPinned ? 'Unpin note' : 'Pin note'}
    type="button"
  >
    <Pin size={18} />
  </button>
));

const TagsDisplay = memo(({
  tags,
  onClick
}: {
  tags: string[];
  onClick?: () => void;
}) => {
  if (tags.length === 0) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground cursor-pointer hover:bg-accent rounded-md transition-colors"
        onClick={onClick}
      >
        <Tag size={14} className="opacity-50" />
        <span className="opacity-50">No tags</span>
      </div>
    );
  }

  // Show max 3 tags, then "+ N more"
  const displayTags = tags.slice(0, 3);
  const remaining = tags.length - 3;

  return (
    <div
      className="flex items-center gap-1.5 max-w-[280px] cursor-pointer hover:bg-accent px-2 py-1 -mx-2 -my-1 rounded-md transition-colors"
      onClick={onClick}
    >
      <Tag size={14} className="text-muted-foreground flex-shrink-0" />
      <div className="flex gap-1 flex-wrap items-center overflow-hidden">
        {displayTags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 text-[0.625rem] bg-primary/10 text-primary rounded-md font-medium border border-primary/20 whitespace-nowrap"
            title={`#${tag}`}
          >
            #{tag}
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-[0.625rem] text-muted-foreground whitespace-nowrap">
            +{remaining}
          </span>
        )}
      </div>
    </div>
  );
});

const SendButton = memo(({
  disabled,
  onClick,
  isViewingMode
}: {
  disabled: boolean;
  onClick: () => void;
  isViewingMode?: boolean;
}) => {
  if (isViewingMode) {
    return (
      <button
        className="h-10 min-h-[44px] px-4 rounded-full border-none bg-primary text-primary-foreground flex items-center justify-center gap-2 cursor-pointer transition-[transform,box-shadow,background-color] duration-200 ease-in-out shadow-[0_2px_8px_rgba(217,119,87,0.25)] transform-gpu will-change-transform hover:-translate-y-0.5 hover:scale-105 hover:shadow-[0_4px_16px_rgba(217,119,87,0.35)] hover:bg-accent active:translate-y-0 active:scale-[0.98] touch-manipulation send-btn"
        onClick={onClick}
        title="Create new note"
        type="button"
      >
        <Plus size={18} />
        <span className="text-sm font-medium">新建</span>
      </button>
    );
  }

  return (
    <button
      className="w-10 h-10 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-full border-none bg-primary text-primary-foreground flex items-center justify-center cursor-pointer transition-[transform,box-shadow,background-color] duration-200 ease-in-out shadow-[0_2px_8px_rgba(217,119,87,0.25)] transform-gpu will-change-transform hover:enabled:-translate-y-0.5 hover:enabled:scale-105 hover:enabled:shadow-[0_4px_16px_rgba(217,119,87,0.35)] hover:enabled:bg-accent active:enabled:translate-y-0 active:enabled:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none touch-manipulation send-btn"
      onClick={onClick}
      disabled={disabled}
      title="Submit (⌘+Enter)"
      type="button"
    >
      <Send size={18} />
    </button>
  );
});

interface EditorToolbarProps {
  mode: 'main' | 'float';
  onSubmit: () => void;
  submitDisabled: boolean;
  currentTags?: string[];
  allNotes?: Note[];
  isViewingMode?: boolean;
  editorRef?: React.RefObject<RenderingWysiwygEditorRef | null>;
  onOpenMobileSidebar?: () => void;
}

// Memoized toolbar to prevent any re-renders
const EditorToolbar = memo(({
  mode,
  onSubmit,
  submitDisabled,
  currentTags = [],
  allNotes = [],
  isViewingMode = false,
  editorRef,
  onOpenMobileSidebar
}: EditorToolbarProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  return (
    <div className={`flex-shrink-0 bg-card border-t border-border flex justify-between items-center px-[var(--spacing-s)] z-10 will-change-contents transform-gpu backface-hidden ${mode === 'float' ? 'h-11 bg-muted border-t-border opacity-95' : 'h-12'}`}>
      <div className="flex gap-2 items-center">
        {/* Mobile Sidebar Toggle - Only visible on small screens */}
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="sm:hidden w-9 h-9 min-w-[44px] min-h-[44px] rounded-[var(--radius)] border border-border bg-background text-muted-foreground flex items-center justify-center cursor-pointer transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] transform-gpu hover:bg-secondary hover:text-foreground hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-95 touch-manipulation"
            aria-label="Open navigation menu"
            type="button"
          >
            <Menu size={18} />
          </button>
        )}
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <div>
              <TagsDisplay tags={currentTags} onClick={() => setIsPopoverOpen(true)} />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start" side="top" sideOffset={8}>
            <TagManagerPopover
              currentTags={currentTags}
              allNotes={allNotes}
              editorRef={editorRef}
              onClose={() => setIsPopoverOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex gap-2 items-center">
        <SendButton disabled={submitDisabled} onClick={onSubmit} isViewingMode={isViewingMode} />
      </div>
    </div>
  );
});

export default EditorToolbar;
