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
    className={`
      w-10 h-10 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0
      rounded-xl
      border border-border/50
      flex items-center justify-center
      cursor-pointer
      transition-all duration-200 ease-out
      hover:bg-secondary/50 hover:border-border hover:shadow-sm
      active:scale-[0.96]
      touch-manipulation
      pin-toggle
      ${isPinned
        ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
        : 'bg-transparent text-muted-foreground hover:text-foreground'
      }
    `}
    onClick={onClick}
    title={isPinned ? 'Unpin note' : 'Pin note'}
    type="button"
  >
    <Pin size={16} strokeWidth={2} />
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
        className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground/60 cursor-pointer hover:bg-accent/50 rounded-lg transition-all duration-200"
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        <Tag size={14} strokeWidth={2} className="opacity-40" />
        <span className="font-medium">Add tags</span>
      </div>
    );
  }

  // Show max 3 tags, then "+ N more"
  const displayTags = tags.slice(0, 3);
  const remaining = tags.length - 3;

  return (
    <div
      className="flex items-center gap-2 max-w-[280px] cursor-pointer hover:bg-accent/50 px-3 py-2 -mx-3 -my-2 rounded-lg transition-all duration-200"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <Tag size={14} strokeWidth={2} className="text-muted-foreground/60 flex-shrink-0" />
      <div className="flex gap-1.5 flex-wrap items-center overflow-hidden">
        {displayTags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] bg-primary/8 text-primary/90 rounded-md font-medium border border-primary/15 whitespace-nowrap"
            title={`#${tag}`}
          >
            #{tag}
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-[0.6875rem] text-muted-foreground/70 font-medium whitespace-nowrap">
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
        className="
          h-10 min-h-[44px] px-5
          rounded-xl
          border-none
          bg-primary text-primary-foreground
          flex items-center justify-center gap-2
          font-medium text-sm
          cursor-pointer
          transition-all duration-200 ease-out
          shadow-sm
          hover:shadow-md hover:bg-primary/90
          active:scale-[0.97]
          touch-manipulation
          send-btn
        "
        onClick={onClick}
        title="Create new note"
        type="button"
      >
        <Plus size={16} strokeWidth={2.5} />
        <span>新建</span>
      </button>
    );
  }

  return (
    <button
      className="
        w-10 h-10 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0
        rounded-xl
        border-none
        bg-primary text-primary-foreground
        flex items-center justify-center
        cursor-pointer
        transition-all duration-200 ease-out
        shadow-sm
        hover:enabled:shadow-md hover:enabled:bg-primary/90
        active:enabled:scale-[0.97]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
        touch-manipulation
        send-btn
      "
      onClick={onClick}
      disabled={disabled}
      title="Submit (⌘+Enter)"
      type="button"
    >
      <Send size={16} strokeWidth={2.5} />
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
    <div
      className={`
        flex-shrink-0
        bg-card/80 backdrop-blur-sm
        border-t border-border/50
        flex justify-between items-center
        px-4 sm:px-6
        z-10
        ${mode === 'float' ? 'h-14 bg-muted/50' : 'h-16'}
      `}
    >
      <div className="flex gap-3 sm:gap-4 items-center">
        {/* Mobile Sidebar Toggle - Only visible on small screens */}
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="
              sm:hidden
              w-10 h-10 min-w-[44px] min-h-[44px]
              rounded-xl
              border border-border/50
              bg-transparent text-muted-foreground
              flex items-center justify-center
              cursor-pointer
              transition-all duration-200 ease-out
              hover:bg-secondary/50 hover:border-border hover:text-foreground hover:shadow-sm
              active:scale-[0.96]
              touch-manipulation
            "
            aria-label="Open navigation menu"
            type="button"
          >
            <Menu size={16} strokeWidth={2} />
          </button>
        )}
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <div>
              <TagsDisplay tags={currentTags} onClick={() => setIsPopoverOpen(true)} />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start" side="top" sideOffset={12}>
            <TagManagerPopover
              currentTags={currentTags}
              allNotes={allNotes}
              editorRef={editorRef}
              onClose={() => setIsPopoverOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex gap-3 sm:gap-4 items-center">
        <SendButton disabled={submitDisabled} onClick={onSubmit} isViewingMode={isViewingMode} />
      </div>
    </div>
  );
});

export default EditorToolbar;
