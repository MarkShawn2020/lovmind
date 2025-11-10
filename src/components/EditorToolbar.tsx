import { memo } from 'react';
import { Clock, Send } from 'lucide-react';

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

// Memoized toolbar to prevent any re-renders
const EditorToolbar = memo(({
  onToggleNotes,
  onSubmit,
  submitDisabled
}: {
  onToggleNotes: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
}) => (
  <div className="editor-toolbar">
    <div className="toolbar-left">
      <RecentNotesButton onClick={onToggleNotes} />
    </div>
    <div className="toolbar-right">
      <SendButton disabled={submitDisabled} onClick={onSubmit} />
    </div>
  </div>
));

export default EditorToolbar;
