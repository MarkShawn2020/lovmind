import { memo } from 'react';
import { Send, Pin, Tag } from 'lucide-react';

const PinButton = memo(({
  onClick,
  isPinned
}: {
  onClick: () => void;
  isPinned: boolean;
}) => (
  <button
    className={`w-9 h-9 rounded-[var(--radius)] border border-border flex items-center justify-center cursor-pointer transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] transform-gpu will-change-auto contain-[layout_style_paint] hover:bg-secondary hover:text-foreground hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] pin-toggle ${isPinned ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
    onClick={onClick}
    title={isPinned ? 'Unpin note' : 'Pin note'}
  >
    <Pin size={18} />
  </button>
));

const TagsDisplay = memo(({ tags }: { tags: string[] }) => {
  if (tags.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
        <Tag size={14} className="opacity-50" />
        <span className="opacity-50">No tags</span>
      </div>
    );
  }

  // Show max 3 tags, then "+ N more"
  const displayTags = tags.slice(0, 3);
  const remaining = tags.length - 3;

  return (
    <div className="flex items-center gap-1.5 max-w-[280px]">
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
  onClick
}: {
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    className="w-10 h-10 rounded-full border-none bg-primary text-primary-foreground flex items-center justify-center cursor-pointer transition-[transform,box-shadow,background-color] duration-200 ease-in-out shadow-[0_2px_8px_rgba(217,119,87,0.25)] transform-gpu will-change-transform hover:enabled:-translate-y-0.5 hover:enabled:scale-105 hover:enabled:shadow-[0_4px_16px_rgba(217,119,87,0.35)] hover:enabled:bg-accent active:enabled:translate-y-0 active:enabled:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none send-btn"
    onClick={onClick}
    disabled={disabled}
    title="Submit (⌘+Enter)"
  >
    <Send size={18} />
  </button>
));

interface EditorToolbarProps {
  mode: 'main' | 'float';
  onSubmit: () => void;
  submitDisabled: boolean;
  currentTags?: string[];
}

// Memoized toolbar to prevent any re-renders
const EditorToolbar = memo(({
  mode,
  onSubmit,
  submitDisabled,
  currentTags = []
}: EditorToolbarProps) => (
  <div className={`flex-shrink-0 bg-card border-t border-border flex justify-between items-center px-[var(--spacing-s)] z-10 will-change-contents transform-gpu backface-hidden ${mode === 'float' ? 'h-11 bg-muted border-t-border opacity-95' : 'h-12'}`}>
    <div className="flex gap-2 items-center">
      <TagsDisplay tags={currentTags} />
    </div>
    <div className="flex gap-2 items-center">
      <SendButton disabled={submitDisabled} onClick={onSubmit} />
    </div>
  </div>
));

export default EditorToolbar;
