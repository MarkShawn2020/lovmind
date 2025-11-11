import { memo } from 'react';
import { Clock, Send, Pin, Maximize2 } from 'lucide-react';

const RecentNotesButton = memo(({
  onClick
}: {
  onClick: () => void;
}) => (
  <button
    className="toolbar-btn recent-notes-toggle"
    onClick={onClick}
    title="Toggle Recent Notes"
  >
    <Clock size={18} />
  </button>
));

const PinButton = memo(({
  onClick,
  isPinned
}: {
  onClick: () => void;
  isPinned: boolean;
}) => (
  <button
    className={`toolbar-btn pin-toggle ${isPinned ? 'active' : ''}`}
    onClick={onClick}
    title={isPinned ? 'Unpin note' : 'Pin note'}
  >
    <Pin size={18} />
  </button>
));

const AlwaysOnTopButton = memo(({
  onClick,
  isAlwaysOnTop
}: {
  onClick: () => void;
  isAlwaysOnTop: boolean;
}) => (
  <button
    className={`toolbar-btn always-on-top-toggle ${isAlwaysOnTop ? 'active' : ''}`}
    onClick={onClick}
    title={isAlwaysOnTop ? 'Disable always on top' : 'Enable always on top'}
  >
    <Maximize2 size={18} />
  </button>
));

const SendButton = memo(({
  disabled,
  onClick
}: {
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    className="send-btn"
    onClick={onClick}
    disabled={disabled}
    title="Submit (⌘+Enter)"
  >
    <Send size={18} />
  </button>
));

interface EditorToolbarProps {
  mode: 'create' | 'edit';
  onToggleNotes?: () => void;
  onTogglePin?: () => void;
  isPinned?: boolean;
  onToggleAlwaysOnTop?: () => void;
  isAlwaysOnTop?: boolean;
  onSubmit: () => void;
  submitDisabled: boolean;
}

// Memoized toolbar to prevent any re-renders
const EditorToolbar = memo(({
  mode,
  onToggleNotes,
  onTogglePin,
  isPinned = false,
  onToggleAlwaysOnTop,
  isAlwaysOnTop = false,
  onSubmit,
  submitDisabled
}: EditorToolbarProps) => (
  <div className={`editor-toolbar ${mode === 'edit' ? 'toolbar-minimal' : ''}`}>
    <div className="toolbar-left">
      {mode === 'create' && onToggleNotes && (
        <RecentNotesButton onClick={onToggleNotes} />
      )}
      {mode === 'edit' && onTogglePin && (
        <PinButton onClick={onTogglePin} isPinned={isPinned} />
      )}
    </div>
    <div className="toolbar-right">
      {mode === 'edit' && onToggleAlwaysOnTop && (
        <AlwaysOnTopButton onClick={onToggleAlwaysOnTop} isAlwaysOnTop={isAlwaysOnTop} />
      )}
      <SendButton disabled={submitDisabled} onClick={onSubmit} />
    </div>
  </div>
));

export default EditorToolbar;
